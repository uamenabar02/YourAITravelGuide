import React from "react";
import { Globe, DollarSign, Thermometer, Compass, Check, ArrowRight, Palette } from "lucide-react";
import { usePreferences, SUPPORTED_CURRENCIES, DistanceUnit, TemperatureUnit } from "../context/PreferencesContext";
import { useAuth } from "../context/AuthContext";
import { TranslatedText } from "./TranslatedText";

const APP_THEMES = [
  { id: "classic", name: "Classic Warm", desc: "Cozy sand & sage accents", colors: ["#f5f5f0", "#2c2c24", "#5A5A40"], mode: "light" },
  { id: "emerald", name: "Emerald Forest", desc: "Sage & pine green accents", colors: ["#f0f5f1", "#1b2e1e", "#2d5a27"], mode: "light" },
  { id: "nordic", name: "Nordic Breeze", desc: "Cool ice & ocean slate accents", colors: ["#f0f4f8", "#1e293b", "#1a5276"], mode: "light" },
  { id: "burgundy", name: "Royal Burgundy", desc: "Regal rose & burgundy accents", colors: ["#f9f3f3", "#321a1e", "#7d1f2d"], mode: "light" },
  { id: "obsidian", name: "Calm Obsidian", desc: "Charcoal & champagne accents", colors: ["#141412", "#f5f5f0", "#c5c1a7"], mode: "dark" },
  { id: "midnight", name: "Midnight Ink", desc: "Ink blue & arctic neon", colors: ["#0b0f19", "#f1f5f9", "#38bdf8"], mode: "dark" },
  { id: "forest-dark", name: "Deep Moss", desc: "Midnight pine & fresh mint", colors: ["#08110b", "#f2f7f4", "#4ade80"], mode: "dark" },
];

