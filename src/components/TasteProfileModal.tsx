import React, { useEffect, useState } from "react";
import { X, ChefHat, Save, Trash2, CheckCircle2 } from "lucide-react";
import { TasteProfile, BudgetTier } from "../types";
import { getTasteProfile, saveTasteProfile, clearTasteProfile } from "../utils/storage";

interface TasteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const DINING_STYLES = [
  { label: "Pintxo / tapas hopping", icon: "🍢" },
  { label: "Sit-down local restaurant", icon: "🍽️" },
  { label: "Market counter & stalls", icon: "🧺" },
  { label: "Quick bites & street food", icon: "🥪" },
  { label: "Long gastronomic tasting", icon: "⭐" },
  { label: "Picnic & takeaway", icon: "🥖" },
];

const DRINK_PREFERENCES = [
  { label: "Specialty coffee", icon: "☕" },
  { label: "Local wine / txakoli", icon: "🍷" },
  { label: "Craft beer", icon: "🍺" },
  { label: "Cocktails & mixed drinks", icon: "🍸" },
  { label: "Cider (sagardotegi style)", icon: "🍎" },
  { label: "Tea & infusions", icon: "🍵" },
  { label: "Alcohol-free options", icon: "🫧" },
];

const ATMOSPHERES = [
  { label: "Quiet & cozy", icon: "🕯️" },
  { label: "Lively & social", icon: "🎉" },
  { label: "Terrace / outdoor seating", icon: "🌤️" },
  { label: "Historic & classic", icon: "🏛️" },
  { label: "Modern & trendy", icon: "✨" },
  { label: "Family-friendly", icon: "👨‍👩‍👧" },
];

const DISLIKES = [
  { label: "Tourist traps", icon: "🪤" },
  { label: "Chains & franchises", icon: "🏬" },
  { label: "Long queues", icon: "⏳" },
  { label: "Loud music", icon: "🔊" },
  { label: "Overcrowded places", icon: "🥵" },
];

const BUDGET_OPTIONS: { value: BudgetTier; label: string; symbol: string; desc: string }[] = [
  { value: "budget", label: "Easy-going", symbol: "€", desc: "Counters, daily menus" },
  { value: "mid-range", label: "Balanced", symbol: "€€", desc: "Good food, fair price" },
  { value: "luxury", label: "Treat myself", symbol: "€€€", desc: "High-end experiences" },
];

const EMPTY: Omit<TasteProfile, "updatedAt"> = {
  diningStyles: [],
  drinkPreferences: [],
  atmospheres: [],
  budgetComfort: undefined,
  dietaryNotes: undefined,
  dislikes: [],
};

