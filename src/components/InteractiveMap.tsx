import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { ItineraryPlan, ActivitySpot, ActivityCategory } from "../types";
import {
  Layers,
  Maximize2,
  Minimize2,
  Compass,
  ArrowDownCircle,
  Lightbulb,
  ExternalLink,
  Ticket,
  X,
  Star,
  MapPin,
} from "lucide-react";
import { generateGoogleMapsSearchUrl, getTicketOrBookingUrl } from "../utils/destinations";

interface InteractiveMapProps {
  plan: ItineraryPlan;
  activeDayNumber: number | "all";
  onSelectDay?: (day: number | "all") => void;
  selectedSpotId: string | null;
  onSelectSpot: (spot: ActivitySpot) => void;
}

const CATEGORY_COLORS: Record<ActivityCategory, { bg: string; text: string; border: string }> = {
  food: { bg: "#c86446", text: "#ffffff", border: "#a64e34" }, // terracotta
  nature: { bg: "#4a6b53", text: "#ffffff", border: "#38523e" }, // forest sage
  culture: { bg: "#5A5A40", text: "#ffffff", border: "#444430" }, // olive
  sightseeing: { bg: "#657786", text: "#ffffff", border: "#4e5d6a" }, // stone blue
  "hidden-gem": { bg: "#c68a3c", text: "#ffffff", border: "#a8712a" }, // ochre gold
  shopping: { bg: "#9b5e72", text: "#ffffff", border: "#7f4659" }, // dusty rose
  relaxation: { bg: "#5d8a82", text: "#ffffff", border: "#446962" }, // eucalyptus
  nightlife: { bg: "#504b6b", text: "#ffffff", border: "#3b3652" }, // indigo slate
  cafe: { bg: "#8a6d4b", text: "#ffffff", border: "#6c5336" }, // warm coffee
  entertainment: { bg: "#9e4c5b", text: "#ffffff", border: "#7c3543" }, // wine
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  plan,
  activeDayNumber,
  onSelectDay,
  selectedSpotId,
  onSelectSpot,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCardSpot, setActiveCardSpot] = useState<{
    spot: ActivitySpot;
    dayNumber: number;
    spotIndex: number;
  } | null>(null);

  // Initialize Map Once
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const center = plan.mapCenter || { lat: 43.3183, lng: -1.9812 };
      const zoom = plan.mapZoom || 13;

      const map = L.map(mapContainerRef.current, {
        center: [center.lat, center.lng],
        zoom: zoom,
        zoomControl: false,
        attributionControl: false,
      });

      // OpenStreetMap Standard Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Add zoom control top right
      L.control.zoom({ position: "topright" }).addTo(map);

      // Attribution bottom right
      L.control.attribution({ position: "bottomright" }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      routesLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Sync center and zoom when destination changes
  useEffect(() => {
    if (mapInstanceRef.current && plan.mapCenter) {
      mapInstanceRef.current.setView([plan.mapCenter.lat, plan.mapCenter.lng], plan.mapZoom || 13);
    }
  }, [plan.mapCenter, plan.mapZoom]);

  // Update Markers & Polylines whenever plan, activeDay, or selectedSpot changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !markersLayerRef.current || !routesLayerRef.current) return;

    markersLayerRef.current.clearLayers();
    routesLayerRef.current.clearLayers();

    const daysToShow =
      activeDayNumber === "all"
        ? plan.days
        : plan.days.filter((d) => d.dayNumber === activeDayNumber);

    const allLatLngs: L.LatLngExpression[] = [];

    daysToShow.forEach((day, dayIdx) => {
      const dayColor = activeDayNumber === "all" ? (dayIdx % 2 === 0 ? "#5A5A40" : "#c86446") : "#5A5A40";
      const dayCoords: [number, number][] = [];

      day.activities.forEach((act, actIdx) => {
        if (!act.coordinates || typeof act.coordinates.lat !== "number" || typeof act.coordinates.lng !== "number") {
          return;
        }

        const latLng: [number, number] = [act.coordinates.lat, act.coordinates.lng];
        dayCoords.push(latLng);
        allLatLngs.push(latLng);

        const categoryStyle = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.sightseeing;
        const isSelected = selectedSpotId === act.id || activeCardSpot?.spot.id === act.id;
        const numberLabel = activeDayNumber === "all" ? `D${day.dayNumber}.${actIdx + 1}` : `${actIdx + 1}`;

        // Custom HTML Marker Icon
        const customHtml = `
          <div class="custom-leaflet-marker ${isSelected ? "custom-pulse-marker" : ""}" style="width: 32px; height: 32px; cursor: pointer;">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background-color: ${isSelected ? "#2c2c24" : categoryStyle.bg};
              color: ${categoryStyle.text};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 11px;
              font-family: 'Plus Jakarta Sans', sans-serif;
              font-weight: 700;
              box-shadow: 0 4px 8px -1px rgba(0,0,0,0.3);
              border: 2px solid ${isSelected ? "#5A5A40" : "#ffffff"};
              transition: transform 0.2s;
            ">
              ${numberLabel}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          html: customHtml,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker(latLng, { icon: customIcon });

        // When pin is clicked, show the pinned location preview description card inside the map!
        marker.on("click", (e) => {
          L.DomEvent.stopPropagation(e);
          setActiveCardSpot({
            spot: act,
            dayNumber: day.dayNumber,
            spotIndex: actIdx,
          });
          map.panTo(latLng, { animate: true });
        });

        markersLayerRef.current?.addLayer(marker);
      });

      // Draw polyline connecting day's sequence
      if (dayCoords.length > 1) {
        const polyline = L.polyline(dayCoords, {
          color: dayColor,
          weight: 3.5,
          opacity: 0.8,
          dashArray: "6, 8",
        });
        routesLayerRef.current?.addLayer(polyline);
      }
    });

    // Fit map bounds to show all markers nicely if we have them
    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
    }
  }, [plan, activeDayNumber, selectedSpotId, activeCardSpot?.spot.id]);

  // Recenter Map Helper
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return;
    const center = plan.mapCenter || { lat: 43.3183, lng: -1.9812 };
    mapInstanceRef.current.setView([center.lat, center.lng], plan.mapZoom || 13, { animate: true });
  };

  const handleDaySelect = (day: number | "all") => {
    if (onSelectDay) {
      onSelectDay(day);
    }
    setActiveCardSpot(null);
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-[#e5e5df] shadow-xs overflow-hidden flex flex-col relative ${
        isFullscreen ? "fixed inset-4 z-50 shadow-2xl" : "h-[450px] lg:h-[560px]"
      }`}
    >
      {/* Top Map Toolbar with Day Selectors */}
      <div className="bg-white/95 backdrop-blur-xs px-3 sm:px-4 py-2.5 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center space-x-1.5 overflow-x-auto py-0.5 max-w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] mr-1 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-[#5A5A40]" />
            Day:
          </span>
          <button
            type="button"
            onClick={() => handleDaySelect("all")}
            className={`px-3 py-1 rounded-full text-xs font-serif italic transition-all shrink-0 ${
              activeDayNumber === "all"
                ? "bg-[#5A5A40] text-white shadow-xs font-semibold"
                : "bg-[#ecece4] text-[#2c2c24] hover:bg-[#d1d1ca]"
            }`}
          >
            All Days ({plan.days.length})
          </button>
          {plan.days.map((d) => (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => handleDaySelect(d.dayNumber)}
              className={`px-3 py-1 rounded-full text-xs font-serif italic transition-all whitespace-nowrap shrink-0 ${
                activeDayNumber === d.dayNumber
                  ? "bg-[#5A5A40] text-white shadow-xs font-semibold"
                  : "bg-[#ecece4] text-[#2c2c24] hover:bg-[#d1d1ca]"
              }`}
            >
              Day {d.dayNumber}
            </button>
          ))}
        </div>

        {/* Map Control Buttons */}
        <div className="flex items-center space-x-1.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map"
            className="p-1.5 sm:px-3 sm:py-1 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-serif italic flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Center</span>
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="p-2 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-medium"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Map DOM Canvas */}
      <div className="flex-1 relative w-full h-full min-h-[300px]">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Pinned Location Description Floating Overlay Card */}
        {activeCardSpot && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#d1d1ca] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className="bg-[#5A5A40] text-white text-[10px] font-serif italic px-2 py-0.5 rounded-full font-semibold">
                  Day {activeCardSpot.dayNumber} • Spot #{activeCardSpot.spotIndex + 1}
                </span>
                <span className="text-[11px] font-sans text-[#8a8a7e] uppercase font-bold">
                  {activeCardSpot.spot.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCardSpot(null)}
                className="p-1 text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h4 className="font-serif text-base sm:text-lg font-normal italic text-[#2c2c24] leading-snug">
              {activeCardSpot.spot.name}
            </h4>

            <p className="text-xs text-[#2c2c24]/90 mt-1.5 line-clamp-3 font-sans leading-relaxed">
              {activeCardSpot.spot.description}
            </p>

            {activeCardSpot.spot.insiderTip && (
              <div className="mt-2 p-2 rounded-xl bg-[#ecece4] border border-[#d1d1ca] text-[11px] text-[#2c2c24] flex items-start space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  <strong className="font-serif italic mr-1">Tip:</strong>
                  {activeCardSpot.spot.insiderTip}
                </span>
              </div>
            )}

            {/* Price & Rating line */}
            <div className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t border-[#e5e5df]">
              <span className="font-serif italic font-semibold text-[#2c2c24]">
                Cost: {activeCardSpot.spot.approxCost}
              </span>
              {activeCardSpot.spot.rating && (
                <span className="flex items-center text-[#5A5A40] font-semibold text-xs">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500 mr-1" />
                  {activeCardSpot.spot.rating}
                </span>
              )}
            </div>

            {/* Actions: Ticket purchase (if applicable) & Go to Activity List */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {getTicketOrBookingUrl(
                activeCardSpot.spot.name,
                plan.destinationOrTown,
                activeCardSpot.spot.approxCost,
                activeCardSpot.spot.ticketUrl
              ) && (
                <a
                  href={getTicketOrBookingUrl(
                    activeCardSpot.spot.name,
                    plan.destinationOrTown,
                    activeCardSpot.spot.approxCost,
                    activeCardSpot.spot.ticketUrl
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-serif italic flex items-center space-x-1 transition-all border border-[#d1d1ca]"
                >
                  <Ticket className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>Buy Tickets</span>
                </a>
              )}

              <a
                href={
                  activeCardSpot.spot.googleMapsUrl ||
                  generateGoogleMapsSearchUrl(activeCardSpot.spot.name, plan.destinationOrTown)
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#8a8a7e] hover:text-[#2c2c24] text-xs transition-colors border border-[#d1d1ca] flex items-center space-x-1"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Maps</span>
              </a>

              {/* Crucial Button: Go to Activity in List */}
              <button
                type="button"
                onClick={() => {
                  const spot = activeCardSpot.spot;
                  setActiveCardSpot(null);
                  onSelectSpot(spot);
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic flex items-center justify-center space-x-1.5 transition-all shadow-xs"
              >
                <span>Go to Activity List</span>
                <ArrowDownCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Map Bottom Legend */}
      <div className="bg-[#f5f5f0] px-4 py-2 border-t border-[#e5e5df] flex items-center justify-between text-[11px] text-[#8a8a7e] shrink-0">
        <div className="flex items-center space-x-3 overflow-x-auto">
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#c86446] inline-block" /> Food
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#4a6b53] inline-block" /> Nature
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#5A5A40] inline-block" /> Culture
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#657786] inline-block" /> Landmark
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#c68a3c] inline-block" /> Secret Spot
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] text-[#8a8a7e]">Click pin for preview & details</span>
      </div>
    </div>
  );
};

