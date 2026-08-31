import React, { useState, useEffect, useRef } from "react";
import L from "leaflet";
import {
  ActivitySpot,
  ActivityDeepDetails,
  SubSpotPin,
  ActivityChatMessage,
  ActivityCategory,
} from "../types";
import { escapeHtml } from "../utils/offlineStorage";
import {
  X,
  MapPin,
  ExternalLink,
  Sparkles,
  BookOpen,
  History,
  Compass,
  Camera,
  Clock,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Flame,
  Quote,
  Lightbulb,
  CheckCircle2,
  Info,
  Layers,
  HelpCircle,
  Footprints,
  Link2,
  Plus,
  Trash2,
  Globe,
  Ticket,
  Navigation,
  Volume2,
  Square,
} from "lucide-react";
import { getCuratedPhotosForSpot, generateGoogleMapsSearchUrl } from "../utils/destinations";
import { formatSpotForGoogleMaps } from "../utils/transit";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText, useTranslateText, useTranslateArray } from "./TranslatedText";

interface ActivityDetailModalProps {
  spot: ActivitySpot;
  destination: string;
  dayNumber?: number;
  onClose: () => void;
}

const CATEGORY_STYLES: Record<
  ActivityCategory,
  { label: string; bg: string; text: string; border: string; iconBg: string }
> = {
  food: {
    label: "Dining & Flavors",
    bg: "bg-amber-50 text-amber-900 border-amber-200",
    text: "text-amber-800",
    border: "border-amber-300",
    iconBg: "#c86446",
  },
  nature: {
    label: "Nature & Outdoors",
    bg: "bg-emerald-50 text-emerald-900 border-emerald-200",
    text: "text-emerald-800",
    border: "border-emerald-300",
    iconBg: "#4a6b53",
  },
  culture: {
    label: "Culture & Heritage",
    bg: "bg-stone-100 text-stone-900 border-stone-300",
    text: "text-stone-800",
    border: "border-stone-400",
    iconBg: "#5A5A40",
  },
  sightseeing: {
    label: "Sightseeing Landmark",
    bg: "bg-sky-50 text-sky-900 border-sky-200",
    text: "text-sky-800",
    border: "border-sky-300",
    iconBg: "#657786",
  },
  "hidden-gem": {
    label: "Hidden Gem",
    bg: "bg-amber-100/70 text-amber-950 border-amber-300",
    text: "text-amber-900",
    border: "border-amber-400",
    iconBg: "#c68a3c",
  },
  shopping: {
    label: "Local Shopping",
    bg: "bg-rose-50 text-rose-900 border-rose-200",
    text: "text-rose-800",
    border: "border-rose-300",
    iconBg: "#9b5e72",
  },
  relaxation: {
    label: "Relaxation & Wellness",
    bg: "bg-teal-50 text-teal-900 border-teal-200",
    text: "text-teal-800",
    border: "border-teal-300",
    iconBg: "#5d8a82",
  },
  nightlife: {
    label: "Evening & Nightlife",
    bg: "bg-purple-50 text-purple-900 border-purple-200",
    text: "text-purple-800",
    border: "border-purple-300",
    iconBg: "#504b6b",
  },
  cafe: {
    label: "Café & Coffee",
    bg: "bg-stone-100 text-stone-900 border-stone-300",
    text: "text-stone-800",
    border: "border-stone-400",
    iconBg: "#8a6d4b",
  },
  entertainment: {
    label: "Entertainment",
    bg: "bg-pink-50 text-pink-900 border-pink-200",
    text: "text-pink-800",
    border: "border-pink-300",
    iconBg: "#9e4c5b",
  },
};