export const TasteProfileModal: React.FC<TasteProfileModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [diningStyles, setDiningStyles] = useState<string[]>([]);
  const [drinkPreferences, setDrinkPreferences] = useState<string[]>([]);
  const [atmospheres, setAtmospheres] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [budgetComfort, setBudgetComfort] = useState<BudgetTier | undefined>(undefined);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const existing = getTasteProfile();
      setDiningStyles(existing?.diningStyles || []);
      setDrinkPreferences(existing?.drinkPreferences || []);
      setAtmospheres(existing?.atmospheres || []);
      setDislikes(existing?.dislikes || []);
      setBudgetComfort(existing?.budgetComfort);
      setDietaryNotes(existing?.dietaryNotes || "");
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (list: string[], setList: (v: string[]) => void, item: string) => {
    setSaved(false);
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const handleSave = () => {
    saveTasteProfile({
      diningStyles,
      drinkPreferences,
      atmospheres,
      budgetComfort,
      dietaryNotes: dietaryNotes.trim() || undefined,
      dislikes,
    });
    setSaved(true);
    if (onSaved) onSaved();
    setTimeout(() => onClose(), 650);
  };

  const handleClear = () => {
    if (window.confirm("Clear your taste profile? Dining suggestions will no longer be personalized.")) {
      clearTasteProfile();
      setDiningStyles([]);
      setDrinkPreferences([]);
      setAtmospheres([]);
      setDislikes([]);
      setBudgetComfort(undefined);
      setDietaryNotes("");
      setSaved(false);
      if (onSaved) onSaved();
    }
  };

  const ChipGroup: React.FC<{
    options: { label: string; icon: string }[];
    selected: string[];
    onToggle: (item: string) => void;
  }> = ({ options, selected, onToggle }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.label);
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onToggle(opt.label)}
            className={`p-2.5 rounded-xl border text-xs text-left transition-all flex items-center space-x-2 ${
              active
                ? "bg-[#ecece4] text-[#2c2c24] border-[#5A5A40] font-medium shadow-xs"
                : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:border-[#8a8a7e]"
            }`}
          >
            <span className="text-sm">{opt.icon}</span>
            <span className="font-sans text-[11px] leading-tight">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );

  const SectionLabel: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
    <div className="flex items-baseline justify-between mb-2">
      <label className="block text-[10px] uppercase tracking-widest font-bold text-[#8a8a7e]">{children}</label>
      {hint && <span className="text-[10px] text-[#8a8a7e] font-medium">{hint}</span>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-[#e5e5df] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">Taste Profile</h3>
              <p className="text-xs text-[#8a8a7e] font-sans">
                Tell the AI how you like to eat & drink — suggestions adapt to you and to each day's plan
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#f5f5f0]/40">
          {/* How it works */}
          <div className="bg-[#ecece4] p-3.5 border border-[#d1d1ca] rounded-2xl text-xs text-[#2c2c24] leading-relaxed">
            The AI uses this profile to pick bars, cafés and restaurants that fit you — and pairs them with the
            flow of the day (a casual counter after a hike, a terrace before a sunset stroll, somewhere cozy on a
            rainy museum day).
          </div>

          <div>
            <SectionLabel hint="Select all that apply">How do you like to eat?</SectionLabel>
            <ChipGroup options={DINING_STYLES} selected={diningStyles} onToggle={(i) => toggle(diningStyles, setDiningStyles, i)} />
          </div>

          <div>
            <SectionLabel hint="Select all that apply">What do you like to drink?</SectionLabel>
            <ChipGroup
              options={DRINK_PREFERENCES}
              selected={drinkPreferences}
              onToggle={(i) => toggle(drinkPreferences, setDrinkPreferences, i)}
            />
          </div>

          <div>
            <SectionLabel hint="Select all that apply">What atmosphere do you enjoy?</SectionLabel>
            <ChipGroup options={ATMOSPHERES} selected={atmospheres} onToggle={(i) => toggle(atmospheres, setAtmospheres, i)} />
          </div>

          <div>
            <SectionLabel hint="The AI will steer clear of these">What should be avoided?</SectionLabel>
            <ChipGroup options={DISLIKES} selected={dislikes} onToggle={(i) => toggle(dislikes, setDislikes, i)} />
          </div>

          {/* Budget comfort */}
          <div>
            <SectionLabel>Usual food & drink budget</SectionLabel>
            <div className="grid grid-cols-3 gap-2.5">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => {
                    setSaved(false);
                    setBudgetComfort(budgetComfort === b.value ? undefined : b.value);
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    budgetComfort === b.value
                      ? "bg-[#ecece4] text-[#2c2c24] border-[#5A5A40] font-medium shadow-xs"
                      : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:border-[#8a8a7e]"
                  }`}
                >
                  <div className="font-serif italic text-sm text-[#2c2c24]">
                    {b.symbol} {b.label}
                  </div>
                  <div className="text-[10px] text-[#8a8a7e] mt-0.5">{b.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Dietary notes */}
          <div>
            <SectionLabel hint="Optional">Dietary notes</SectionLabel>
            <textarea
              rows={2}
              value={dietaryNotes}
              onChange={(e) => {
                setSaved(false);
                setDietaryNotes(e.target.value);
              }}
              placeholder="e.g. Vegetarian, gluten-free, love spicy food, allergic to shellfish…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs">
          <button
            onClick={handleClear}
            className="text-rose-700 hover:text-rose-900 font-medium px-3 py-2 rounded-full hover:bg-rose-50 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear profile
          </button>
          <div className="flex items-center space-x-3">
            {saved && (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={handleSave}
              className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] text-white font-serif italic rounded-full transition-colors flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              Save Taste Profile
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