export const RegionalPreferencesSection: React.FC = () => {
  const {
    currency,
    currencyOption,
    currencySymbol,
    distanceUnit,
    temperatureUnit,
    theme,
    setCurrency,
    setDistanceUnit,
    setTemperatureUnit,
    setTheme,
    formatAmount,
    formatDistance,
    formatTemperature,
  } = usePreferences();

  const { updateExtendedProfile } = useAuth();

  const handleCurrencySelect = (code: string) => {
    setCurrency(code);
    updateExtendedProfile({ preferredCurrency: code }).catch(() => {});
  };

  const handleDistanceSelect = (unit: DistanceUnit) => {
    setDistanceUnit(unit);
    updateExtendedProfile({ preferredDistanceUnit: unit }).catch(() => {});
  };

  const handleTempSelect = (unit: TemperatureUnit) => {
    setTemperatureUnit(unit);
    updateExtendedProfile({ preferredTemperatureUnit: unit }).catch(() => {});
  };

  const handleThemeSelect = (themeId: string) => {
    setTheme(themeId);
    updateExtendedProfile({ travelStyle: `Theme: ${themeId}` }).catch(() => {});
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-stone-100">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif font-bold text-stone-900 text-base">
              <TranslatedText text="App Themes & Regional Preferences" />
            </h4>
            <p className="text-xs text-stone-500">
              <TranslatedText text="Customize your visual layout, currency values, distance metrics, and temperatures." />
            </p>
          </div>
        </div>
      </div>

      {/* Visual Theme Selection */}
      <div className="space-y-4 pb-3 border-b border-stone-100">
        <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
          <Palette className="w-4 h-4 text-emerald-600" />
          <TranslatedText text="App Color Theme" />
        </label>

        {/* Light Themes Section */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 block">
            <TranslatedText text="Light Themes" />
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {APP_THEMES.filter((t) => t.mode === "light").map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeSelect(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer h-full min-h-[96px] ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 text-stone-900 shadow-3xs"
                      : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center space-x-1">
                      {t.colors.map((colorValue, idx) => (
                        <span
                          key={idx}
                          className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0 block"
                          style={{ backgroundColor: colorValue }}
                        />
                      ))}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs truncate"><TranslatedText text={t.name} /></div>
                    <div className="text-[10px] text-stone-500 leading-tight line-clamp-2"><TranslatedText text={t.desc} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dark Themes Section */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-stone-400 block">
            <TranslatedText text="Atmospheric Dark Themes" />
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {APP_THEMES.filter((t) => t.mode === "dark").map((t) => {
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeSelect(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer h-full min-h-[96px] ${
                    isSelected
                      ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 text-stone-900 shadow-3xs"
                      : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                  }`}
                >
                  <div className="flex items-center justify-between w-full mb-2">
                    <div className="flex items-center space-x-1">
                      {t.colors.map((colorValue, idx) => (
                        <span
                          key={idx}
                          className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0 block"
                          style={{ backgroundColor: colorValue }}
                        />
                      ))}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </div>
                  <div>
                    <div className="font-bold text-xs truncate"><TranslatedText text={t.name} /></div>
                    <div className="text-[10px] text-stone-500 leading-tight line-clamp-2"><TranslatedText text={t.desc} /></div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 1. Preferred Currency Selection */}
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <TranslatedText text="Preferred Display Currency" />
        </label>
        
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.values(SUPPORTED_CURRENCIES).map((curr) => {
            const isSelected = currency === curr.code;
            return (
              <button
                key={curr.code}
                type="button"
                onClick={() => handleCurrencySelect(curr.code)}
                className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 text-stone-900 shadow-3xs"
                    : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-700"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-sm text-emerald-800">{curr.symbol}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <div>
                  <div className="font-bold text-xs truncate">{curr.code}</div>
                  <div className="text-[10px] text-stone-500 truncate">{curr.name.split(" (")[0]}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Units Grid (Distance & Temperature) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100">
        {/* Distance Unit */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-600" />
            <TranslatedText text="Distance Unit" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "km" as DistanceUnit, label: "Kilometers (km)", short: "Metric" },
              { id: "mi" as DistanceUnit, label: "Miles (mi)", short: "Imperial" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDistanceSelect(d.id)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  distanceUnit === d.id
                    ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 text-stone-900 font-bold shadow-3xs"
                    : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600"
                }`}
              >
                <div className="text-xs font-bold">{d.label}</div>
                <div className="text-[10px] text-stone-400 font-normal">{d.short}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Temperature Unit */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-emerald-600" />
            <TranslatedText text="Temperature Scale" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "C" as TemperatureUnit, label: "Celsius (°C)", short: "Metric standard" },
              { id: "F" as TemperatureUnit, label: "Fahrenheit (°F)", short: "Imperial standard" },
            ].map((tUnit) => (
              <button
                key={tUnit.id}
                type="button"
                onClick={() => handleTempSelect(tUnit.id)}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  temperatureUnit === tUnit.id
                    ? "bg-emerald-50/80 border-emerald-600 ring-2 ring-emerald-500/20 text-stone-900 font-bold shadow-3xs"
                    : "bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600"
                }`}
              >
                <div className="text-xs font-bold">{tUnit.label}</div>
                <div className="text-[10px] text-stone-400 font-normal">{tUnit.short}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Live Preview Banner */}
      <div className="bg-[#f5f5f0] p-3.5 rounded-xl border border-[#d1d1ca] flex items-center justify-between text-xs text-[#525246] flex-wrap gap-2">
        <span className="font-bold text-[#2c2c24] flex items-center gap-1">
          <ArrowRight className="w-3.5 h-3.5 text-[#5A5A40]" />
          <TranslatedText text="Active Live Preview:" />
        </span>
        <div className="flex items-center space-x-3 font-mono text-xs">
          <span className="bg-white px-2.5 py-1 rounded-lg border border-[#e5e5df] text-[#2c2c24] font-bold">
            <TranslatedText text="Budget" />: {formatAmount(50)}
          </span>
          <span className="bg-white px-2.5 py-1 rounded-lg border border-[#e5e5df] text-[#2c2c24] font-bold">
            <TranslatedText text="Radius" />: {formatDistance(10)}
          </span>
          <span className="bg-white px-2.5 py-1 rounded-lg border border-[#e5e5df] text-[#2c2c24] font-bold">
            <TranslatedText text="Weather" />: {formatTemperature(22)}
          </span>
        </div>
      </div>
    </div>
  );
};
