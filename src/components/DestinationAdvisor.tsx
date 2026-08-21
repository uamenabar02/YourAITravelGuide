import React, { useState, useEffect, useRef } from "react";
import { MapPin, Check, Sparkles, Compass } from "lucide-react";
import { searchDestinationSuggestions, VerifiedDestination, VERIFIED_DESTINATIONS } from "../utils/destinations";

interface DestinationAdvisorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectVerified?: (dest: VerifiedDestination) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}

export const DestinationAdvisor: React.FC<DestinationAdvisorProps> = ({
  value,
  onChange,
  onSelectVerified,
  placeholder = "e.g. Donostia / San Sebastián, Spain",
  id = "input-destination-advisor",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<VerifiedDestination[]>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions(searchDestinationSuggestions(value));
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (dest: VerifiedDestination) => {
    const formatted = `${dest.name}, ${dest.country}`;
    onChange(formatted);
    if (onSelectVerified) {
      onSelectVerified(dest);
    }
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          required
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 rounded-xl border border-[#d1d1ca] bg-white text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-all text-sm font-medium shadow-xs ${className}`}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1 pointer-events-none">
          <MapPin className="w-4 h-4 text-[#8a8a7e]" />
        </div>
      </div>

      {/* Autocomplete Advisor Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-[#d1d1ca] rounded-2xl shadow-lg max-h-72 overflow-y-auto divide-y divide-[#ecece4] animate-in fade-in-50 duration-150">
          <div className="p-2.5 bg-[#f5f5f0]/80 text-[10px] uppercase font-bold tracking-widest text-[#8a8a7e] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Compass className="w-3 h-3 text-[#5A5A40]" />
              Verified Destination Advisor
            </span>
            <span>{suggestions.length} places</span>
          </div>

          {suggestions.map((dest) => {
            const isSelected = value.toLowerCase().includes(dest.name.toLowerCase());
            return (
              <button
                key={dest.id}
                type="button"
                onClick={() => handleSelect(dest)}
                className="w-full text-left p-3 hover:bg-[#ecece4]/60 transition-colors flex items-start justify-between gap-3 group"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-[#ecece4] text-[#5A5A40] flex items-center justify-center font-serif text-xs shrink-0 group-hover:bg-[#5A5A40] group-hover:text-white transition-colors border border-[#d1d1ca]">
                    📍
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-serif italic font-medium text-sm text-[#2c2c24] group-hover:text-[#5A5A40]">
                        {dest.name}
                      </span>
                      <span className="text-[11px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#6b6b5e] border border-[#d1d1ca]">
                        {dest.region}, {dest.country}
                      </span>
                    </div>
                    <p className="text-xs text-[#8a8a7e] font-sans line-clamp-1 mt-0.5">
                      Highlights: {dest.popularSpots.slice(0, 3).join(" • ")}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-[#5A5A40] shrink-0 mt-1" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
