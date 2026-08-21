import React, { useState, useEffect, useRef, useCallback } from "react";
import { ActivitySpot, ActivityDetailData, ActivityChatMessage, ActivitySubLocation } from "../types";
import {
  X,
  MapPin,
  BookOpen,
  Lightbulb,
  MessageCircle,
  Send,
  Loader2,
  Navigation,
  Clock,
  Star,
  ExternalLink,
  Sparkles,
  Info,
  Compass,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ActivityDetailModalProps {
  activity: ActivitySpot;
  destination: string;
  isOpen: boolean;
  onClose: () => void;
}

type TabId = "location" | "about" | "anecdotes" | "chat";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "location", label: "Location", icon: <MapPin className="w-4 h-4" /> },
  { id: "about", label: "About", icon: <BookOpen className="w-4 h-4" /> },
  { id: "anecdotes", label: "Stories", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "chat", label: "Local Guide", icon: <MessageCircle className="w-4 h-4" /> },
];

// Fix leaflet default markers
const fixLeafletIcon = () => {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  });
};

function createCustomIcon(highlight?: string): L.DivIcon {
  const color = highlight === "Must-see" || highlight === "Main spot" ? "#5A5A40" : "#b45309";
  return L.divIcon({
    className: "custom-detail-marker",
    html: `<div style="background:${color};width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
      <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  activity,
  destination,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>("location");
  const [details, setDetails] = useState<ActivityDetailData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ActivityChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Map state
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch activity details when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      setDetailsError(null);
      try {
        const res = await fetch("/api/activity-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityName: activity.name,
            activityDescription: activity.description,
            category: activity.category,
            destination,
            address: activity.address,
            coordinates: activity.coordinates,
          }),
        });
        if (!res.ok) throw new Error("Failed to load details");
        const data: ActivityDetailData = await res.json();
        if (!cancelled) setDetails(data);
      } catch (err: any) {
        if (!cancelled) setDetailsError(err.message || "Could not load details");
      } finally {
        if (!cancelled) setIsLoadingDetails(false);
      }
    };

    fetchDetails();
    return () => { cancelled = true; };
  }, [isOpen, activity.id, destination]);

  // Initialize map when location tab is active
  const initMap = useCallback(() => {
    if (!mapContainerRef.current || !isOpen || activeTab !== "location") return;

    fixLeafletIcon();

    // Cleanup previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const subLocs = details?.subLocations || [];
    const allCoords: L.LatLngExpression[] = [];

    // Add main activity coordinates
    if (activity.coordinates) {
      allCoords.push([activity.coordinates.lat, activity.coordinates.lng]);
    }

    // Add sub-location coordinates
    for (const sub of subLocs) {
      allCoords.push([sub.coordinates.lat, sub.coordinates.lng]);
    }

    if (allCoords.length === 0) return;

    const center = allCoords.length === 1
      ? allCoords[0]
      : [
          allCoords.reduce((sum, c) => sum + (Array.isArray(c) ? c[0] : (c as any).lat), 0) / allCoords.length,
          allCoords.reduce((sum, c) => sum + (Array.isArray(c) ? c[1] : (c as any).lng), 0) / allCoords.length,
        ] as L.LatLngExpression;

    const map = L.map(mapContainerRef.current, {
      center: center as L.LatLngExpression,
      zoom: allCoords.length > 1 ? 14 : 16,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    // Add main pin if no sub-locations
    if (subLocs.length === 0 && activity.coordinates) {
      L.marker([activity.coordinates.lat, activity.coordinates.lng])
        .addTo(map)
        .bindPopup(`<b>${activity.name}</b>${activity.address ? `<br/><small>${activity.address}</small>` : ""}`)
        .openPopup();
    }

    // Add sub-location pins
    if (subLocs.length > 0) {
      const markers: L.Marker[] = [];
      for (const sub of subLocs) {
        const marker = L.marker([sub.coordinates.lat, sub.coordinates.lng], {
          icon: createCustomIcon(sub.highlight),
        })
          .addTo(map)
          .bindPopup(
            `<div style="min-width:160px"><b>${sub.name}</b>${sub.highlight ? `<br/><em style="color:#5A5A40">${sub.highlight}</em>` : ""}<br/><small>${sub.description}</small></div>`
          );
        markers.push(marker);
      }

      // Fit bounds
      if (markers.length > 1) {
        const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    mapInstanceRef.current = map;

    // Fix leaflet sizing
    setTimeout(() => map.invalidateSize(), 150);
  }, [isOpen, activeTab, details, activity.coordinates, activity.name, activity.address]);

  useEffect(() => {
    initMap();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [initMap]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Focus chat input when switching to chat tab
  useEffect(() => {
    if (activeTab === "chat") {
      setTimeout(() => chatInputRef.current?.focus(), 200);
    }
  }, [activeTab]);

  const handleSendMessage = async (messageText?: string) => {
    const text = (messageText || chatInput).trim();
    if (!text || isChatLoading) return;

    const userMsg: ActivityChatMessage = { role: "user", text, timestamp: Date.now() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const res = await fetch("/api/activity-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activityName: activity.name,
          activityDescription: activity.description,
          category: activity.category,
          destination,
          conversationHistory: [...chatMessages, userMsg].slice(-10).map((m) => ({ role: m.role, text: m.text })),
          userMessage: text,
        }),
      });
      if (!res.ok) throw new Error("Chat failed");
      const { reply } = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", text: reply, timestamp: Date.now() }]);
    } catch {
      setChatMessages((prev) => [...prev, {
        role: "assistant",
        text: "I'm sorry, I couldn't connect right now. Please try again in a moment! 🗺️",
        timestamp: Date.now(),
      }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const openInGoogleMaps = () => {
    const url = activity.googleMapsUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${activity.name}, ${destination}`)}`;
    window.open(url, "_blank");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-[#e5e5df]">
        {/* Header */}
        <div className="flex-shrink-0 p-5 sm:p-6 border-b border-[#e5e5df] bg-gradient-to-b from-[#f5f5f0] to-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                  <Compass className="w-3 h-3" />
                  <span>{activity.category}</span>
                </span>
                {activity.rating && (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    <span>{activity.rating}</span>
                  </span>
                )}
                {activity.approxCost && (
                  <span className="text-[11px] font-medium text-[#6b6b5e] bg-[#f5f5f0] px-2 py-0.5 rounded-full border border-[#e5e5df]">
                    {activity.approxCost}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-normal italic text-[#2c2c24] leading-snug">
                {activity.name}
              </h2>
              {activity.address && (
                <p className="text-xs text-[#8a8a7e] mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {activity.address}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[#ecece4] text-[#8a8a7e] hover:text-[#2c2c24] transition-colors shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-[#5A5A40] text-white shadow-xs"
                    : "bg-white text-[#6b6b5e] border border-[#e5e5df] hover:border-[#5A5A40] hover:text-[#5A5A40]"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {isLoadingDetails && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-[#5A5A40] animate-spin" />
                <p className="text-sm text-[#8a8a7e] font-serif italic">Curating local insights...</p>
              </div>
            </div>
          )}

          {!isLoadingDetails && detailsError && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Info className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-[#6b6b5e]">Could not load details. Try the chat tab for information!</p>
              </div>
            </div>
          )}

          {!isLoadingDetails && details && (
            <>
              {/* LOCATION TAB */}
              {activeTab === "location" && (
                <div className="space-y-4">
                  {/* Map */}
                  <div
                    ref={mapContainerRef}
                    className="w-full h-64 sm:h-80 rounded-2xl border border-[#e5e5df] overflow-hidden"
                  />

                  {/* Sub-locations list */}
                  {details.subLocations && details.subLocations.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#8a8a7e]">
                        {details.subLocations.length > 1 ? "Key spots to visit" : "Location"}
                      </h4>
                      <div className="space-y-2">
                        {details.subLocations.map((sub, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 bg-[#f5f5f0] rounded-xl border border-[#e5e5df]"
                          >
                            <div className="w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-serif italic text-sm text-[#2c2c24] font-medium">
                                  {sub.name}
                                </span>
                                {sub.highlight && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                                    {sub.highlight}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#6b6b5e] mt-0.5">{sub.description}</p>
                              {sub.address && (
                                <p className="text-[10px] text-[#8a8a7e] mt-0.5 flex items-center gap-1">
                                  <Navigation className="w-2.5 h-2.5" />
                                  {sub.address}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quick actions */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={openInGoogleMaps}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#5A5A40] text-white text-xs font-medium hover:bg-[#4a4a35] transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Open in Google Maps
                    </button>
                    {activity.ticketUrl && (
                      <a
                        href={activity.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#5A5A40] text-xs font-medium border border-[#d1d1ca] hover:border-[#5A5A40] transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Tickets / Booking
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* ABOUT TAB */}
              {activeTab === "about" && (
                <div className="space-y-5">
                  {/* Detailed Description */}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-[#8a8a7e] mb-2">
                      About this place
                    </h4>
                    <div className="text-sm text-[#2c2c24] leading-relaxed whitespace-pre-line font-sans">
                      {details.detailedDescription}
                    </div>
                  </div>

                  {/* Historical Context */}
                  {details.historicalContext && (
                    <div className="bg-[#ecece4]/60 rounded-2xl p-4 border border-[#d1d1ca]">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#5A5A40] mb-1.5 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5" />
                        Historical Context
                      </h4>
                      <p className="text-sm text-[#2c2c24] font-serif italic leading-relaxed">
                        {details.historicalContext}
                      </p>
                    </div>
                  )}

                  {/* Practical Tips */}
                  {details.practicalTips && details.practicalTips.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-[#8a8a7e] mb-2">
                        Practical Tips
                      </h4>
                      <div className="space-y-1.5">
                        {details.practicalTips.map((tip, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 text-xs text-[#2c2c24] bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e5df]"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Insider Tip from original card */}
                  {activity.insiderTip && (
                    <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-amber-800 mb-1.5 flex items-center gap-1.5">
                        <Lightbulb className="w-3.5 h-3.5" />
                        Insider Note
                      </h4>
                      <p className="text-sm text-amber-900 font-serif italic">
                        {activity.insiderTip}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ANECDOTES TAB */}
              {activeTab === "anecdotes" && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-[#8a8a7e]">
                    Fascinating Stories & Facts
                  </h4>
                  <div className="space-y-3">
                    {details.anecdotes.map((anecdote, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df] relative"
                      >
                        <div className="absolute -top-2 -left-1 w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-[#2c2c24] leading-relaxed ml-4 font-sans">
                          {anecdote}
                        </p>
                      </div>
                    ))}
                  </div>

                  {details.anecdotes.length === 0 && (
                    <p className="text-sm text-[#8a8a7e] font-serif italic text-center py-8">
                      No anecdotes available for this place yet.
                    </p>
                  )}
                </div>
              )}

              {/* CHAT TAB */}
              {activeTab === "chat" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-[#ecece4]/60 rounded-xl border border-[#d1d1ca]">
                    <MessageCircle className="w-4 h-4 text-[#5A5A40]" />
                    <p className="text-xs text-[#2c2c24]">
                      <span className="font-semibold">Your Local Guide</span> — Ask anything about {activity.name} and the surrounding area!
                    </p>
                  </div>

                  {/* Chat Messages */}
                  <div className="space-y-3 min-h-[200px] max-h-[320px] overflow-y-auto p-3 bg-[#f5f5f0] rounded-2xl border border-[#e5e5df]">
                    {chatMessages.length === 0 && (
                      <div className="text-center py-6">
                        <MessageCircle className="w-8 h-8 text-[#8a8a7e] mx-auto mb-2" />
                        <p className="text-xs text-[#8a8a7e] font-serif italic">
                          Start a conversation with your local guide!
                        </p>
                      </div>
                    )}

                    {chatMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            msg.role === "user"
                              ? "bg-[#5A5A40] text-white rounded-br-md"
                              : "bg-white text-[#2c2c24] border border-[#e5e5df] rounded-bl-md shadow-xs"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    ))}

                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white text-[#8a8a7e] px-3.5 py-2.5 rounded-2xl rounded-bl-md border border-[#e5e5df] flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span className="text-xs font-serif italic">Typing...</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Suggested Questions */}
                  {details.suggestedQuestions && details.suggestedQuestions.length > 0 && chatMessages.length < 3 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2">
                        Suggested Questions
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {details.suggestedQuestions.map((q, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(q)}
                            disabled={isChatLoading}
                            className="px-3 py-1.5 rounded-full text-[11px] font-medium bg-white text-[#5A5A40] border border-[#d1d1ca] hover:border-[#5A5A40] hover:bg-[#ecece4] transition-all disabled:opacity-50"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chat Input */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={chatInputRef}
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={handleChatKeyDown}
                      placeholder="Ask your local guide anything..."
                      disabled={isChatLoading}
                      className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-[#d1d1ca] bg-white focus:outline-none focus:border-[#5A5A40] focus:ring-1 focus:ring-[#5A5A40]/30 disabled:opacity-50 placeholder:text-[#8a8a7e]"
                    />
                    <button
                      onClick={() => handleSendMessage()}
                      disabled={!chatInput.trim() || isChatLoading}
                      className="p-2.5 rounded-xl bg-[#5A5A40] text-white hover:bg-[#4a4a35] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
