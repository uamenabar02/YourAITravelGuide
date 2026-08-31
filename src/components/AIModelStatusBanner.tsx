import React, { useState } from "react";
import { AIGenerationMetadata } from "../types";
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, Cpu, ChevronDown, ChevronUp, ShieldAlert, Zap } from "lucide-react";

interface AIModelStatusBannerProps {
  meta?: AIGenerationMetadata;
}

export const AIModelStatusBanner: React.FC<AIModelStatusBannerProps> = ({ meta }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!meta) {
    return (
      <div className="bg-[#f5f5f0] border border-[#e5e5df] rounded-2xl p-3.5 flex items-center justify-between text-xs text-[#6b6b5e]">
        <div className="flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-[#5A5A40]" />
          <span className="font-semibold text-[#2c2c24]">AI Engine: System Gemini (Default)</span>
        </div>
        <span className="text-[11px] bg-white px-2 py-0.5 rounded-full border border-[#e5e5df]">Default Mode</span>
      </div>
    );
  }

  const { usedModelId, usedModelName, usedProvider, isFallbackUsed, attemptedModels, hasWarnings, warnings, latencyMs } = meta;

  const failedModels = attemptedModels.filter((m) => !m.success);
  const providerLabel = usedProvider.toUpperCase().replace("_", " ");

  return (
    <div className="space-y-3">
      {/* 1. Model Failure Warning Alert Banner (Shown prominently if any requested model failed) */}
      {(failedModels.length > 0 || hasWarnings) && (
        <div className="bg-amber-50 border-2 border-amber-300/80 rounded-2xl p-4 shadow-xs space-y-2 text-amber-950 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                  <span>AI Model Failure Alert</span>
                  {isFallbackUsed && (
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-amber-200 text-amber-900 rounded-md">
                      Fallback Active
                    </span>
                  )}
                </h4>
                <p className="text-xs text-amber-900/90 mt-0.5">
                  One or more configured AI models encountered errors during generation.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 rounded-lg flex items-center space-x-1 transition-colors border border-amber-300/60"
            >
              <span>{isExpanded ? "Hide Details" : "View Diagnostics"}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* List of failed models */}
          <div className="space-y-2 pt-1 border-t border-amber-200/60">
            {failedModels.map((failed, idx) => (
              <div key={idx} className="bg-white/80 rounded-xl p-2.5 border border-amber-200 text-xs flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold text-gray-900">
                    Failed Model: <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{failed.modelName} ({failed.provider}:{failed.modelId})</span>
                  </div>
                  {failed.error && (
                    <p className="text-red-600/90 text-[11px] font-mono leading-relaxed break-words">
                      Error: {failed.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Details toggle */}
          {isExpanded && warnings.length > 0 && (
            <div className="bg-white p-3 rounded-xl border border-amber-200 text-xs space-y-1 font-mono text-gray-700">
              <p className="font-semibold text-amber-900 font-sans">Execution Log & Warnings:</p>
              {warnings.map((w, i) => (
                <p key={i} className="text-[11px] text-amber-950">• {w}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. Active Model Status & Verification Badge Bar */}
      <div className="bg-white border border-[#e5e5df] rounded-2xl p-3 sm:p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-[#2c2c24] text-xs sm:text-sm">{usedModelName}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] uppercase tracking-wider">
                {providerLabel}
              </span>
            </div>
            <p className="text-[11px] text-[#6b6b5e] flex items-center space-x-2 mt-0.5">
              <span>Model ID: <code className="bg-[#f5f5f0] px-1 py-0.5 rounded text-[#2c2c24] font-mono">{usedModelId}</code></span>
              {latencyMs && (
                <span className="flex items-center text-emerald-700 font-medium">
                  <Zap className="w-3 h-3 mr-0.5" /> {(latencyMs / 1000).toFixed(1)}s
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {isFallbackUsed ? (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Fallback Engaged</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Primary Model Verified</span>
            </span>
          )}

          {attemptedModels.length > 1 && (
            <span className="text-[11px] text-[#6b6b5e] bg-[#f5f5f0] px-2 py-1 rounded-lg border border-[#e5e5df]">
              {attemptedModels.length} models attempted
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
