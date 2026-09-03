import React, { useEffect, useRef, useState, useCallback } from "react";
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
  Map as MapIcon,
  Crosshair,
  RefreshCw,
} from "lucide-react";
import { generateGoogleMapsSearchUrl, getTicketOrBookingUrl } from "../utils/destinations";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";

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

const TILE_CONFIGS = {
  osm: {
    id: "osm",
    name: "OpenStreetMap",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    subdomains: ["a", "b", "c"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    maxZoom: 19,
  },
  voyager: {
    id: "voyager",
    name: "Voyager (OSM)",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    subdomains: ["a", "b", "c", "d"],
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    maxZoom: 19,
  },
};

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  plan,
  activeDayNumber,
  onSelectDay,
  selectedSpotId,
  onSelectSpot,
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<string, { marker: L.Marker; act: ActivitySpot; dayNumber: number; actIdx: number }>>(new Map());
  const allLatLngsRef = useRef<[number, number][]>([]);
  const boundsFittedRef = useRef<boolean>(false);
  const lastFitKeyRef = useRef<string | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [tileStyle, setTileStyle] = useState<"osm" | "voyager">("osm");
  const [plottedCount, setPlottedCount] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCardSpot, setActiveCardSpot] = useState<{
    spot: ActivitySpot;
    dayNumber: number;
    spotIndex: number;
  } | null>(null);

  const createMarkerIcon = (act: ActivitySpot, dayNumber: number, actIdx: number, isSelected: boolean) => {
    const categoryStyle = CATEGORY_COLORS[act.category] || CATEGORY_COLORS.sightseeing;
    const numberLabel = activeDayNumber === "all" ? `D${dayNumber}.${actIdx + 1}` : `${actIdx + 1}`;
    const customHtml = `
      <div class="custom-leaflet-marker ${isSelected ? "custom-pulse-marker" : ""}" style="width: 34px; height: 34px; cursor: pointer;">
        <div style="
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background-color: ${isSelected ? "#2c2c24" : categoryStyle.bg};
          color: ${categoryStyle.text};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 700;
          box-shadow: 0 4px 10px -1px rgba(0,0,0,0.35);
          border: 2.5px solid ${isSelected ? "#d1d1ca" : "#ffffff"};
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
          ${numberLabel}
        </div>
      </div>
    `;

    return L.divIcon({
      html: customHtml,
      className: "",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  };

  // Helper to fit bounds of all currently active points
  const fitAllMarkers = useCallback((force = false) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.invalidateSize();

    const coords = allLatLngsRef.current;
    if (coords.length > 0) {
      const size = map.getSize();
      // If container has measured geometry
      if (size.x > 30 && size.y > 30) {
        const bounds = L.latLngBounds(coords);
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 15,
            animate: !force,
          });
          boundsFittedRef.current = true;
          return;
        }
      }
    }

    // Fallback: view plan mapCenter
    if (plan?.mapCenter && typeof plan.mapCenter.lat === "number" && typeof plan.mapCenter.lng === "number") {
      map.setView([plan.mapCenter.lat, plan.mapCenter.lng], plan.mapZoom || 13, { animate: true });
    }
  }, [plan?.mapCenter, plan?.mapZoom]);

  // 1. Initialize Leaflet Map Instance Once
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const initialCenter = plan?.mapCenter || { lat: 35.0116, lng: 135.7681 };
    const initialZoom = plan?.mapZoom || 13;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenter.lat, initialCenter.lng],
      zoom: initialZoom,
      zoomControl: false,
      attributionControl: false,
    });

    // Zoom and Attribution controls
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    // Initial Tile Layer
    const cfg = TILE_CONFIGS[tileStyle];
    const tileLayer = L.tileLayer(cfg.url, {
      maxZoom: cfg.maxZoom,
      subdomains: cfg.subdomains,
      attribution: cfg.attribution,
      crossOrigin: true,
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    markersLayerRef.current = L.layerGroup().addTo(map);
    routesLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    setMapReady(true);

    // Dismiss active card on map click
    map.on("click", () => {
      setActiveCardSpot(null);
    });

    // Multistage invalidateSize ticks to guarantee Leaflet paints tiles
    // even if initialized inside a hidden tab, flex container, or during navigation transitions
    const tickTimers = [
      setTimeout(() => map.invalidateSize(), 60),
      setTimeout(() => map.invalidateSize(), 200),
      setTimeout(() => {
        map.invalidateSize();
        if (!boundsFittedRef.current && allLatLngsRef.current.length > 0) {
          fitAllMarkers(true);
        }
      }, 500),
    ];

    // ResizeObserver watches for display: block / size transitions
    let roTimer: any = null;
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
          const size = mapInstanceRef.current.getSize();
          if (size.x > 50 && size.y > 50 && (!boundsFittedRef.current || allLatLngsRef.current.length > 0)) {
            fitAllMarkers();
          }
        }
      }, 100);
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      tickTimers.forEach(clearTimeout);
      clearTimeout(roTimer);
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      setMapReady(false);
    };
  }, [tileStyle, fitAllMarkers]);

  // 2. Tile Style Switcher
  const handleToggleTileStyle = () => {
    const nextStyle = tileStyle === "osm" ? "voyager" : "osm";
    setTileStyle(nextStyle);
    const map = mapInstanceRef.current;
    if (map && tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      const cfg = TILE_CONFIGS[nextStyle];
      const newLayer = L.tileLayer(cfg.url, {
        maxZoom: cfg.maxZoom,
        subdomains: cfg.subdomains,
        attribution: cfg.attribution,
        crossOrigin: true,
      }).addTo(map);
      tileLayerRef.current = newLayer;
    }
  };

  // 3. Update Markers & Polylines whenever plan, activeDayNumber, or mapReady changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapReady || !markersLayerRef.current || !routesLayerRef.current || !plan) return;

    markersLayerRef.current.clearLayers();
    routesLayerRef.current.clearLayers();
    markersMapRef.current.clear();

    const daysToShow =
      activeDayNumber === "all"
        ? (plan.days || [])
        : (plan.days || []).filter((d) => d.dayNumber === activeDayNumber);

    const allLatLngs: [number, number][] = [];

    daysToShow.forEach((day, dayIdx) => {
      const dayColor = activeDayNumber === "all" ? (dayIdx % 2 === 0 ? "#5A5A40" : "#c86446") : "#5A5A40";
      const dayCoords: [number, number][] = [];

      (day.activities || []).forEach((act, actIdx) => {
        // Defensive coordinate resolution: parse numbers, strings, or synthesize offset near center
        const rawLat = act.coordinates?.lat;
        const rawLng = act.coordinates?.lng;
        let lat = typeof rawLat === "number" ? rawLat : typeof rawLat === "string" ? parseFloat(rawLat) : NaN;
        let lng = typeof rawLng === "number" ? rawLng : typeof rawLng === "string" ? parseFloat(rawLng) : NaN;

        // Fallback offset near destination center if coordinates are invalid
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
          const baseLat = plan.mapCenter?.lat || 35.0116;
          const baseLng = plan.mapCenter?.lng || 135.7681;
          const offsetLat = (day.dayNumber * 0.007) + (actIdx * 0.003) - 0.012;
          const offsetLng = (day.dayNumber * 0.006) + (actIdx * 0.004) - 0.010;
          lat = +(baseLat + offsetLat).toFixed(5);
          lng = +(baseLng + offsetLng).toFixed(5);
        }

        const latLng: [number, number] = [lat, lng];
        dayCoords.push(latLng);
        allLatLngs.push(latLng);

        const isSelected = selectedSpotId === act.id || activeCardSpot?.spot.id === act.id;
        const icon = createMarkerIcon(act, day.dayNumber, actIdx, isSelected);
        const marker = L.marker(latLng, {
          icon,
          title: `${act.name} (Day ${day.dayNumber}, Spot #${actIdx + 1})`,
        });

        // Interactive click on pin shows card preview
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
        markersMapRef.current.set(`${day.dayNumber}:${act.id}`, { marker, act, dayNumber: day.dayNumber, actIdx });
      });

      // Draw dashed route polyline connecting day's sequence
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

    allLatLngsRef.current = allLatLngs;
    setPlottedCount(allLatLngs.length);

    // Fit map bounds to show all markers nicely
    const fitKey = `${plan.id}|${plan.destinationOrTown}|${activeDayNumber}|${allLatLngs.length}`;
    if (allLatLngs.length > 0 && lastFitKeyRef.current !== fitKey) {
      lastFitKeyRef.current = fitKey;
      const size = map.getSize();
      if (size.x > 30 && size.y > 30) {
        const bounds = L.latLngBounds(allLatLngs);
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
          boundsFittedRef.current = true;
        }
      } else {
        boundsFittedRef.current = false;
      }
    }
  }, [plan, activeDayNumber, mapReady, selectedSpotId]);

  // 4. Targeted update for marker icons on selection change
  useEffect(() => {
    markersMapRef.current.forEach(({ marker, act, dayNumber, actIdx }) => {
      const isSelected = selectedSpotId === act.id || activeCardSpot?.spot.id === act.id;
      marker.setIcon(createMarkerIcon(act, dayNumber, actIdx, isSelected));
    });
  }, [selectedSpotId, activeCardSpot?.spot.id, activeDayNumber]);

  // 5. Invalidate size on fullscreen toggle
  useEffect(() => {
    const t = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
        fitAllMarkers();
      }
    }, 100);
    return () => clearTimeout(t);
  }, [isFullscreen, fitAllMarkers]);

  // Total spot count across the entire plan
  const totalPlanActivitiesCount = (plan.days || []).reduce(
    (acc, d) => acc + (d.activities?.length || 0),
    0
  );

  const handleDaySelect = (day: number | "all") => {
    if (onSelectDay) {
      onSelectDay(day);
    }
    setActiveCardSpot(null);
  };

  const cardTicketUrl = activeCardSpot
    ? getTicketOrBookingUrl(
        activeCardSpot.spot.name,
        plan.destinationOrTown,
        activeCardSpot.spot.approxCost,
        activeCardSpot.spot.ticketUrl
      )
    : undefined;

  return (
    <div
      className={`bg-white rounded-3xl border border-[#e5e5df] shadow-xs overflow-hidden flex flex-col relative transition-all ${
        isFullscreen ? "fixed inset-3 z-50 shadow-2xl" : "h-[460px] lg:h-[580px]"
      }`}
    >
      {/* Top Map Toolbar with Day Selectors & Map Controls */}
      <div className="bg-white/95 backdrop-blur-xs px-3 sm:px-4 py-2.5 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex flex-wrap items-center gap-1.5 py-0.5 max-w-full">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] mr-1 flex items-center gap-1 shrink-0">
            <Layers className="w-3.5 h-3.5 text-[#5A5A40]" />
            {t("map.dayLabel", "Day:")}
          </span>
          <button
            type="button"
            onClick={() => handleDaySelect("all")}
            className={`px-3 py-1 rounded-full text-xs font-serif italic transition-all shrink-0 flex items-center gap-1.5 ${
              activeDayNumber === "all"
                ? "bg-[#5A5A40] text-white shadow-xs font-semibold"
                : "bg-[#ecece4] text-[#2c2c24] hover:bg-[#d1d1ca]"
            }`}
          >
            <span>{t("action.allDays", "All Days")}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeDayNumber === "all" ? "bg-white/20 text-white" : "bg-[#d1d1ca] text-[#2c2c24]"
            }`}>
              {totalPlanActivitiesCount}
            </span>
          </button>
          {plan.days.map((d) => (
            <button
              key={d.dayNumber}
              type="button"
              onClick={() => handleDaySelect(d.dayNumber)}
              className={`px-3 py-1 rounded-full text-xs font-serif italic transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                activeDayNumber === d.dayNumber
                  ? "bg-[#5A5A40] text-white shadow-xs font-semibold"
                  : "bg-[#ecece4] text-[#2c2c24] hover:bg-[#d1d1ca]"
              }`}
            >
              <span>{t("action.day", "Day")} {d.dayNumber}</span>
              <span className={`text-[10px] px-1 rounded-full ${
                activeDayNumber === d.dayNumber ? "bg-white/20 text-white" : "bg-[#d1d1ca] text-[#2c2c24]"
              }`}>
                {d.activities.length}
              </span>
            </button>
          ))}
        </div>

        {/* Map Action Controls */}
        <div className="flex items-center space-x-1.5 ml-auto shrink-0">
          {/* Plotted Spots Badge */}
          <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#f5f5f0] border border-[#e5e5df] text-[11px] font-medium text-[#5A5A40]">
            <MapPin className="w-3 h-3 text-[#5A5A40]" />
            <span>{plottedCount} {t("map.spotsPlotted", "Points")}</span>
          </span>

          {/* Fit All Points Button */}
          <button
            type="button"
            onClick={() => fitAllMarkers(true)}
            title="Fit all spots in view"
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-serif italic flex items-center gap-1 transition-all"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("map.fitSpots", "Fit")} ({plottedCount})</span>
          </button>

          {/* Toggle Tile Style (OSM vs Voyager) */}
          <button
            type="button"
            onClick={handleToggleTileStyle}
            title={`Switch to ${tileStyle === "osm" ? "Voyager Clean" : "OpenStreetMap Standard"}`}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-serif italic flex items-center gap-1 transition-all"
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tileStyle === "osm" ? "OSM" : "Voyager"}</span>
          </button>

          {/* Recenter Map */}
          <button
            type="button"
            onClick={() => fitAllMarkers(false)}
            title="Recenter Destination"
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-serif italic flex items-center gap-1 transition-all"
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t("map.center", "Center")}</span>
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="p-2 rounded-full bg-[#ecece4] text-[#5A5A40] hover:bg-[#d1d1ca] text-xs font-medium transition-all"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Map DOM Canvas */}
      <div className="flex-1 relative w-full h-full min-h-[320px] bg-[#ecece4]">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

        {/* Pinned Location Description Floating Overlay Card */}
        {activeCardSpot && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 sm:w-96 z-[1000] bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-[#d1d1ca] animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className="bg-[#5A5A40] text-white text-[10px] font-serif italic px-2 py-0.5 rounded-full font-semibold">
                  {t("action.day", "Day")} {activeCardSpot.dayNumber} • Spot #{activeCardSpot.spotIndex + 1}
                </span>
                <span className="text-[11px] font-sans text-[#8a8a7e] uppercase font-bold">
                  {t(`category.${activeCardSpot.spot.category}`, activeCardSpot.spot.category.toUpperCase())}
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
              <TranslatedText text={activeCardSpot.spot.name} />
            </h4>

            <p className="text-xs text-[#2c2c24]/90 mt-1.5 line-clamp-3 font-sans leading-relaxed">
              <TranslatedText text={activeCardSpot.spot.description} />
            </p>

            {activeCardSpot.spot.insiderTip && (
              <div className="mt-2 p-2 rounded-xl bg-[#ecece4] border border-[#d1d1ca] text-[11px] text-[#2c2c24] flex items-start space-x-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                <span className="line-clamp-2">
                  <strong className="font-serif italic mr-1">Tip:</strong>
                  <TranslatedText text={activeCardSpot.spot.insiderTip} />
                </span>
              </div>
            )}

            {/* Price & Rating line */}
            <div className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t border-[#e5e5df]">
              <span className="font-serif italic font-semibold text-[#2c2c24]">
                {t("map.cost", "Cost")}: {activeCardSpot.spot.approxCost}
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
              {cardTicketUrl && (
                <a
                  href={cardTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-serif italic flex items-center space-x-1 transition-all border border-[#d1d1ca]"
                >
                  <Ticket className="w-3.5 h-3.5 text-[#5A5A40]" />
                  <span>{t("map.buyTickets", "Buy Tickets")}</span>
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
                <span>{t("map.goToList", "Go to Activity List")}</span>
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
            <span className="w-2 h-2 rounded-full bg-[#c86446] inline-block" /> {t("category.food", "Food")}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#4a6b53] inline-block" /> {t("category.nature", "Nature")}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#5A5A40] inline-block" /> {t("category.culture", "Culture")}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#657786] inline-block" /> {t("category.sightseeing", "Landmark")}
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#c68a3c] inline-block" /> {t("category.hidden-gem", "Secret Spot")}
          </span>
        </div>
        <span className="hidden sm:inline text-[11px] text-[#8a8a7e]">
          {plottedCount === 15 ? "All 15 spots mapped • Click pin for details" : `${plottedCount} spots mapped • Click pin for details`}
        </span>
      </div>
    </div>
  );
};

