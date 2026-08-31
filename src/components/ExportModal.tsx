import React, { useState } from "react";
import { ItineraryPlan } from "../types";
import { generateShareableUrl, generateMarkdownItinerary, exportToICS, downloadFile } from "../utils/sharing";
import { X, Share2, Printer, FileText, Calendar, Copy, Check, Download, MapPin } from "lucide-react";
import { TranslatedText } from "./TranslatedText";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ItineraryPlan;
  onOpenGoogleMapsExport?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  plan,
  onOpenGoogleMapsExport,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen) return null;

  const shareableUrl = generateShareableUrl(plan);
  const markdownContent = generateMarkdownItinerary(plan);

  // Clipboard helper that also works in non-secure contexts where
  // navigator.clipboard is unavailable (falls back to execCommand).
  const copyText = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to legacy path
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyText(shareableUrl);
    setCopiedLink(ok);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMarkdown = async () => {
    const ok = await copyText(markdownContent);
    setCopiedMarkdown(ok);
    setTimeout(() => setCopiedMarkdown(false), 2500);
  };

  const handleDownloadJSON = () => {
    const filename = `${plan.destinationOrTown.replace(/[^a-zA-Z0-9]/g, "_")}_itinerary.json`;
    downloadFile(JSON.stringify(plan, null, 2), filename, "application/json");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">
                <TranslatedText text="Export & Share Itinerary" />
              </h3>
              <p className="text-xs text-[#8a8a7e] font-sans">{plan.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-6 space-y-5">
          {/* 1. Shareable Web Link */}
          <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df]">
            <label className="block text-xs font-serif italic text-[#2c2c24] mb-2 flex items-center justify-between">
              <span><TranslatedText text="🔗 Instant Shareable Link (Sync Across Devices)" /></span>
              {copiedLink && <span className="text-[#5A5A40] font-sans font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> <TranslatedText text="Copied!" /></span>}
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                readOnly
                value={shareableUrl}
                className="flex-1 px-3.5 py-2 rounded-full bg-white border border-[#d1d1ca] text-xs text-[#2c2c24] truncate focus:outline-none"
              />
              <button
                onClick={handleCopyLink}
                className="px-4 py-2 rounded-full bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? <TranslatedText text="Copied" /> : <TranslatedText text="Copy" />}</span>
              </button>
            </div>
          </div>

          {/* Grid of other export formats */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Google Maps List Export */}
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenGoogleMapsExport) {
                  onOpenGoogleMapsExport();
                }
              }}
              className="p-4 rounded-2xl border-2 border-red-200 bg-red-50/50 hover:bg-red-50 text-left transition-all group flex flex-col justify-between col-span-2 shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="p-1.5 rounded-xl bg-red-100 text-red-700">
                  <MapPin className="w-5 h-5 group-hover:scale-110 transition-transform" />
                </div>
                <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold font-sans uppercase">
                  <TranslatedText text="Featured" />
                </span>
              </div>
              <div>
                <div className="font-serif italic text-base font-bold text-[#2c2c24]">
                  <TranslatedText text="Export to Google Maps List" />
                </div>
                <div className="text-xs text-[#6b6b5e] mt-0.5">
                  <TranslatedText text="Export full trip or pick specific days for Google Maps, My Maps CSV & QR Code" />
                </div>
              </div>
            </button>

            {/* Print / Save to PDF */}
            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.print(), 200);
              }}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <Printer className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]"><TranslatedText text="Print / PDF Document" /></div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5"><TranslatedText text="Clean formatted printable pages" /></div>
              </div>
            </button>

            {/* Export to Calendar */}
            <button
              onClick={() => exportToICS(plan)}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <Calendar className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]"><TranslatedText text="Add to Calendar (.ics)" /></div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5"><TranslatedText text="Google / Apple / Outlook calendar" /></div>
              </div>
            </button>

            {/* Copy Markdown */}
            <button
              onClick={handleCopyMarkdown}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <FileText className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24] flex items-center justify-between">
                  <span><TranslatedText text="Copy Markdown" /></span>
                  {copiedMarkdown && <Check className="w-3.5 h-3.5 text-[#5A5A40]" />}
                </div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5"><TranslatedText text="For Notion, Apple Notes, Docs" /></div>
              </div>
            </button>

            {/* Download Raw JSON */}
            <button
              onClick={handleDownloadJSON}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between cursor-pointer"
            >
              <Download className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]"><TranslatedText text="Export Raw JSON" /></div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5"><TranslatedText text="Offline backup with coordinates" /></div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic rounded-full transition-colors cursor-pointer"
          >
            <TranslatedText text="Done" />
          </button>
        </div>
      </div>
    </div>
  );
};
