import React, { useEffect, useState } from "react";
import { X, ChefHat, Save, Trash2, CheckCircle2, RefreshCw, ArrowLeft } from "lucide-react";
import { TasteProfile, BudgetTier } from "../types";
import { getTasteProfile, saveTasteProfile, clearTasteProfile } from "../utils/storage";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";

interface TasteProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  isInline?: boolean;
  onBack?: () => void;
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

const diningStyleKeys: Record<string, string> = {
  "Pintxo / tapas hopping": "taste.style.pintxo",
  "Sit-down local restaurant": "taste.style.sitdown",
  "Market counter & stalls": "taste.style.market",
  "Quick bites & street food": "taste.style.quick",
  "Long gastronomic tasting": "taste.style.tasting",
  "Picnic & takeaway": "taste.style.picnic",
};

const drinkPrefKeys: Record<string, string> = {
  "Specialty coffee": "taste.drink.coffee",
  "Local wine / txakoli": "taste.drink.wine",
  "Craft beer": "taste.drink.beer",
  "Cocktails & mixed drinks": "taste.drink.cocktails",
  "Cider (sagardotegi style)": "taste.drink.cider",
  "Tea & infusions": "taste.drink.tea",
  "Alcohol-free options": "taste.drink.nonalcoholic",
};

const atmosphereKeys: Record<string, string> = {
  "Quiet & cozy": "taste.atmosphere.quiet",
  "Lively & social": "taste.atmosphere.lively",
  "Terrace / outdoor seating": "taste.atmosphere.terrace",
  "Historic & classic": "taste.atmosphere.historic",
  "Modern & trendy": "taste.atmosphere.modern",
  "Family-friendly": "taste.atmosphere.family",
};

const dislikeKeys: Record<string, string> = {
  "Tourist traps": "taste.dislike.tourist",
  "Chains & franchises": "taste.dislike.chains",
  "Long queues": "taste.dislike.queues",
  "Loud music": "taste.dislike.loud",
  "Overcrowded places": "taste.dislike.crowded",
};

const budgetLabelKeys: Record<string, string> = {
  "Easy-going": "taste.budget.easy",
  "Balanced": "taste.budget.balanced",
  "Treat myself": "taste.budget.luxury",
};

const budgetDescKeys: Record<string, string> = {
  "Counters, daily menus": "taste.budget.easyDesc",
  "Good food, fair price": "taste.budget.balancedDesc",
  "High-end experiences": "taste.budget.luxuryDesc",
};

const EMPTY: Omit<TasteProfile, "updatedAt"> = {
  diningStyles: [],
  drinkPreferences: [],
  atmospheres: [],
  budgetComfort: undefined,
  dietaryNotes: undefined,
  dislikes: [],
};

