import React, { useState, useEffect } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudDrizzle,
  CloudLightning,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  ShieldAlert,
  Shirt,
  Calendar,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Luggage,
} from "lucide-react";
import { WeatherForecastData, WeatherForecastDay } from "../types";
import { TranslatedText } from "./TranslatedText";
import { usePreferences } from "../context/PreferencesContext";

interface WeatherForecastCardProps {
  weatherForecast?: WeatherForecastData;
  destination: string;
  totalDays: number;
  startDate?: string;
  onOpenPackingModal?: () => void;
}

export const WeatherForecastCard: React.FC<WeatherForecastCardProps> = ({
  weatherForecast,
  destination,
  totalDays,
  startDate,
  onOpenPackingModal,
}) => {
  const { temperatureUnit, setTemperatureUnit } = usePreferences();
  const [unit, setUnit] = useState<"C" | "F">(temperatureUnit || "C");
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (temperatureUnit) {
      setUnit(temperatureUnit);
    }
  }, [temperatureUnit]);

  if (!weatherForecast || !weatherForecast.dailyForecast || weatherForecast.dailyForecast.length === 0) {
    return null;
  }

  const toF = (c: number) => Math.round((c * 9) / 5 + 32);
  const formatTemp = (c: number) => (unit === "C" ? `${c}°C` : `${toF(c)}°F`);

  const renderWeatherIcon = (iconName: string, className = "w-5 h-5") => {
    switch (iconName?.toLowerCase()) {
      case "sun":
        return <Sun className={`${className} text-amber-500`} />;
      case "cloudsun":
      case "sunmedium":
        return <CloudSun className={`${className} text-amber-400`} />;
      case "cloud":
      case "overcast":
        return <Cloud className={`${className} text-slate-500`} />;
      case "cloudrain":
      case "cloudrainwind":
        return <CloudRain className={`${className} text-blue-500`} />;
      case "clouddrizzle":
        return <CloudDrizzle className={`${className} text-sky-400`} />;
      case "cloudlightning":
        return <CloudLightning className={`${className} text-purple-500`} />;
      case "snowflake":
        return <Snowflake className={`${className} text-indigo-400`} />;
      default:
        return <CloudSun className={`${className} text-amber-500`} />;
    }
  };

  const isDateSpecific = weatherForecast.isDateSpecific || (!!startDate && startDate.trim().length > 0);
  const maxPrecip = Math.max(...weatherForecast.dailyForecast.map((d) => d.precipitationChance));
  const primaryWarning = weatherForecast.seasonalityWarnings?.[0];

  return (
    <div
      id="weather-forecast-integration-card"
      className="bg-white rounded-2xl sm:rounded-3xl border border-[#e5e5df] shadow-2xs overflow-hidden transition-all duration-200 my-6"
    >
      {/* Compact Default Bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#fcfcf9]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-600 shrink-0 shadow-2xs">
            {renderWeatherIcon(weatherForecast.dailyForecast[0]?.iconName || "Sun", "w-5 h-5")}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-serif text-base sm:text-lg font-semibold text-[#2c2c24]">
                <TranslatedText text="Weather Forecast" />
              </h3>
              <span className="text-xs font-mono font-bold text-[#5A5A40] bg-[#f5f5f0] border border-[#d1d1ca] px-2.5 py-0.5 rounded-full">
                {formatTemp(weatherForecast.avgLowC)} – {formatTemp(weatherForecast.avgHighC)}
              </span>
              {maxPrecip > 20 && (
                <span className="text-xs font-mono font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span>{maxPrecip}% <TranslatedText text="Rain" /></span>
                </span>
              )}
              {isDateSpecific ? (
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Calendar className="w-3 h-3 text-amber-600" />
                  <span><TranslatedText text="Seasonal" /></span>
                </span>
              ) : (
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span><TranslatedText text="Live 5-Day" /></span>
                </span>
              )}
            </div>

            {primaryWarning ? (
              <p className="text-xs text-amber-900 mt-0.5 line-clamp-1 font-sans flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span><TranslatedText text={primaryWarning} /></span>
              </p>
            ) : (
              <p className="text-xs text-[#6b6b5e] mt-0.5 font-sans">
                <TranslatedText text={`Expect comfortable conditions for outdoor exploration in ${destination}.`} />
              </p>
            )}
          </div>
        </div>

        {/* Action Controls: C/F Toggle + Show Details Button */}
        <div className="flex items-center gap-2 self-end md:self-center shrink-0">
          <div className="flex items-center space-x-1 bg-[#f5f5f0] p-1 rounded-xl border border-[#d1d1ca]">
            <button
              type="button"
              onClick={() => {
                setUnit("C");
                setTemperatureUnit("C");
              }}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                unit === "C"
                  ? "bg-[#5A5A40] text-white shadow-2xs"
                  : "text-[#6b6b5e] hover:text-[#2c2c24]"
              }`}
            >
              °C
            </button>
            <button
              type="button"
              onClick={() => {
                setUnit("F");
                setTemperatureUnit("F");
              }}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                unit === "F"
                  ? "bg-[#5A5A40] text-white shadow-2xs"
                  : "text-[#6b6b5e] hover:text-[#2c2c24]"
              }`}
            >
              °F
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-semibold font-sans transition-colors shadow-2xs cursor-pointer"
          >
            <span>{isExpanded ? <TranslatedText text="Hide Details" /> : <TranslatedText text="Show Details" />}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Detailed Weather Breakdown */}
      {isExpanded && (
        <div className="p-5 sm:p-6 space-y-5 border-t border-[#e5e5df] bg-white">
          <p className="text-xs text-[#6b6b5e] font-sans">
            {isDateSpecific
              ? <TranslatedText text={`Historical climate averages & predictive trends for ${destination} starting ${startDate}.`} />
              : <TranslatedText text={`Current live meteorological conditions & travel advisories for ${destination}.`} />}
          </p>

          {/* Climate Overview Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f8f8f5] p-3.5 rounded-2xl border border-[#e5e5df]">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-amber-500 shadow-2xs shrink-0">
                <Thermometer className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#8a8a7e]"><TranslatedText text="Temp Range" /></div>
                <div className="text-xs font-bold font-mono text-[#2c2c24]">
                  {formatTemp(weatherForecast.avgLowC)} - {formatTemp(weatherForecast.avgHighC)}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-blue-500 shadow-2xs shrink-0">
                <Droplets className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#8a8a7e]"><TranslatedText text="Precipitation" /></div>
                <div className="text-xs font-bold font-mono text-[#2c2c24]">
                  {maxPrecip}% <TranslatedText text="Max" />
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#8a8a7e]"><TranslatedText text="Peak UV Index" /></div>
                <div className="text-xs font-bold font-mono text-[#2c2c24]">
                  {Math.max(...weatherForecast.dailyForecast.map((d) => d.uvIndex || 5))}/10
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-white border border-[#d1d1ca] flex items-center justify-center text-emerald-600 shadow-2xs shrink-0">
                <Wind className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-[#8a8a7e]"><TranslatedText text="Avg Wind" /></div>
                <div className="text-xs font-bold font-mono text-[#2c2c24]">
                  {Math.round(
                    weatherForecast.dailyForecast.reduce((acc, d) => acc + (d.windSpeedKmH || 10), 0) /
                      weatherForecast.dailyForecast.length
                  )}{" "}
                  km/h
                </div>
              </div>
            </div>
          </div>

          {/* Seasonality Warnings Box */}
          {weatherForecast.seasonalityWarnings && weatherForecast.seasonalityWarnings.length > 0 && (
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                <div className="flex items-center gap-2 text-amber-950 font-serif font-semibold text-xs sm:text-sm">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span><TranslatedText text="Seasonality Advisories & Local Climate Warnings" /></span>
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300">
                  {weatherForecast.seasonalityWarnings.length} <TranslatedText text="Active Notes" />
                </span>
              </div>

              <ul className="space-y-1.5 text-xs text-amber-950 font-sans">
                {weatherForecast.seasonalityWarnings.map((warn, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 text-amber-700 font-bold">•</span>
                    <span><TranslatedText text={warn} /></span>
                  </li>
                ))}
              </ul>

              {/* Packing Essentials */}
              {weatherForecast.packingEssentials && weatherForecast.packingEssentials.length > 0 && (
                <div className="pt-2 border-t border-amber-200/70 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-amber-900 font-serif italic flex items-center gap-1">
                    <Shirt className="w-3.5 h-3.5 text-amber-700" />
                    <TranslatedText text="Recommended Apparel:" />
                  </span>
                  {weatherForecast.packingEssentials.map((item, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-medium bg-white text-amber-900 border border-amber-200 px-2.5 py-0.5 rounded-full shadow-2xs"
                    >
                      <TranslatedText text={item} />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Day-by-Day Breakdown */}
          <div>
            <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-2.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
              <TranslatedText text="Day-by-Day Breakdown" />
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {weatherForecast.dailyForecast.map((day) => (
                <div
                  key={day.dayNumber}
                  className="bg-[#fcfcf9] hover:bg-white p-3.5 rounded-2xl border border-[#e5e5df] transition-all space-y-2 shadow-2xs group"
                >
                  <div className="flex items-center justify-between border-b border-[#ecece4] pb-1.5">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase text-[#5A5A40] bg-[#f5f5f0] px-1.5 py-0.5 rounded border border-[#d1d1ca]">
                        <TranslatedText text={`Day ${day.dayNumber}`} />
                      </span>
                      <p className="text-xs font-semibold text-[#2c2c24] mt-0.5"><TranslatedText text={day.dateStr} /></p>
                    </div>
                    <div className="p-1.5 rounded-xl bg-amber-50/50 border border-amber-200/50 group-hover:scale-105 transition-transform">
                      {renderWeatherIcon(day.iconName, "w-5 h-5")}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-base font-mono font-bold text-[#2c2c24]">
                        {formatTemp(day.tempHighC)}
                      </span>
                      <span className="text-xs font-mono text-[#8a8a7e]">
                        <TranslatedText text="Low" />: {formatTemp(day.tempLowC)}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-[#5A5A40]"><TranslatedText text={day.condition} /></p>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[10px] text-[#6b6b5e] font-mono bg-[#f5f5f0] p-1.5 rounded-xl border border-[#e5e5df]">
                    <div>
                      💧 <TranslatedText text="Rain" />: <span className="font-bold text-[#2c2c24]">{day.precipitationChance}%</span>
                    </div>
                    <div>
                      ☀️ UV: <span className="font-bold text-[#2c2c24]">{day.uvIndex || 5}/10</span>
                    </div>
                  </div>

                  {day.activityTip && (
                    <div className="text-[11px] text-[#6b6b5e] font-sans flex items-start gap-1 pt-0.5">
                      <Info className="w-3 h-3 text-[#5A5A40] shrink-0 mt-0.5" />
                      <span className="line-clamp-2"><TranslatedText text={day.activityTip} /></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

