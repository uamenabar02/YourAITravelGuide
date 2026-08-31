import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { DailyPlan } from "../types";
import { TranslatedText } from "./TranslatedText";

interface PrintDailyMapProps {
  day: DailyPlan;
  destinationOrTown: string;
}

export const PrintDailyMap: React.FC<PrintDailyMapProps> = ({ day, destinationOrTown }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Filter activities with valid coordinates
    const validSpots = day.activities.filter(
      (act) => act.coordinates && typeof act.coordinates.lat === "number" && typeof act.coordinates.lng === "number"
    );

    if (validSpots.length === 0) return;

    // Clear old map instance if existing
    if (mapRef.current) {
      try {
        mapRef.current.remove();
      } catch (e) {
        console.warn("Map removal error:", e);
      }
      mapRef.current = null;
    }

    // Initialize map
    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    const latLngs = validSpots.map(
      (spot) => [spot.coordinates!.lat, spot.coordinates!.lng] as [number, number]
    );

    // Standard OpenStreetMap tile layer for reliability and perfect display
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    // Place marker for each activity
    validSpots.forEach((spot, idx) => {
      const customHtml = `
        <div style="
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background-color: #5A5A40;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: bold;
          border: 1.5px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ">
          ${idx + 1}
        </div>
      `;

      const icon = L.divIcon({
        html: customHtml,
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      L.marker([spot.coordinates!.lat, spot.coordinates!.lng], { icon }).addTo(map);
    });

    // Draw route lines connecting activities sequentially
    if (latLngs.length > 1) {
      L.polyline(latLngs, {
        color: "#5A5A40",
        weight: 1.5,
        opacity: 0.7,
        dashArray: "4, 4",
      }).addTo(map);
    }

    mapRef.current = map;

    // Fit bounds of all sequential pins
    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [15, 15] });
    }

    // Invalidate size once elements have processed layout
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
        if (latLngs.length > 0) {
          const bounds = L.latLngBounds(latLngs);
          mapRef.current.fitBounds(bounds, { padding: [15, 15] });
        }
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn("Map clean-up removal error:", e);
        }
        mapRef.current = null;
      }
    };
  }, [day]);

  const hasCoordinates = day.activities.some(
    (act) => act.coordinates && typeof act.coordinates.lat === "number" && typeof act.coordinates.lng === "number"
  );

  if (!hasCoordinates) return null;

  return (
    <div className="print-map-container" style={{ position: "relative" }}>
      <div ref={containerRef} className="w-full h-full bg-[#f5f5f0]" />
      <div className="absolute top-1.5 right-2 z-10 bg-white/95 text-[7px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border border-[#d1d1ca] text-[#5A5A40] pointer-events-none font-sans no-print">
        <TranslatedText text={`Route Map • Day ${day.dayNumber}`} />
      </div>
    </div>
  );
};
