import React, { useState } from "react";
import { ItineraryPlan, DailyPlan } from "../types";
import {
  X,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Sun,
  ShieldAlert,
  Zap,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import { shiftDaySchedule } from "../utils/timeAdjuster";
import { useLanguage } from "../context/LanguageContext";

interface ScheduleAdjusterModalProps {
  plan: ItineraryPlan;
  initialDayNumber?: number;
  isOpen: boolean;
  onClose: () => void;
  onApplyUpdatedDay: (updatedDay: DailyPlan) => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
}

export const ScheduleAdjusterModal: React.FC<ScheduleAdjusterModalProps> = ({
  plan,
  initialDayNumber = 1,
  isOpen,
  onClose,
  onApplyUpdatedDay,
  onShowToast,
}) => {
  const { t } = useLanguage();
  const [selectedDayNum, setSelectedDayNum] = useState<number>(initialDayNumber);
  const [delayMinutes, setDelayMinutes] = useState<number>(30);
  const [startActivityIndex, setStartActivityIndex] = useState<number>(0);
  const [compressDurations, setCompressDurations] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentDay = plan.days.find((d) => d.dayNumber === selectedDayNum) || plan.days[0];
  const shiftResult = shiftDaySchedule(currentDay, delayMinutes, {
    startActivityIndex,
    compressDurations,
    destination: plan.destinationOrTown,
  });

  const handleApply = () => {
    onApplyUpdatedDay(shiftResult.updatedDay);
    onShowToast?.(
      delayMinutes === 0
        ? t("schedule.resetToast", { day: selectedDayNum })
        : t("schedule.applyToast", { day: selectedDayNum, sign: delayMinutes > 0 ? "+" : "", mins: delayMinutes, spot: startActivityIndex + 1 }),
      "success"
    );
    onClose();
  };

  const handleReset = () => {
    setDelayMinutes(0);
    setStartActivityIndex(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-20 select-none"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-[#e5e5df] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30]">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shrink-0 shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="font-serif text-base sm:text-xl font-bold italic text-white truncate">
                  {t("schedule.title", "Live Schedule Adjuster & Delay Recalibration")}
                </h3>
              </div>
              <p className="text-xs text-[#d1d1ca] font-sans truncate sm:whitespace-normal">
                {t("schedule.subtitle", "Running late or ahead of time? Adjust your day with smart route recalculations")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#a8a89f] hover:text-white rounded-full hover:bg-white/10 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-5">
          {/* Day Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-serif italic text-[#2c2c24] font-semibold">
              {t("schedule.selectDay", "Select Day to Adjust:")}
            </label>
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {plan.days.map((day) => (
                <button
                  key={day.dayNumber}
                  onClick={() => {
                    setSelectedDayNum(day.dayNumber);
                    setStartActivityIndex(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-serif italic transition-all shrink-0 whitespace-nowrap ${
                    selectedDayNum === day.dayNumber
                      ? "bg-[#5A5A40] text-white font-semibold shadow-xs"
                      : "bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
                  }`}
                >
                  {t("nav.vacation", "Day")} {day.dayNumber} ({day.activities.length} {t("itinerary.spots", "spots")})
                </button>
              ))}
            </div>
          </div>

          {/* Delay Start Point (When did the delay start?) */}
          <div className="space-y-1.5 bg-[#f5f5f0] p-3.5 rounded-2xl border border-[#e5e5df]">
            <label className="text-xs font-serif font-bold italic text-[#2c2c24] flex items-center justify-between">
              <span>📍 {t("schedule.delayStart", "When has the delay started?")}</span>
              <span className="text-[11px] font-sans font-normal text-[#8a8a7e]">
                {t("schedule.delayStartDesc", "Activities before this remain untouched")}
              </span>
            </label>
            <select
              value={startActivityIndex}
              onChange={(e) => setStartActivityIndex(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-xs text-[#2c2c24] font-sans font-medium focus:outline-none focus:border-[#5A5A40]"
            >
              <option value={0}>{t("schedule.fromStart", "From the very start of the day (All activities)")}</option>
              {currentDay.activities.map((act, idx) => (
                <option key={act.id || idx} value={idx}>
                  {t("schedule.fromSpot", { idx: idx + 1, time: act.time, name: act.name })}
                </option>
              ))}
            </select>
          </div>

          {/* Delay Slider */}
          <div className="bg-white p-4 rounded-2xl border border-[#d1d1ca] space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between text-xs gap-2">
              <span className="font-serif italic font-bold text-[#2c2c24] whitespace-nowrap">
                {t("schedule.offset", "Schedule Shift Offset:")}
              </span>
              <span
                className={`font-serif italic font-bold text-xs sm:text-sm px-2.5 sm:px-3 py-1 rounded-xl border shrink-0 ${
                  delayMinutes > 0
                    ? "bg-amber-50 text-amber-900 border-amber-200"
                    : delayMinutes < 0
                    ? "bg-sky-50 text-sky-900 border-sky-200"
                    : "bg-[#f5f5f0] text-[#6b6b5e] border-[#d1d1ca]"
                }`}
              >
                {delayMinutes > 0
                  ? t("schedule.behind", { minutes: delayMinutes })
                  : delayMinutes < 0
                  ? t("schedule.ahead", { minutes: delayMinutes })
                  : t("schedule.onSchedule", "On Schedule (0m)")}
              </span>
            </div>

            <input
              type="range"
              min={-60}
              max={180}
              step={5}
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value, 10))}
              className="w-full accent-[#5A5A40] cursor-pointer h-2 bg-[#ecece4] rounded-lg"
            />

            <div className="flex justify-between text-[10px] text-[#8a8a7e] font-sans px-1">
              <span>-60 min</span>
              <span>-30 min</span>
              <span className="font-bold text-[#2c2c24]">0m</span>
              <span>+60 min</span>
              <span>+120 min</span>
              <span>+180 min</span>
            </div>
          </div>

          {/* Smart Compression Toggle */}
          <label className="flex items-start sm:items-center space-x-2.5 bg-[#f5f5f0] p-3 rounded-2xl border border-[#e5e5df] cursor-pointer hover:border-[#5A5A40] transition-colors">
            <input
              type="checkbox"
              checked={compressDurations}
              onChange={(e) => setCompressDurations(e.target.checked)}
              className="rounded text-[#5A5A40] focus:ring-0 w-4 h-4 mt-0.5 sm:mt-0 shrink-0"
            />
            <div className="text-xs min-w-0">
              <span className="font-serif italic font-bold text-[#2c2c24] block">
                ⚡ {t("schedule.compress", "Compress Subsequent Spot Durations (Smart Catch-Up)")}
              </span>
              <span className="text-[#6b6b5e] text-[11px] sm:text-xs">
                {t("schedule.compressDesc", "Automatically trims 10-15 minutes from later stops so your day doesn't run past dinner or closing hours.")}
              </span>
            </div>
          </label>

          {/* Intelligent Warnings Box (if any alerts triggered) */}
          {shiftResult.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl space-y-1.5 text-xs">
              <div className="flex items-center space-x-2 font-serif font-bold italic text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>{t("schedule.constraints", "Smart Schedule Constraints Detected:")}</span>
              </div>
              <ul className="space-y-1 text-amber-950">
                {shiftResult.warnings.map((w, idx) => (
                  <li key={idx}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Schedule Comparison Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-serif font-semibold italic text-xs text-[#2c2c24]">
                {t("schedule.preview", { day: selectedDayNum })}
              </h4>
              <span className="text-[10px] text-[#8a8a7e] font-sans">
                {startActivityIndex === 0
                  ? t("schedule.allShifted", "All activities shifted")
                  : t("schedule.shiftedFrom", { spot: startActivityIndex + 1 })}
              </span>
            </div>

            <div className="border border-[#e5e5df] rounded-2xl overflow-hidden divide-y divide-[#e5e5df] text-xs">
              {currentDay.activities.map((act, idx) => {
                const isShifted = idx >= startActivityIndex && delayMinutes !== 0;
                const updatedAct = shiftResult.updatedDay.activities[idx];

                return (
                  <div
                    key={act.id || idx}
                    className={`p-3 flex items-center justify-between gap-2 transition-colors ${
                      isShifted ? "bg-amber-50/40" : "bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono text-[#8a8a7e]">
                          #{idx + 1}
                        </span>
                        <span className="font-medium text-[#2c2c24] truncate">
                          {act.name}
                        </span>
                        {!isShifted && idx < startActivityIndex && (
                          <span className="text-[9px] font-sans px-1.5 py-0.2 rounded bg-[#ecece4] text-[#6b6b5e] shrink-0">
                            {t("schedule.untouched", "Untouched")}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[#8a8a7e] block">
                        {t("schedule.original", { time: act.time })}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-[#8a8a7e]" />
                      <span
                        className={`font-serif italic font-semibold px-2.5 py-1 rounded-xl text-xs border ${
                          isShifted
                            ? "bg-amber-50 text-amber-900 border-amber-200 shadow-2xs font-bold"
                            : "bg-[#f5f5f0] text-[#6b6b5e] border-[#d1d1ca]"
                        }`}
                      >
                        {updatedAct.time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center space-x-1 text-[#6b6b5e] hover:text-[#2c2c24] font-serif italic text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t("schedule.reset", "Reset to Original Schedule")}</span>
          </button>

          <div className="flex items-center space-x-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-[#2c2c24] hover:bg-[#ecece4] font-serif italic text-xs"
            >
              {t("action.cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs text-xs whitespace-nowrap"
            >
              {t("schedule.applyDay", { day: selectedDayNum })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
