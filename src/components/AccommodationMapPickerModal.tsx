import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { X, CheckCircle2, MapPin, Search, Loader2, Navigation } from "lucide-react";
import { Coordinates } from "../types";
import { findVerifiedDestination } from "../utils/destinations";
import { TranslatedText } from "./TranslatedText";

interface AccommodationMapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (displayName: string, coordinates: Coordinates) => void;
  cityContext: string;
  initialCoordinates?: Coordinates;
  initialLocationName?: string;
}

export const AccommodationMapPickerModal: React.FC<AccommodationMapPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  cityContext,
  initialCoordinates,
  initialLocationName = "",
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [addressName, setAddressName] = useState(initialLocationName);
  const [selectedCoords, setSelectedCoords] = useState<Coordinates | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  // Determine center coordinates of the town or previous stay coordinate
  const getStartingCenter = (): Coordinates => {
    if (initialCoordinates) return initialCoordinates;
    const verified = findVerifiedDestination(cityContext);
    if (verified && verified.coordinates) return verified.coordinates;
    return { lat: 43.3183, lng: -1.9812 }; // default San Sebastian
  };

  useEffect(() => {
    if (!isOpen) return;

    const startCenter = getStartingCenter();
    setSelectedCoords(startCenter);

    // Initialize map after container is rendered
    const timer = setTimeout(() => {
      if (!mapContainerRef.current) return;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [startCenter.lat, startCenter.lng],
          zoom: 15,
          zoomControl: false,
          attributionControl: false,
        });

        L.control.zoom({ position: "topright" }).addTo(map);
        L.control.attribution({ position: "bottomright" }).addTo(map);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Put initial marker
        const markerIcon = L.divIcon({
          html: `<div class="w-8 h-8 flex items-center justify-center bg-red-600 rounded-full border-2 border-white shadow-lg text-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
          </div>`,
          className: "",
          iconSize: [32, 32],
          iconAnchor: [16, 32],
        });

        const m = L.marker([startCenter.lat, startCenter.lng], { icon: markerIcon }).addTo(map);
        markerRef.current = m;
        mapInstanceRef.current = map;

        // Perform initial reverse geocoding if initial coordinates were set but no location name
        if (initialCoordinates && !initialLocationName) {
          triggerReverseGeocode(startCenter.lat, startCenter.lng);
        }

        // Map Click Event to Update Pin
        map.on("click", (e) => {
          const { lat, lng } = e.latlng;
          const newCoords = { lat, lng };
          setSelectedCoords(newCoords);
          m.setLatLng([lat, lng]);
          triggerReverseGeocode(lat, lng);
        });
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [isOpen]);

  const triggerReverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      if (res.ok) {
        const data = await res.json();
        const displayName = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setAddressName(displayName);
      }
    } catch (err) {
      console.warn("Reverse geocode error:", err);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleSearchAddress = async (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    if (e && "preventDefault" in e) {
      e.preventDefault();
    }
    if (!searchQuery.trim()) return;

    setIsSearchingAddress(true);
    try {
      const queryContext = cityContext && !searchQuery.toLowerCase().includes(cityContext.toLowerCase())
        ? `${searchQuery}, ${cityContext}`
        : searchQuery;

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        queryContext
      )}&limit=1`;
      
      const res = await fetch(url, {
        headers: { "Accept-Language": "en" },
      });
      if (res.ok) {
        const results = await res.json();
        if (Array.isArray(results) && results.length > 0) {
          const item = results[0];
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const newCoords = { lat, lng };

          setSelectedCoords(newCoords);
          setAddressName(item.display_name);

          if (mapInstanceRef.current && markerRef.current) {
            mapInstanceRef.current.setView([lat, lng], 16);
            markerRef.current.setLatLng([lat, lng]);
          }
        }
      }
    } catch (err) {
      console.warn("Address search error:", err);
    } finally {
      setIsSearchingAddress(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedCoords) return;
    const finalName = addressName.trim() || `${selectedCoords.lat.toFixed(5)}, ${selectedCoords.lng.toFixed(5)}`;
    onSelect(finalName, selectedCoords);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 no-print">
      <div className="bg-[#f5f5f0] rounded-3xl w-full max-w-2xl shadow-2xl border border-[#d1d1ca] flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#ecece4] flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg font-bold text-[#2c2c24] italic">
                <TranslatedText text="Manual Map Pin & Location Picker" />
              </h3>
              <p className="text-[11px] text-[#8a8a7e]">
                <TranslatedText text="Click anywhere on the map to pin your location precisely" />
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#f5f5f0] text-[#8a8a7e] hover:text-[#2c2c24] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Header for looking up specific landmarks/addresses */}
        <div className="p-3 bg-[#ecece4] border-b border-[#d1d1ca] shrink-0">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search specific address or venue near here..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSearchAddress(e);
                  }
                }}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
              <Search className="w-3.5 h-3.5 text-[#8a8a7e] absolute left-2.5 top-2.5" />
            </div>
            <button
              type="button"
              onClick={handleSearchAddress}
              disabled={isSearchingAddress}
              className="px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-semibold hover:bg-[#444430] transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {isSearchingAddress ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <TranslatedText text="Locate" />
              )}
            </button>
          </div>
        </div>

        {/* Map Area */}
        <div className="relative flex-1 bg-[#e5e5df] min-h-[300px]">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />
          <div className="absolute bottom-4 left-4 z-20 pointer-events-none bg-white/95 px-3 py-2 rounded-xl border border-[#d1d1ca] shadow-sm max-w-xs">
            <p className="text-[10px] uppercase font-bold tracking-wider text-[#8a8a7e] flex items-center gap-1 mb-0.5">
              <Navigation className="w-3 h-3 text-[#5A5A40]" /> <TranslatedText text="Instructions" />
            </p>
            <p className="text-[11px] text-[#2c2c24] font-medium leading-relaxed">
              <TranslatedText text="Drag or click map to move target pin. It auto-updates coordinates and street address." />
            </p>
          </div>
        </div>

        {/* Location / Details Section */}
        <div className="p-5 bg-white border-t border-[#ecece4] space-y-4 shrink-0">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#6b6b5e]">
                <TranslatedText text="Location/Address Name (Click Map to Update or Edit Below)" />
              </label>
              {isReverseGeocoding && (
                <span className="text-[10px] text-[#5A5A40] animate-pulse flex items-center gap-1 font-sans italic">
                  <Loader2 className="w-3 h-3 animate-spin inline" /> <TranslatedText text="Querying address..." />
                </span>
              )}
            </div>
            <input
              type="text"
              value={addressName}
              onChange={(e) => setAddressName(e.target.value)}
              placeholder="e.g. Hotel Carlton, Room 302"
              className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] font-mono text-[#6b6b5e]">
              <TranslatedText text="Coordinates:" />{" "}
              <span className="font-semibold text-[#2c2c24]">
                {selectedCoords ? `${selectedCoords.lat.toFixed(5)}, ${selectedCoords.lng.toFixed(5)}` : "None"}
              </span>
            </div>

            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#d1d1ca] hover:border-[#2c2c24] text-[#6b6b5e] hover:text-[#2c2c24] rounded-xl text-xs font-semibold transition-colors bg-white cursor-pointer"
              >
                <TranslatedText text="Cancel" />
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedCoords}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <TranslatedText text="Confirm Pin & Save" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

