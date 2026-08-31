import React, { useState } from "react";
import { ActivitySpot, ActivityCategory } from "../types";
import { X, Save, Clock, DollarSign, Tag, MapPin, Lightbulb } from "lucide-react";
import { TranslatedText } from "./TranslatedText";
import { useLanguage } from "../context/LanguageContext";

interface EditActivityModalProps {
  activity: ActivitySpot;
  dayNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedActivity: ActivitySpot, dayNumber: number) => void;
}

export const EditActivityModal: React.FC<EditActivityModalProps> = ({
  activity,
  dayNumber,
  isOpen,
  onClose,
  onSave,
}) => {
  const { t } = useLanguage();
  const [name, setName] = useState(activity.name);
  const [time, setTime] = useState(activity.time);
  const [category, setCategory] = useState<ActivityCategory>(activity.category);
  const [description, setDescription] = useState(activity.description);
  const [insiderTip, setInsiderTip] = useState(activity.insiderTip || "");
  const [approxCost, setApproxCost] = useState(activity.approxCost || "Free");
  const [address, setAddress] = useState(activity.address || "");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const updated: ActivitySpot = {
      ...activity,
      name: name.trim(),
      time: time.trim(),
      category,
      description: description.trim(),
      insiderTip: insiderTip.trim(),
      approxCost: approxCost.trim(),
      address: address.trim() || undefined,
    };

    onSave(updated, dayNumber);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2c24]/70 backdrop-blur-xs animate-in fade-in-20">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#d1d1ca] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between">
          <h3 className="font-serif text-xl font-light italic text-[#2c2c24]">
            <TranslatedText text={`Edit Activity (Day ${dayNumber})`} />
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              <TranslatedText text="Activity / Venue Name" />
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          {/* Time & Cost in 2 cols */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#5A5A40]" />
                <TranslatedText text="Schedule Time Slot" />
              </label>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                placeholder="e.g. 10:00 AM - 12:00 PM"
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[#5A5A40]" />
                <TranslatedText text="Approx. Cost" />
              </label>
              <input
                type="text"
                value={approxCost}
                onChange={(e) => setApproxCost(e.target.value)}
                placeholder="e.g. Free, €15, $25"
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              <TranslatedText text="Category" />
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ActivityCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            >
              <option value="food">{t("cat.food", "Local Food / Eatery")}</option>
              <option value="sightseeing">{t("cat.sightseeing", "Landmark & Sightseeing")}</option>
              <option value="culture">{t("cat.culture", "Culture & Museum")}</option>
              <option value="nature">{t("cat.nature", "Nature & Walk")}</option>
              <option value="hidden-gem">{t("cat.hiddenGem", "Hidden Gem")}</option>
              <option value="cafe">{t("cat.cafe", "Cafe & Roastery")}</option>
              <option value="nightlife">{t("cat.nightlife", "Nightlife & Bar")}</option>
              <option value="relaxation">{t("cat.relaxation", "Relaxation & Wellness")}</option>
              <option value="shopping">{t("cat.shopping", "Artisan & Shopping")}</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              <TranslatedText text="Description & What to Experience" />
            </label>
            <textarea
              rows={3}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          {/* Insider Tip */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#5A5A40]" />
              <TranslatedText text="Insider Tip / Secret Advice" />
            </label>
            <input
              type="text"
              value={insiderTip}
              onChange={(e) => setInsiderTip(e.target.value)}
              placeholder="e.g. Arrive 20 mins before sunset for the best light"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#5A5A40]" />
              <TranslatedText text="Address / Area" />
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Calle 31 de Agosto, Old Town"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[#e5e5df] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#6b6b5e] hover:bg-[#ecece4] transition-colors cursor-pointer"
            >
              <TranslatedText text="Cancel" />
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#5A5A40] text-white font-serif italic text-xs hover:bg-[#4a4a35] transition-all shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span><TranslatedText text="Save Changes" /></span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
