import React, { useState, useEffect } from "react";
import { getActivityHistory, removeHistoryItem, clearActivityHistory } from "../utils/storage";
import { ActivityHistoryItem } from "../types";
import { X, History, Trash2, ShieldCheck, MapPin, Clock } from "lucide-react";

interface ActivityHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryUpdated: () => void;
}

export const ActivityHistoryModal: React.FC<ActivityHistoryModalProps> = ({
  isOpen,
  onClose,
  onHistoryUpdated,
}) => {
  const [items, setItems] = useState<ActivityHistoryItem[]>([]);

  useEffect(() => {
    if (isOpen) {
      setItems(getActivityHistory());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRemove = (id: string) => {
    removeHistoryItem(id);
    setItems(getActivityHistory());
    onHistoryUpdated();
  };

  const handleClearAll = () => {
    if (window.confirm("Clear all 30-day activity history? The app will reset the anti-repeat memory filter.")) {
      clearActivityHistory();
      setItems([]);
      onHistoryUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">
                30-Day Anti-Repeat Memory ({items.length})
              </h3>
              <p className="text-xs text-[#8a8a7e] font-sans">
                Visited & recommended spots excluded from Hometown Guide
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Banner */}
        <div className="bg-[#ecece4] p-4 border-b border-[#d1d1ca] flex items-start space-x-2.5 text-xs text-[#2c2c24]">
          <ShieldCheck className="w-4 h-4 text-[#5A5A40] shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            To keep your hometown adventures fresh, LocalExplorer AI remembers suggested spots and hides them for 30 days. You can remove individual spots below if you'd like them re-suggested sooner.
          </div>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 bg-[#f5f5f0]/40">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-8 h-8 text-[#d1d1ca] mx-auto mb-2 stroke-1" />
              <p className="font-serif text-base italic text-[#2c2c24]">No activity history yet</p>
              <p className="text-xs text-[#8a8a7e] mt-0.5">
                As you explore local itineraries, suggested spots are logged here.
              </p>
            </div>
          ) : (
            items.map((item) => {
              const daysAgo = Math.floor((Date.now() - item.timestamp) / (24 * 60 * 60 * 1000));
              return (
                <div
                  key={item.id}
                  className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-serif italic font-medium text-sm text-[#2c2c24] truncate">{item.name}</div>
                    <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                      <span className="capitalize font-medium text-[#5A5A40] bg-[#ecece4] px-2 py-0.5 rounded-full border border-[#d1d1ca]">
                        {item.category}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-[#5A5A40]" />
                        {item.location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-[#8a8a7e]" />
                        {daysAgo === 0 ? "Today" : `${daysAgo}d ago`}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemove(item.id)}
                    title="Allow this spot to be recommended again"
                    className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-[#ecece4] rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex justify-between items-center text-xs">
            <span className="text-[#8a8a7e] font-serif italic">{items.length} spots tracked</span>
            <button
              onClick={handleClearAll}
              className="text-rose-700 hover:text-rose-900 font-medium px-3 py-1 rounded-full hover:bg-rose-50 transition-colors"
            >
              Reset Memory (Clear All)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
