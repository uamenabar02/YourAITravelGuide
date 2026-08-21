import React, { useState } from "react";
import { ActivitySpot, ActivityCategory, Coordinates } from "../types";
import { X, Plus, Clock, DollarSign, MapPin, Lightbulb } from "lucide-react";

interface AddActivityModalProps {
  dayNumber: number;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (newActivity: ActivitySpot, dayNumber: number) => void;
  baseCoordinates: Coordinates;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  dayNumber,
  isOpen,
  onClose,
  onAdd,
  baseCoordinates,
}) => {
  const [name, setName] = useState("");
  const [time, setTime] = useState("14:00 PM - 16:00 PM");
  const [category, setCategory] = useState<ActivityCategory>("sightseeing");
  const [description, setDescription] = useState("");
  const [insiderTip, setInsiderTip] = useState("");
  const [approxCost, setApproxCost] = useState("Free");
  const [address, setAddress] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newActivity: ActivitySpot = {
      id: "custom-act-" + Date.now(),
      name: name.trim(),
      time: time.trim() || "Flexible",
      category,
      description: description.trim() || "Custom planned activity.",
      insiderTip: insiderTip.trim() || "Personal local recommendation.",
      approxCost: approxCost.trim() || "Free",
      address: address.trim() || undefined,
      coordinates: {
        lat: baseCoordinates.lat + (Math.random() - 0.5) * 0.005,
        lng: baseCoordinates.lng + (Math.random() - 0.5) * 0.005,
      },
      rating: 4.9,
    };

    onAdd(newActivity, dayNumber);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2c2c24]/70 backdrop-blur-xs animate-in fade-in-20">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#d1d1ca] flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 px-6 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between">
          <h3 className="font-serif text-xl font-light italic text-[#2c2c24]">
            Add New Spot to Day {dayNumber}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              Spot / Venue Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pintxo Bar Ganbara or Zurriola Beach Sunset"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-sm text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#5A5A40]" />
                Time Slot
              </label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-[#5A5A40]" />
                Approx. Cost
              </label>
              <input
                type="text"
                value={approxCost}
                onChange={(e) => setApproxCost(e.target.value)}
                placeholder="e.g. Free, €15"
                className="w-full px-3 py-2 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ActivityCategory)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            >
              <option value="food">Local Food / Eatery</option>
              <option value="sightseeing">Landmark & Sightseeing</option>
              <option value="culture">Culture & Museum</option>
              <option value="nature">Nature & Walk</option>
              <option value="hidden-gem">Hidden Gem</option>
              <option value="cafe">Cafe & Roastery</option>
              <option value="nightlife">Nightlife & Bar</option>
              <option value="relaxation">Relaxation & Wellness</option>
              <option value="shopping">Artisan & Shopping</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What makes this place special..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3 text-[#5A5A40]" />
              Insider Tip
            </label>
            <input
              type="text"
              value={insiderTip}
              onChange={(e) => setInsiderTip(e.target.value)}
              placeholder="e.g. Try the grilled wild mushrooms with egg yolk"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e] mb-1.5 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#5A5A40]" />
              Address / Area
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Calle San Jerónimo, Parte Vieja"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>

          <div className="pt-3 border-t border-[#e5e5df] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-[#6b6b5e] hover:bg-[#ecece4] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#5A5A40] text-white font-serif italic text-xs hover:bg-[#4a4a35] transition-all shadow-xs flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Spot</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