export const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  spot,
  destination,
  dayNumber,
  onClose,
}) => {
  const { t, language } = useLanguage();
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [details, setDetails] = useState<ActivityDeepDetails | null>(null);
  const [realPhotos, setRealPhotos] = useState<string[]>([]);
  const [currentPhotoIdx, setCurrentPhotoIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"overview" | "links" | "location" | "anecdotes" | "chat">("overview");

  // Speech Synthesis Audio Reader State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  const sanitizeTextForSpeech = (raw: string): string => {
    if (!raw) return "";
    return raw
      .replace(/#{1,6}\s+/g, "") // remove markdown headers
      .replace(/\*\*|\*|__|(_)/g, "") // remove bold/italic markdown
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // convert markdown links [text](url) -> text
      .replace(/[-*]\s+/g, ". — ") // convert list markers to expressive pauses
      .replace(/>/g, "") // remove blockquote markers
      .replace(/[`~#*_\\]/g, "") // remove markdown symbols like backticks, tildes, hashes, asterisks, underscores, backslashes
      .replace(/([.?!;:])\s*/g, "$1 ... ") // inject natural prosody pauses after sentences and clauses
      .trim();
  };

  const getSpeechLangTag = (lang: string): string => {
    switch (lang) {
      case "es": return "es-ES";
      case "eu": return "eu-ES";
      case "fr": return "fr-FR";
      case "de": return "de-DE";
      case "it": return "it-IT";
      case "pt": return "pt-PT";
      case "ja": return "ja-JP";
      case "zh": return "zh-CN";
      case "ar": return "ar-SA";
      default: return "en-US";
    }
  };

  const configureUtteranceVoice = (utterance: SpeechSynthesisUtterance) => {
    const langTag = getSpeechLangTag(language);
    utterance.lang = langTag;

    const persona = localStorage.getItem("localexplorer_voice_persona") || "aria";
    const speedStr = localStorage.getItem("localexplorer_voice_speed") || "0.95";
    const speed = parseFloat(speedStr) || 0.95;

    utterance.rate = speed;

    if (persona === "orion") utterance.pitch = 0.85;
    else if (persona === "atlas") utterance.pitch = 0.80;
    else if (persona === "nova") utterance.pitch = 1.15;
    else if (persona === "zephyr") utterance.pitch = 0.95;
    else if (persona === "sol") utterance.pitch = 1.05;
    else utterance.pitch = 1.08;

    try {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const langVoices = voices.filter(
          (v) => v.lang === langTag || v.lang.startsWith(language) || v.lang.replace("_", "-").startsWith(language)
        );

        const isFemale = ["aria", "nova", "sol"].includes(persona);
        const isMale = ["orion", "zephyr", "atlas"].includes(persona);

        let matched = null;
        if (isFemale) {
          matched = langVoices.find((v) => /female|woman|zira|victoria|samantha|karen|aria|nova|google.*female/i.test(v.name));
        } else if (isMale) {
          matched = langVoices.find((v) => /male|man|david|george|daniel|mark|orion|atlas|google.*male/i.test(v.name));
        }

        if (!matched) {
          matched = langVoices.find((v) => /natural|neural|enhanced|google|siri|premium|online/i.test(v.name));
        }

        if (matched || langVoices[0]) {
          utterance.voice = matched || langVoices[0];
        }
      }
    } catch {}
  };

  const handleToggleSpeech = () => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      const rawText = [
        spot.name,
        details?.headline || spot.description,
        details?.fullExplanation || "",
        details?.insiderTip || spot.insiderTip || "",
        details?.historicalContext || "",
      ]
        .filter(Boolean)
        .join(". ");

      const textToRead = sanitizeTextForSpeech(rawText);

      const utterance = new SpeechSynthesisUtterance(textToRead);
      configureUtteranceVoice(utterance);

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    }
  };

  const handleToggleMessageSpeech = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported in your browser.");
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
    } else {
      window.speechSynthesis.cancel();
      const cleanText = sanitizeTextForSpeech(text);
      const utterance = new SpeechSynthesisUtterance(cleanText);
      configureUtteranceVoice(utterance);

      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);

      window.speechSynthesis.speak(utterance);
      setSpeakingMessageId(msgId);
    }
  };

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Useful Custom User Links State
  const [customUserLinks, setCustomUserLinks] = useState<Array<{ id: string; title: string; url: string; category?: string }>>(() => {
    try {
      const saved = localStorage.getItem(`act_user_links_${spot.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);

  const handleAddCustomLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    const newLink = {
      id: "link-" + Date.now(),
      title: newLinkTitle.trim(),
      url,
      category: "custom",
    };
    const updated = [...customUserLinks, newLink];
    setCustomUserLinks(updated);
    try {
      localStorage.setItem(`act_user_links_${spot.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
    setNewLinkTitle("");
    setNewLinkUrl("");
    setShowAddLinkForm(false);
  };

  const handleDeleteCustomLink = (linkId: string) => {
    const updated = customUserLinks.filter((l) => l.id !== linkId);
    setCustomUserLinks(updated);
    try {
      localStorage.setItem(`act_user_links_${spot.id}`, JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  // Dynamic Chat Follow-up Suggestions State
  const [dynamicFollowUps, setDynamicFollowUps] = useState<string[]>([
    "Can you tell any a random quote about this place?",
    "Why was this made?",
    "What is a hidden secret here that tourists miss?",
    "What should I taste or drink nearby?",
  ]);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ActivityChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  // Fetch Real Place Photos from Wikimedia Commons & Wikipedia
  useEffect(() => {
    let isCancelled = false;
    async function loadRealPhotos() {
      try {
        const queryParams = new URLSearchParams({
          spotName: spot.name,
          destination: destination,
          category: spot.category || "",
          lat: String(spot.coordinates?.lat || ""),
          lng: String(spot.coordinates?.lng || ""),
        });
        const res = await fetch(`/api/place-photos?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.photos && data.photos.length > 0) {
            setRealPhotos(data.photos);
          }
        }
      } catch (err) {
        console.warn("Failed to load real photos:", err);
      }
    }
    loadRealPhotos();
    return () => {
      isCancelled = true;
    };
  }, [spot.name, destination, spot.category, spot.coordinates]);

  // User Custom Photos from publishing or local contribution
  const [userCustomPhotos, setUserCustomPhotos] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`act_user_photos_${spot.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Resolved Images list prioritizing user photos and community photos
  const rawPhotos = [
    ...userCustomPhotos,
    ...(spot.photos || []),
    ...realPhotos,
    ...(details?.photos || []),
    ...getCuratedPhotosForSpot(spot.category, spot.name, destination),
  ];
  const photos = rawPhotos.filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);

  const categoryStyle = CATEGORY_STYLES[spot.category] || CATEGORY_STYLES.sightseeing;

  // Prevent background scrolling while modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  // Deterministic Cache Keys for storing activity details
  const cleanDest = destination.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const cleanSpot = spot.name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
  const cacheKeyPrimary = `act_details_cache_${cleanDest}_${spot.id || cleanSpot}`;
  const cacheKeyFallback = `act_details_cache_${cleanDest}_${cleanSpot}`;

  // Helper to persist current card state into localStorage
  const saveToLocalStorageCache = (
    deepDetails: ActivityDeepDetails,
    photosList: string[],
    followUps: string[],
    chatHist: ActivityChatMessage[]
  ) => {
    try {
      const payload = JSON.stringify({
        details: deepDetails,
        realPhotos: photosList,
        dynamicFollowUps: followUps,
        chatMessages: chatHist,
        timestamp: Date.now(),
      });
      localStorage.setItem(cacheKeyPrimary, payload);
      localStorage.setItem(cacheKeyFallback, payload);
    } catch (err) {
      console.warn("Cache save error:", err);
    }
  };

  // Fetch or retrieve cached Deep Activity Details
  useEffect(() => {
    let isCancelled = false;

    async function loadDetails() {
      // 1. Check local storage cache first
      try {
        const cachedRaw = localStorage.getItem(cacheKeyPrimary) || localStorage.getItem(cacheKeyFallback);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.details) {
            setDetails(cached.details);
            if (cached.realPhotos && cached.realPhotos.length > 0) {
              setRealPhotos(cached.realPhotos);
            }
            if (cached.dynamicFollowUps && cached.dynamicFollowUps.length > 0) {
              setDynamicFollowUps(cached.dynamicFollowUps);
            }
            if (cached.chatMessages && cached.chatMessages.length > 0) {
              setChatMessages(cached.chatMessages);
            } else {
              setChatMessages([
                {
                  id: "welcome-" + Date.now(),
                  sender: "guide",
                  text: `Kaixo & Hello! I'm your dedicated local guide for **${spot.name}** in ${destination}. Ask me anything about its historical origins, architectural secrets, famous quotes, or local recommendations!`,
                  timestamp: Date.now(),
                },
              ]);
            }
            setLoadingDetails(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Failed to parse cached details:", err);
      }

      setLoadingDetails(true);
      try {
        const res = await fetch("/api/activity-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            spotName: spot.name,
            destination: destination,
            category: spot.category,
            address: spot.address,
            description: spot.description,
            coordinates: spot.coordinates,
          }),
        });

        if (res.ok) {
          const data: ActivityDeepDetails = await res.json();
          if (!isCancelled) {
            setDetails(data);
            const photosToUse = data.photos && data.photos.length > 0 && realPhotos.length === 0 ? data.photos : realPhotos;
            if (data.photos && data.photos.length > 0 && realPhotos.length === 0) {
              setRealPhotos(data.photos);
            }
            const followUpsToUse = data.suggestedQuestions && data.suggestedQuestions.length > 0 ? data.suggestedQuestions : dynamicFollowUps;
            if (data.suggestedQuestions && data.suggestedQuestions.length > 0) {
              setDynamicFollowUps(data.suggestedQuestions);
            }
            const initialChat: ActivityChatMessage[] = [
              {
                id: "welcome-" + Date.now(),
                sender: "guide",
                text: `Kaixo & Hello! I'm your dedicated local guide for **${spot.name}** in ${destination}. Ask me anything about its historical origins, architectural secrets, famous quotes, or local recommendations!`,
                timestamp: Date.now(),
              },
            ];
            setChatMessages(initialChat);

            // Save to cache
            saveToLocalStorageCache(data, photosToUse, followUpsToUse, initialChat);
          }
        }
      } catch (err) {
        console.error("Failed to load activity deep details:", err);
      } finally {
        if (!isCancelled) setLoadingDetails(false);
      }
    }

    loadDetails();
    return () => {
      isCancelled = true;
    };
  }, [spot.id, spot.name, destination, spot.category, spot.address, spot.description, spot.coordinates]);

  // Leaflet Map Initialization & Sub-spot rendering
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const baseCoords = details?.coordinates || spot.coordinates || { lat: 43.1839, lng: -2.2642 };

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [baseCoords.lat, baseCoords.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "topright" }).addTo(map);
      L.control.attribution({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      markersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    const bounds = L.latLngBounds([baseCoords.lat, baseCoords.lng], [baseCoords.lat, baseCoords.lng]);

    // 1. Main Spot Marker
    const mainIcon = L.divIcon({
      className: "custom-map-marker",
      html: `
        <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
          <div class="absolute -inset-2 bg-stone-900/20 rounded-full blur-xs"></div>
          <div class="relative w-10 h-10 rounded-full flex items-center justify-center text-white shadow-xl border-2 border-white ring-2 ring-stone-900/30 transition-transform group-hover:scale-110" style="background-color: ${categoryStyle.iconBg}">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    const mainMarker = L.marker([baseCoords.lat, baseCoords.lng], { icon: mainIcon });
    mainMarker.bindPopup(`
      <div class="p-1 max-w-xs font-sans text-xs">
        <p class="font-bold text-stone-900 text-sm mb-0.5">${escapeHtml(spot.name)}</p>
        <p class="text-stone-600 mb-1">${escapeHtml(details?.exactAddress || spot.address || destination)}</p>
        <span class="inline-block px-1.5 py-0.5 bg-stone-100 text-stone-800 rounded font-medium text-[10px]">Primary Location</span>
      </div>
    `);
    markersGroup.addLayer(mainMarker);

    // 2. Sub-spot Markers (for walks, districts, complexes)
    if (details?.subSpots && details.subSpots.length > 0) {
      details.subSpots.forEach((sub, idx) => {
        if (!sub.coordinates) return;
        bounds.extend([sub.coordinates.lat, sub.coordinates.lng]);

        const subIcon = L.divIcon({
          className: "custom-sub-marker",
          html: `
            <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
              <div class="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shadow-lg border-2 border-white ring-1 ring-stone-700/40 transition-transform group-hover:scale-115">
                ${idx + 1}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const subMarker = L.marker([sub.coordinates.lat, sub.coordinates.lng], { icon: subIcon });
        subMarker.bindPopup(`
          <div class="p-1.5 max-w-xs font-sans text-xs">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="w-5 h-5 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-[10px]">${idx + 1}</span>
              <p class="font-bold text-stone-900 text-sm leading-tight">${escapeHtml(sub.name)}</p>
            </div>
            <p class="text-stone-600 text-xs mb-1.5 leading-relaxed">${escapeHtml(sub.description)}</p>
            ${sub.mustSeeReason ? `<p class="text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 text-[11px] font-medium"><strong class="text-amber-900">Must-see:</strong> ${escapeHtml(sub.mustSeeReason)}</p>` : ""}
          </div>
        `);
        markersGroup.addLayer(subMarker);
      });

      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else {
      map.setView([baseCoords.lat, baseCoords.lng], 16);
    }

    // Invalidate map size to ensure clean render
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  }, [details, spot.coordinates, spot.name, spot.address, destination, categoryStyle.iconBg, activeTab]);

  // Clean up Leaflet map instance on modal unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersGroupRef.current = null;
      }
    };
  }, []);

  // Handle Send Chat
  const handleSendChat = async (textToSend?: string) => {
    const query = (textToSend || chatInput).trim();
    if (!query || isSendingChat) return;

    const userMsg: ActivityChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: query,
      timestamp: Date.now(),
    };

    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput("");
    setIsSendingChat(true);

    try {
      const res = await fetch("/api/activity-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory.map((m) => ({
            role: m.sender === "user" ? "user" : "model",
            text: m.text,
          })),
          spotContext: {
            spotName: spot.name,
            destination: destination,
            category: spot.category,
            address: details?.exactAddress || spot.address,
            headline: details?.headline || "",
            fullExplanation: details?.fullExplanation || spot.description,
            historicalContext: details?.historicalContext || "",
            anecdotes: details?.anecdotes || [],
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const guideMsg: ActivityChatMessage = {
          id: "guide-" + Date.now(),
          sender: "guide",
          text: data.reply || "I'd be glad to help with any more details on this place!",
          timestamp: Date.now(),
        };

        const updatedHistory = [...newHistory, guideMsg];
        setChatMessages(updatedHistory);

        let followUpsToSave = dynamicFollowUps;
        if (Array.isArray(data.followUpQuestions) && data.followUpQuestions.length > 0) {
          followUpsToSave = data.followUpQuestions;
          setDynamicFollowUps(data.followUpQuestions);
        }

        if (details) {
          saveToLocalStorageCache(details, realPhotos, followUpsToSave, updatedHistory);
        }
      } else {
        throw new Error("Chat request failed");
      }
    } catch (err) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: "err-" + Date.now(),
          sender: "guide",
          text: "I'm experiencing a brief network hiccup, but I'm right here! Feel free to re-ask or explore the tabs above.",
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsSendingChat(false);
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const mapsUrl = details?.googleMapsUrl || spot.googleMapsUrl || generateGoogleMapsSearchUrl(spot.name, destination, spot.address, spot.coordinates);

  return (
    <div
      className="fixed inset-0 z-50 bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-detail-title"
    >
      <div className="relative w-full max-w-4xl bg-[#faf9f5] border border-stone-300/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto">
        {/* Modal Top Bar */}
        <div className="sticky top-0 z-30 bg-[#faf9f5]/95 backdrop-blur-md px-5 py-3.5 border-b border-stone-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${categoryStyle.bg}`}
            >
              {t(`category.${spot.category}`, categoryStyle.label)}
            </span>
            {dayNumber && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-stone-200/80 text-stone-700">
                Day {dayNumber}
              </span>
            )}
            {spot.time && (
              <span className="hidden md:inline-flex items-center gap-1 text-xs font-medium text-stone-500">
                <Clock className="w-3.5 h-3.5" />
                {spot.time}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleSpeech}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isSpeaking
                  ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse shadow-xs"
                  : "bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-300"
              }`}
              title={isSpeaking ? "Stop reading voice" : "Listen to audio guide"}
            >
              {isSpeaking ? (
                <>
                  <Square className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-stone-600" />
                  <span>Listen Guide</span>
                </>
              )}
            </button>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 border border-stone-300 transition-colors"
              title="Open in Google Maps"
            >
              <MapPin className="w-3.5 h-3.5 text-red-600" />
              <span>Google Maps</span>
              <ExternalLink className="w-3 h-3 text-stone-400" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-200/60 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 divide-y divide-stone-200">
          {/* 2.0 Image Gallery Banner (Google Maps style) */}
          <div className="relative bg-stone-900 aspect-16/9 sm:aspect-21/9 max-h-72 w-full overflow-hidden group select-none">
            {photos.length > 0 ? (
              <img
                src={photos[currentPhotoIdx]}
                alt={`${spot.name} photo ${currentPhotoIdx + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-stone-800 text-stone-400">
                <Camera className="w-12 h-12 stroke-[1.5]" />
              </div>
            )}

            {/* Real Location Photography / Traveler Contributed Badge */}
            {userCustomPhotos.length > 0 ? (
              <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-amber-300 border border-amber-500/30 flex items-center gap-1.5 shadow-md">
                <Camera className="w-3 h-3 text-amber-400" />
                <span>Traveler Contributed Photos</span>
              </div>
            ) : realPhotos.length > 0 ? (
              <div className="absolute top-3 left-3 bg-stone-900/85 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-semibold text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-md">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>Authentic Spot Photography</span>
              </div>
            ) : null}

            {/* Gradient Overlay & Title */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-5 sm:p-6 text-white">
              <div className="max-w-2xl">
                <p className="text-xs sm:text-sm font-medium text-stone-300 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  {destination}
                </p>
                <h2
                  id="activity-detail-title"
                  className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white drop-shadow-sm"
                >
                  <TranslatedText text={spot.name} />
                </h2>
                {details?.headline && (
                  <p className="text-sm text-stone-200 mt-1 line-clamp-1 italic font-serif flex items-start gap-0.5">
                    <span>"</span>
                    <TranslatedText text={details.headline} />
                    <span>"</span>
                  </p>
                )}
              </div>
            </div>

            {/* Photo Navigation Arrows */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() =>
                    setCurrentPhotoIdx((prev) =>
                      prev === 0 ? photos.length - 1 : prev - 1
                    )
                  }
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-opacity opacity-80 group-hover:opacity-100"
                  aria-label="Previous photo"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() =>
                    setCurrentPhotoIdx((prev) =>
                      prev === photos.length - 1 ? 0 : prev + 1
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs transition-opacity opacity-80 group-hover:opacity-100"
                  aria-label="Next photo"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                {/* Photo indicator pills */}
                <div className="absolute bottom-3 right-4 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-full text-xs font-medium text-stone-200">
                  {currentPhotoIdx + 1} / {photos.length}
                </div>
              </>
            )}
          </div>

          {/* Quick Info & Navigation Tabs */}
          <div className="bg-[#f4f2ea] px-4 sm:px-5 py-3 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
            {/* Tab navigation buttons */}
            <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 rounded-xl">
              <button
                onClick={() => setActiveTab("overview")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "overview"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <span className="whitespace-nowrap">{t("detail.storyAndDetails")}</span>
              </button>
              <button
                onClick={() => setActiveTab("location")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "location"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <span className="whitespace-nowrap">{t("detail.exactLocation")}</span>
                {details?.subSpots && details.subSpots.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-[#5A5A40] text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                    {details.subSpots.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("anecdotes")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "anecdotes"
                    ? "bg-white text-stone-900 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <span className="whitespace-nowrap">{t("detail.anecdotes")}</span>
              </button>
              <button
                onClick={() => setActiveTab("links")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "links"
                    ? "bg-white text-stone-900 shadow-xs font-bold"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Link2 className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <span className="whitespace-nowrap">Useful Links</span>
                {customUserLinks.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-900 text-[10px] flex items-center justify-center font-bold shrink-0">
                    {customUserLinks.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeTab === "chat"
                    ? "bg-white text-[#5A5A40] shadow-xs font-bold ring-1 ring-[#5A5A40]/30"
                    : "text-stone-700 hover:text-stone-900 font-semibold"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                <span className="whitespace-nowrap">{t("detail.askGuide")}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
              </button>
            </div>

            {/* Practical Metadata pills */}
            <div className="flex items-center gap-2 text-xs text-stone-600">
              {spot.approxCost && (
                <span className="px-2 py-0.5 rounded bg-stone-200/80 font-medium text-stone-700">
                  {spot.approxCost}
                </span>
              )}
              {details?.recommendedDuration && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-200/80 font-medium text-stone-700">
                  <Clock className="w-3 h-3 text-stone-500 shrink-0" />
                  {details.recommendedDuration}
                </span>
              )}
            </div>
          </div>

          {/* Tab 1: Overview & Full In-Depth Story */}
          {activeTab === "overview" && (
            <div className="p-5 sm:p-7 space-y-6">
              {loadingDetails ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-500">
                  <Loader2 className="w-7 h-7 animate-spin text-[#5A5A40]" />
                  <p className="text-sm font-medium">{t("detail.loading")}</p>
                </div>
              ) : (
                <>
                  {/* Comprehensive Explanation */}
                  <div className="space-y-3">
                    <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#5A5A40] shrink-0" />
                      {t("detail.aboutExperience")}
                    </h3>
                    <div className="text-stone-700 text-sm sm:text-base leading-relaxed font-sans whitespace-pre-line">
                      <TranslatedText text={details?.fullExplanation || spot.description || ""} />
                    </div>
                  </div>

                  {/* Historical & Cultural Deep Dive Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Historical Context */}
                    <div className="bg-white p-4.5 rounded-xl border border-stone-200/90 shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-[#5A5A40]">
                        <History className="w-4 h-4 shrink-0" />
                        <h4 className="font-serif font-bold text-stone-900 text-sm">
                          {t("detail.historicalContext")}
                        </h4>
                      </div>
                      <div className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        <TranslatedText
                          text={
                            details?.historicalContext ||
                            `Rooted in the rich cultural history of ${destination}, this venue represents generations of local heritage.`
                          }
                        />
                      </div>
                    </div>

                    {/* Cultural Significance */}
                    <div className="bg-white p-4.5 rounded-xl border border-stone-200/90 shadow-xs space-y-2">
                      <div className="flex items-center gap-2 text-[#5A5A40]">
                        <Compass className="w-4 h-4 shrink-0" />
                        <h4 className="font-serif font-bold text-stone-900 text-sm">
                          {t("detail.culturalSignificance")}
                        </h4>
                      </div>
                      <div className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                        <TranslatedText
                          text={
                            details?.culturalSignificance ||
                            `A beloved cornerstone of local life that offers authentic immersion into the spirit of ${destination}.`
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Highlights to look out for */}
                  {details?.architecturalOrNaturalHighlights && (
                    <div className="bg-[#f5f3eb] p-4.5 rounded-xl border border-stone-300/80 space-y-2">
                      <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-700 shrink-0" />
                        {t("detail.visualHighlights")}
                      </h4>
                      <div className="text-xs sm:text-sm text-stone-700 leading-relaxed">
                        <TranslatedText text={details.architecturalOrNaturalHighlights} />
                      </div>
                    </div>
                  )}

                  {/* What to Expect Bullets */}
                  {details?.whatToExpect && details.whatToExpect.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        {t("detail.whatToExpect")}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {details.whatToExpect.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2 bg-white px-3.5 py-2.5 rounded-lg border border-stone-200 text-xs sm:text-sm text-stone-700"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#5A5A40] mt-1.5 shrink-0"></span>
                            <span>
                              <TranslatedText text={item} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Practical Visiting Guide: Photography, Best Time, Insider Tip */}
                  <div className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs space-y-4">
                    <h4 className="font-serif font-bold text-stone-900 text-sm flex items-center gap-2 border-b border-stone-100 pb-2">
                      <Info className="w-4 h-4 text-[#5A5A40] shrink-0" />
                      {t("detail.practicalGuide")}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs sm:text-sm">
                      <div>
                        <p className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          {t("detail.bestTimeToVisit")}
                        </p>
                        <div className="text-stone-600">
                          <TranslatedText text={details?.bestTimeToVisit || "Morning or golden hour before sunset."} />
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                          {t("detail.photographyTip")}
                        </p>
                        <div className="text-stone-600">
                          <TranslatedText text={details?.photographyTips?.[0] || "Frame architectural details and warm natural lighting."} />
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold text-stone-900 mb-1 flex items-center gap-1.5">
                          <Flame className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          {t("detail.insiderSecret")}
                        </p>
                        <div className="text-stone-600">
                          <TranslatedText text={spot.insiderTip || details?.insiderAdvice?.[0] || "Take a moment to stroll the quieter adjacent lanes."} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CTA to Ask the Chatbot */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-[#5A5A40]/10 to-amber-500/10 border border-[#5A5A40]/20 flex items-center justify-between gap-4">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-[#5A5A40] uppercase tracking-wider truncate">
                        {t("detail.chatCtaTitle")}
                      </p>
                      <p className="text-xs sm:text-sm text-stone-700">
                        {t("detail.chatCtaDesc", { spot: spot.name })}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab("chat")}
                      className="px-4 py-2 bg-[#5A5A40] hover:bg-[#474732] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="whitespace-nowrap">{t("detail.chatWithGuide")}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Exact Location & Sub-Spots */}
          {activeTab === "location" && (
            <div className="p-5 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#5A5A40] shrink-0" />
                    {t("detail.exactCoords")}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    {details?.subSpots && details.subSpots.length > 0
                      ? `Pinned with ${details.subSpots.length} essential stops and landmarks inside this area.`
                      : `Exact geographical pin verified for ${destination}.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="font-mono bg-stone-100 text-stone-700 px-2.5 py-1 rounded-md border border-stone-300">
                    {details?.coordinates?.lat.toFixed(5)}, {details?.coordinates?.lng.toFixed(5)}
                  </span>
                </div>
              </div>

              {/* Interactive Mini Map */}
              <div className="relative w-full h-80 sm:h-96 rounded-xl overflow-hidden border border-stone-300 shadow-inner">
                <div ref={mapContainerRef} className="w-full h-full z-10" />
              </div>

              {/* Verified Street Address Banner */}
              <div className="bg-white p-3.5 rounded-xl border border-stone-200 flex items-center justify-between gap-3 text-xs sm:text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                  <span className="text-stone-700 font-medium truncate">
                    {details?.exactAddress || spot.address || `${spot.name}, ${destination}`}
                  </span>
                </div>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-md border border-stone-300 flex items-center gap-1.5 transition-colors"
                >
                  <span className="whitespace-nowrap">{t("detail.openMaps")}</span>
                  <ExternalLink className="w-3 h-3 text-stone-400 shrink-0" />
                </a>
              </div>

              {/* Sub-Spots List (For district walks, large parks, historic quarters) */}
              {details?.subSpots && details.subSpots.length > 0 ? (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Footprints className="w-4 h-4 text-[#5A5A40] shrink-0" />
                    <h4 className="font-serif font-bold text-stone-900 text-sm">
                      {t("detail.mustVisitWithin", { count: details.subSpots.length })}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {details.subSpots.map((sub, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-xl border border-stone-200/90 shadow-xs hover:border-[#5A5A40]/50 transition-all space-y-2"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-serif font-bold text-stone-900 text-sm leading-tight">
                              <TranslatedText text={sub.name} />
                            </h5>
                            {sub.address && (
                              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                                {sub.address}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-xs text-stone-600 leading-relaxed">
                          <TranslatedText text={sub.description} />
                        </div>

                        {sub.mustSeeReason && (
                          <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-200/80 text-amber-900 text-xs">
                            <strong className="font-semibold text-amber-950 mr-1">{t("detail.whyStopHere")}</strong>
                            <TranslatedText text={sub.mustSeeReason} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-[#f5f3eb] p-4 rounded-xl border border-stone-300/80 text-xs sm:text-sm text-stone-700">
                  <p className="font-semibold text-stone-900 mb-1">
                    {t("detail.singleLocation")}
                  </p>
                  <p className="text-stone-600">
                    {t("detail.singleLocationDesc")}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Useful Links & Resources */}
          {activeTab === "links" && (
            <div className="p-5 sm:p-7 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-200 pb-4">
                <div className="space-y-1">
                  <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-[#5A5A40] shrink-0" />
                    <span>Useful Links & Quick Access</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600">
                    Handy links for tickets, reviews, maps, transit, and personal notes for {spot.name}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddLinkForm(!showAddLinkForm)}
                  className="px-3.5 py-2 rounded-xl bg-[#5A5A40] hover:bg-[#474732] text-white text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Custom Link</span>
                </button>
              </div>

              {/* Add Custom Link Form */}
              {showAddLinkForm && (
                <form
                  onSubmit={handleAddCustomLink}
                  className="bg-[#fafaf7] p-4 rounded-2xl border border-stone-300 space-y-3 animate-fade-in"
                >
                  <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-[#5A5A40]" />
                    <span>Add New Useful Link</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        Link Title / Description
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Official Museum Audio Guide, PDF Ticket"
                        value={newLinkTitle}
                        onChange={(e) => setNewLinkTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                        URL Address
                      </label>
                      <input
                        type="url"
                        placeholder="e.g. https://example.com/guide"
                        value={newLinkUrl}
                        onChange={(e) => setNewLinkUrl(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddLinkForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#5A5A40] text-white text-xs font-semibold hover:bg-[#474732]"
                    >
                      Save Link
                    </button>
                  </div>
                </form>
              )}

              {/* Pre-configured Verified Useful Links Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Google Maps Location & Search */}
                <a
                  href={spot.googleMapsUrl || generateGoogleMapsSearchUrl(spot.name, destination, spot.address, spot.coordinates)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 transition-all group flex items-start justify-between shadow-2xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-red-50 text-red-600 border border-red-200 shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-stone-900 group-hover:text-red-700 transition-colors">
                        Google Maps Directions
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Open exact coordinates and satellite view in Maps
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-red-600 shrink-0 mt-1" />
                </a>

                {/* 2. Official Tickets & Booking */}
                <a
                  href={spot.ticketUrl || `https://www.google.com/search?q=${encodeURIComponent(spot.name + " " + destination + " official ticket booking")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 transition-all group flex items-start justify-between shadow-2xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                      <Ticket className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-stone-900 group-hover:text-amber-800 transition-colors">
                        {spot.ticketUrl ? "Official Ticket Booking" : "Ticket & Entry Search"}
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        {spot.ticketUrl ? "Direct link to reservation portal" : "Find entry fees and skip-the-line tickets"}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-amber-700 shrink-0 mt-1" />
                </a>

                {/* 3. TripAdvisor Reviews */}
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(spot.name + " " + destination + " site:tripadvisor.com reviews")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 transition-all group flex items-start justify-between shadow-2xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-stone-900 group-hover:text-emerald-800 transition-colors">
                        TripAdvisor Traveler Reviews
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Read recent traveler ratings and insider tips
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-emerald-700 shrink-0 mt-1" />
                </a>

                {/* 4. Public Transit Directions */}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${formatSpotForGoogleMaps(spot, destination)}&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-2xl border border-stone-200 bg-white hover:bg-stone-50 transition-all group flex items-start justify-between shadow-2xs"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-sm text-stone-900 group-hover:text-indigo-800 transition-colors">
                        Public Transit Routes
                      </h4>
                      <p className="text-xs text-stone-500 mt-0.5">
                        Bus, metro, and train schedules to location
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-stone-400 group-hover:text-indigo-700 shrink-0 mt-1" />
                </a>
              </div>

              {/* User Custom Links List */}
              {customUserLinks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-indigo-600" />
                    <span>Your Saved Links ({customUserLinks.length})</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {customUserLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 flex items-center justify-between group transition-all"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center space-x-2.5 min-w-0 flex-1 pr-2"
                        >
                          <Link2 className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div className="min-w-0">
                            <h5 className="font-semibold text-xs text-stone-900 truncate group-hover:text-indigo-800">
                              {link.title}
                            </h5>
                            <p className="text-[10px] text-stone-500 truncate font-mono">
                              {link.url}
                            </p>
                          </div>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteCustomLink(link.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-100 transition-colors shrink-0"
                          title="Delete custom link"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Anecdotes & Legends */}
          {activeTab === "anecdotes" && (
            <div className="p-5 sm:p-7 space-y-5">
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-bold text-stone-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                  {t("detail.anecdotesTitle")}
                </h3>
                <p className="text-xs sm:text-sm text-stone-600">
                  {t("detail.anecdotesDesc", { dest: destination })}
                </p>
              </div>

              {loadingDetails ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-stone-500">
                  <Loader2 className="w-7 h-7 animate-spin text-[#5A5A40]" />
                  <p className="text-sm font-medium">{t("detail.loading")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {details?.anecdotes?.map((anecdote, idx) => (
                    <div
                      key={idx}
                      className="bg-white p-5 rounded-xl border border-stone-200/90 shadow-xs space-y-2.5 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                              anecdote.type === "legend"
                                ? "bg-purple-50 text-purple-900 border-purple-200"
                                : anecdote.type === "quote"
                                ? "bg-amber-50 text-amber-900 border-amber-200"
                                : anecdote.type === "secret"
                                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                                : "bg-stone-100 text-stone-800 border-stone-300"
                            }`}
                          >
                            {anecdote.type === "quote" ? t("detail.quote") : anecdote.type}
                          </span>
                          <h4 className="font-serif font-bold text-stone-900 text-sm sm:text-base">
                            <TranslatedText text={anecdote.title} />
                          </h4>
                        </div>

                        {anecdote.sourceOrPeriod && (
                          <span className="text-[11px] text-stone-400 italic">
                            <TranslatedText text={anecdote.sourceOrPeriod} />
                          </span>
                        )}
                      </div>

                      <div className="flex items-start gap-3">
                        {anecdote.type === "quote" ? (
                          <Quote className="w-5 h-5 text-amber-600/70 shrink-0 mt-1" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-[#5A5A40] shrink-0 mt-1" />
                        )}
                        <p className="text-xs sm:text-sm text-stone-700 leading-relaxed italic font-serif flex items-start gap-0.5">
                          <span>"</span>
                          <TranslatedText text={anecdote.story} />
                          <span>"</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: AI Local Guide / Travel Agent Chatbot */}
          {activeTab === "chat" && (
            <div className="flex flex-col h-[520px] bg-[#faf9f5]">
              {/* Chat Header */}
              <div className="px-5 py-3 bg-[#f2eee3] border-b border-stone-200/90 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center font-serif font-bold text-xs shadow-xs shrink-0">
                    SS
                  </div>
                  <div>
                    <h4 className="font-serif font-bold text-stone-900 text-sm leading-tight flex items-center gap-1.5">
                      <span>{t("detail.guideHeader")}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    </h4>
                    <p className="text-[11px] text-stone-500">
                      {t("detail.guideSub", { spot: spot.name, dest: destination })}
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-stone-500 italic hidden sm:block">
                  {t("detail.guideHint")}
                </div>
              </div>

              {/* Chat Conversation Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 max-w-[88%] ${
                      msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1 ${
                        msg.sender === "user"
                          ? "bg-stone-800 text-white"
                          : "bg-[#5A5A40] text-white shadow-xs"
                      }`}
                    >
                      {msg.sender === "user" ? "You" : "LG"}
                    </div>

                    <div
                      className={`p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-xs relative group ${
                        msg.sender === "user"
                          ? "bg-stone-800 text-white rounded-tr-xs"
                          : "bg-white text-stone-800 border border-stone-200/90 rounded-tl-xs"
                      }`}
                    >
                      {msg.sender === "user" ? (
                        <p className="whitespace-pre-line font-sans">{msg.text}</p>
                      ) : (
                        <div className="whitespace-pre-line font-sans">
                          <TranslatedText text={msg.text} />
                        </div>
                      )}

                      <div className="mt-2 pt-2 border-t border-stone-200/40 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleMessageSpeech(msg.id, msg.text)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer ${
                            speakingMessageId === msg.id
                              ? "bg-amber-100 text-amber-900 border border-amber-300 animate-pulse"
                              : msg.sender === "user"
                              ? "bg-stone-700/80 hover:bg-stone-700 text-stone-200"
                              : "bg-stone-100 hover:bg-stone-200 text-stone-600"
                          }`}
                          title={speakingMessageId === msg.id ? "Stop audio" : "Listen aloud"}
                        >
                          {speakingMessageId === msg.id ? (
                            <>
                              <Square className="w-3 h-3 text-amber-700 fill-amber-700" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3 h-3" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {isSendingChat && (
                  <div className="flex items-start gap-2.5 max-w-[80%] mr-auto">
                    <div className="w-7 h-7 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1">
                      LG
                    </div>
                    <div className="p-3.5 bg-white border border-stone-200/90 rounded-2xl rounded-tl-xs flex items-center gap-2 text-stone-500 text-xs">
                      <Loader2 className="w-4 h-4 animate-spin text-[#5A5A40]" />
                      <span>{t("detail.thinking")}</span>
                    </div>
                  </div>
                )}

                <div ref={chatBottomRef} />
              </div>

              {/* Dynamic Suggested Questions - Grid layout showing ALL questions on screen */}
              <div className="p-3 bg-[#f4f1e6] border-t border-stone-200">
                <div className="flex items-center gap-1.5 mb-2">
                  <HelpCircle className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                  <span className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">
                    {t("detail.suggestedQuestions")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dynamicFollowUps.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendChat(q)}
                      disabled={isSendingChat}
                      className="w-full px-3 py-2 rounded-xl text-xs font-medium bg-white text-stone-800 border border-stone-300 hover:border-[#5A5A40] hover:bg-stone-50 transition-all shadow-2xs text-left leading-snug flex items-center justify-between gap-2 group disabled:opacity-50"
                    >
                      <span>
                        <TranslatedText text={q} />
                      </span>
                      <Sparkles className="w-3.5 h-3.5 text-stone-400 group-hover:text-[#5A5A40] shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 bg-white border-t border-stone-200">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={t("detail.chatPlaceholder", { spot: spot.name })}
                    disabled={isSendingChat}
                    className="flex-1 px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs sm:text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:bg-white transition-all disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isSendingChat}
                    className="px-4 py-2.5 bg-[#5A5A40] hover:bg-[#474732] text-white rounded-xl font-semibold text-xs sm:text-sm shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">{t("detail.ask")}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div className="bg-[#faf9f5] px-5 py-3 border-t border-stone-200 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span>{t("detail.aiEnabled")}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold transition-colors"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
};
