import React, { useState } from "react";
import { ItineraryPlan } from "../types";
import { generateShareableUrl, generateMarkdownItinerary, exportToICS, downloadFile } from "../utils/sharing";
import { X, Share2, Printer, FileText, Calendar, Copy, Check, Download } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: ItineraryPlan;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, plan }) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  if (!isOpen) return null;

  const shareableUrl = generateShareableUrl(plan);
  const markdownContent = generateMarkdownItinerary(plan);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownContent);
    setCopiedMarkdown(true);
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
                Export & Share Itinerary
              </h3>
              <p className="text-xs text-[#8a8a7e] font-sans">{plan.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Options */}
        <div className="p-6 space-y-5">
          {/* 1. Shareable Web Link */}
          <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df]">
            <label className="block text-xs font-serif italic text-[#2c2c24] mb-2 flex items-center justify-between">
              <span>🔗 Instant Shareable Link (Sync Across Devices)</span>
              {copiedLink && <span className="text-[#5A5A40] font-sans font-bold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Copied!</span>}
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
                className="px-4 py-2 rounded-full bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic transition-colors flex items-center gap-1 shrink-0"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Grid of other export formats */}
          <div className="grid grid-cols-2 gap-3.5">
            {/* Print / Save to PDF */}
            <button
              onClick={() => {
                onClose();
                setTimeout(() => window.print(), 200);
              }}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between"
            >
              <Printer className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]">Print / PDF Document</div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5">Clean formatted printable pages</div>
              </div>
            </button>

            {/* Export to Calendar */}
            <button
              onClick={() => exportToICS(plan)}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between"
            >
              <Calendar className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]">Add to Calendar (.ics)</div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5">Google / Apple / Outlook calendar</div>
              </div>
            </button>

            {/* Copy Markdown */}
            <button
              onClick={handleCopyMarkdown}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between"
            >
              <FileText className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24] flex items-center justify-between">
                  <span>Copy Markdown</span>
                  {copiedMarkdown && <Check className="w-3.5 h-3.5 text-[#5A5A40]" />}
                </div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5">For Notion, Apple Notes, Docs</div>
              </div>
            </button>

            {/* Download Raw JSON */}
            <button
              onClick={handleDownloadJSON}
              className="p-4 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#f5f5f0] text-left transition-all group flex flex-col justify-between"
            >
              <Download className="w-5 h-5 text-[#5A5A40] mb-2 group-hover:scale-110 transition-transform" />
              <div>
                <div className="font-serif italic text-sm text-[#2c2c24]">Export Raw JSON</div>
                <div className="text-[11px] text-[#8a8a7e] mt-0.5">Offline backup with coordinates</div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-serif italic rounded-full transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