export const TasteProfileModal: React.FC<TasteProfileModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  isInline = false,
  onBack,
}) => {
  const { t } = useLanguage();
  const { activeEmail, syncStatus, lastSyncTime, syncUserDataWithCloud } = useAuth();
  const [diningStyles, setDiningStyles] = useState<string[]>([]);
  const [drinkPreferences, setDrinkPreferences] = useState<string[]>([]);
  const [atmospheres, setAtmospheres] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState<string[]>([]);
  const [budgetComfort, setBudgetComfort] = useState<BudgetTier | undefined>(undefined);
  const [dietaryNotes, setDietaryNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setIsManualSyncing(true);
    try {
      await syncUserDataWithCloud(true);
    } finally {
      setTimeout(() => setIsManualSyncing(false), 500);
    }
  };

  useEffect(() => {
    if (!isOpen && !isInline) return;

    const existing = getTasteProfile();
    setDiningStyles(existing?.diningStyles || []);
    setDrinkPreferences(existing?.drinkPreferences || []);
    setAtmospheres(existing?.atmospheres || []);
    setDislikes(existing?.dislikes || []);
    setBudgetComfort(existing?.budgetComfort);
    setDietaryNotes(existing?.dietaryNotes || "");
    setSaved(false);

    const handleSync = () => {
      queueMicrotask(() => {
        const existing = getTasteProfile();
        setDiningStyles(existing?.diningStyles || []);
        setDrinkPreferences(existing?.drinkPreferences || []);
        setAtmospheres(existing?.atmospheres || []);
        setDislikes(existing?.dislikes || []);
        setBudgetComfort(existing?.budgetComfort);
        setDietaryNotes(existing?.dietaryNotes || "");
      });
    };

    window.addEventListener("localexplorer_cloud_sync_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [isOpen, isInline]);

  if (!isOpen && !isInline) return null;

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
    setTimeout(() => {
      if (isInline && onBack) {
        onBack();
      } else {
        onClose();
      }
    }, 650);
  };

  const handleClear = () => {
    if (window.confirm(t("taste.clearConfirm", "Clear your taste profile? Dining suggestions will no longer be personalized."))) {
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
    translationKeys: Record<string, string>;
  }> = ({ options, selected, onToggle, translationKeys }) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt.label);
        const displayLabel = translationKeys[opt.label]
          ? t(translationKeys[opt.label], opt.label)
          : opt.label;
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
            <span className="font-sans text-[11px] leading-tight">{displayLabel}</span>
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

  const content = (
    <div className={`bg-white rounded-3xl w-full ${isInline ? "" : "max-w-xl shadow-2xl border border-[#e5e5df] max-h-[90vh]"} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-[#e5e5df] flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {isInline && onBack && (
            <button
              onClick={onBack}
              className="p-2 -ml-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors shrink-0 mr-1 cursor-pointer"
              title="Back to User Profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="p-2 rounded-xl bg-[#ecece4] text-[#5A5A40]">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif text-2xl font-light italic text-[#2c2c24]">{t("taste.title", "Taste Profile")}</h3>
            <p className="text-xs text-[#8a8a7e] font-sans">
              {t("taste.subtitle", "Tell the AI how you like to eat & drink — suggestions adapt to you and to each day's plan")}
            </p>
          </div>
        </div>
        {!isInline && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-[#f5f5f0]/40">
        {/* How it works */}
        <div className="bg-[#ecece4] p-3.5 border border-[#d1d1ca] rounded-2xl text-xs text-[#2c2c24] leading-relaxed">
          {t("taste.explanation", "The AI uses this profile to pick bars, cafés and restaurants that fit you — and pairs them with the flow of the day (a casual counter after a hike, a terrace before a sunset stroll, somewhere cozy on a rainy museum day).")}
        </div>

        <div>
          <SectionLabel hint={t("taste.selectAll", "Select all that apply")}>{t("taste.diningLabel", "How do you like to eat?")}</SectionLabel>
          <ChipGroup options={DINING_STYLES} selected={diningStyles} onToggle={(i) => toggle(diningStyles, setDiningStyles, i)} translationKeys={diningStyleKeys} />
        </div>

        <div>
          <SectionLabel hint={t("taste.selectAll", "Select all that apply")}>{t("taste.drinkLabel", "What do you like to drink?")}</SectionLabel>
          <ChipGroup
            options={DRINK_PREFERENCES}
            selected={drinkPreferences}
            onToggle={(i) => toggle(drinkPreferences, setDrinkPreferences, i)}
            translationKeys={drinkPrefKeys}
          />
        </div>

        <div>
          <SectionLabel hint={t("taste.selectAll", "Select all that apply")}>{t("taste.atmosphereLabel", "What atmosphere do you enjoy?")}</SectionLabel>
          <ChipGroup options={ATMOSPHERES} selected={atmospheres} onToggle={(i) => toggle(atmospheres, setAtmospheres, i)} translationKeys={atmosphereKeys} />
        </div>

        <div>
          <SectionLabel hint={t("taste.avoidHint", "The AI will steer clear of these")}>{t("taste.dislikesLabel", "What should be avoided?")}</SectionLabel>
          <ChipGroup options={DISLIKES} selected={dislikes} onToggle={(i) => toggle(dislikes, setDislikes, i)} translationKeys={dislikeKeys} />
        </div>

        {/* Budget comfort */}
        <div>
          <SectionLabel>{t("taste.budgetLabel", "Usual food & drink budget")}</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            {BUDGET_OPTIONS.map((b) => {
              const labelText = budgetLabelKeys[b.label] ? t(budgetLabelKeys[b.label], b.label) : b.label;
              const descText = budgetDescKeys[b.desc] ? t(budgetDescKeys[b.desc], b.desc) : b.desc;
              return (
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
                    {b.symbol} {labelText}
                  </div>
                  <div className="text-[10px] text-[#8a8a7e] mt-0.5">{descText}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dietary notes */}
        <div>
          <SectionLabel hint={t("taste.optional", "Optional")}>{t("taste.dietaryLabel", "Dietary notes")}</SectionLabel>
          <textarea
            rows={2}
            value={dietaryNotes}
            onChange={(e) => {
              setSaved(false);
              setDietaryNotes(e.target.value);
            }}
            placeholder={t("taste.placeholder", "e.g. Vegetarian, gluten-free, love spicy food, allergic to shellfish…")}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#d1d1ca] bg-white text-xs text-[#2c2c24] placeholder:text-[#8a8a7e] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs">
        <button
          onClick={handleClear}
          className="text-rose-700 hover:text-rose-900 font-medium px-3 py-2 rounded-full hover:bg-rose-50 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {t("taste.clear", "Clear profile")}
        </button>
        <div className="flex items-center space-x-3">
          {saved && (
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("taste.saved", "Saved")}
            </span>
          )}
          <button
            onClick={handleSave}
            className="px-5 py-2.5 bg-[#5A5A40] hover:bg-[#4a4a35] text-white font-serif italic rounded-full transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {t("taste.save", "Save Taste Profile")}
          </button>
        </div>
      </div>

      {/* Footer Cloud Sync Bar */}
      <div className="px-4 py-2.5 bg-white border-t border-[#e5e5df] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 min-w-0">
          <span className={`w-2 h-2 rounded-full shrink-0 ${syncStatus === "synced" ? "bg-emerald-500" : syncStatus === "syncing" ? "bg-amber-500 animate-ping" : "bg-[#8a8a7e]"}`} />
          <div className="truncate">
            <p className="text-[11px] font-medium text-[#2c2c24] truncate">
              {activeEmail}
            </p>
            <p className="text-[10px] text-[#8a8a7e]">
              Cloud Sync: {lastSyncTime}
            </p>
          </div>
        </div>

        <button
          onClick={handleManualSync}
          disabled={isManualSyncing || syncStatus === "syncing"}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-full border border-[#d1d1ca] hover:bg-[#ecece4] text-[#2c2c24] font-medium text-xs transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isManualSyncing || syncStatus === "syncing" ? "animate-spin text-[#5A5A40]" : "text-[#8a8a7e]"}`} />
          <span>{isManualSyncing ? "Syncing..." : "Sync"}</span>
        </button>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="w-full no-print animate-fade-in">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#2c2c24]/40 backdrop-blur-xs flex items-center justify-center p-4 no-print animate-fade-in">
      {content}
    </div>
  );
};
