import React, { useState, useEffect } from "react";
import { Sparkles, MapPin, Compass, Clock, CheckCircle2, ShieldAlert, Cpu } from "lucide-react";
import { TranslatedText } from "./TranslatedText";

interface GenerationProgressModalProps {
  isOpen: boolean;
  destination: string;
  days?: number;
  mode?: "vacation" | "hometown" | "reiterate";
}

const STAGES = [
  { label: "Connecting to LocalExplorer AI Engine", delaySec: 0.5 },
  { label: "Analyzing location geography & local neighborhoods", delaySec: 1.5 },
  { label: "Curating authentic spots, insider tips & dining", delaySec: 3.5 },
  { label: "Verifying schedule timing, route buffers & transport", delaySec: 5.5 },
  { label: "Finalizing interactive daily plan & high-res cards", delaySec: 7.5 },
];

export const GenerationProgressModal: React.FC<GenerationProgressModalProps> = ({
  isOpen,
  destination,
  days = 3,
  mode = "vacation",
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setElapsed(0);
      setCurrentStageIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        // Update stage based on elapsed time
        if (next >= 7.5) setCurrentStageIndex(4);
        else if (next >= 5.5) setCurrentStageIndex(3);
        else if (next >= 3.5) setCurrentStageIndex(2);
        else if (next >= 1.5) setCurrentStageIndex(1);
        else if (next >= 0.5) setCurrentStageIndex(0);
        return next;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  // Calculate progress percentage (0 to 95%)
  const progressPercent = Math.min(95, Math.round((elapsed / 10.0) * 92));

  const modeTitle =
    mode === "hometown"
      ? `Curating Local Guide for ${destination || "Your Area"}`
      : mode === "reiterate"
      ? `Updating Itinerary with Smart Autofill`
      : `Generating ${days}-Day AI Itinerary for ${destination || "Destination"}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2c24]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-6 text-[#2c2c24]">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-3 border-b border-[#e2e2dc]">
          <div className="p-2.5 bg-[#5A5A40] text-white rounded-xl shadow-sm animate-pulse">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="font-serif font-bold text-lg text-[#2c2c24] leading-tight">
              <TranslatedText text={modeTitle} />
            </h3>
            <p className="text-xs text-[#5A5A40] font-medium flex items-center gap-1 mt-0.5">
              <Compass className="w-3.5 h-3.5 text-[#5A5A40]" />
              <TranslatedText text="LocalExplorer AI • Instant Optimization" />
            </p>
          </div>
        </div>

        {/* Live Timer & Progress Bar */}
        <div className="bg-[#ecece4] p-4 rounded-xl border border-[#d1d1ca] space-y-3">
          <div className="flex items-center justify-between text-xs font-mono font-medium text-[#5A5A40]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 animate-spin" />
              <TranslatedText text="Time Elapsed" />: <strong className="text-[#2c2c24]">{elapsed.toFixed(1)}s</strong>
            </span>
            <span><TranslatedText text="Est. ~5-8s" /></span>
          </div>

          <div className="w-full bg-[#d1d1ca] h-2.5 rounded-full overflow-hidden p-0.5">
            <div
              className="bg-gradient-to-r from-[#5A5A40] to-[#737353] h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Live Stage List */}
        <div className="space-y-2.5">
          {STAGES.map((stage, idx) => {
            const isDone = currentStageIndex > idx;
            const isCurrent = currentStageIndex === idx;

            return (
              <div
                key={idx}
                className={`flex items-center gap-3 text-xs p-2.5 rounded-lg transition-all ${
                  isCurrent
                    ? "bg-white border border-[#5A5A40]/30 shadow-sm font-semibold text-[#2c2c24]"
                    : isDone
                    ? "text-[#5A5A40] opacity-80"
                    : "text-[#8a8a7e] opacity-50"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : isCurrent ? (
                  <div className="w-4 h-4 border-2 border-[#5A5A40] border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 border border-[#b8b8ae] rounded-full shrink-0" />
                )}
                <span><TranslatedText text={stage.label} /></span>
              </div>
            );
          })}
        </div>

        {/* Diagnostic Notice for Long Operations */}
        {elapsed > 12 && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2 animate-in fade-in">
            <Cpu className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold"><TranslatedText text="Deep AI Reasoning in Progress" /></p>
              <p className="text-[11px] opacity-90 mt-0.5">
                <TranslatedText text="Ensuring non-repeating spots and verifying local geography. Standard fallback will load automatically if quota limit is reached." />
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
