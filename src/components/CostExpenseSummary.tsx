import React, { useState, useMemo } from "react";
import {
  ItineraryPlan,
  GroupCollaborationState,
  ExpenseCategory,
  ActivitySpot,
} from "../types";
import {
  calculateTripBudgetOverview,
  logItinerarySpotAsExpense,
  batchImportPlannedSpots,
  TripBudgetOverview,
} from "../utils/budget";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { usePreferences } from "../context/PreferencesContext";
import {
  TrendingUp,
  Receipt,
  Wallet,
  Calendar,
  CheckCircle2,
  Plus,
  ArrowRight,
  Download,
  DollarSign,
  PieChart as PieChartIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface CostExpenseSummaryProps {
  plan: ItineraryPlan;
  collabState: GroupCollaborationState;
  currentName: string;
  onRefreshCollabState: () => void;
  onShowToast: (msg: string) => void;
  onNavigateToTab: (subTab: "list" | "balances" | "summary") => void;
  onOpenAddExpenseWithPreFill: (preFill: {
    title: string;
    amount: string;
    category: ExpenseCategory;
    date: string;
  }) => void;
}

export const CostExpenseSummary: React.FC<CostExpenseSummaryProps> = ({
  plan,
  collabState,
  currentName,
  onRefreshCollabState,
  onShowToast,
  onNavigateToTab,
  onOpenAddExpenseWithPreFill,
}) => {
  const { t } = useLanguage();
  const { formatAmount, currencySymbol } = usePreferences();
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({
    1: true,
  });
  const [showBatchImportModal, setShowBatchImportModal] = useState(false);
  const [batchPayer, setBatchPayer] = useState(currentName);
  const [selectedSpotsToImport, setSelectedSpotsToImport] = useState<Record<string, boolean>>({});

  const overview: TripBudgetOverview = useMemo(() => {
    return calculateTripBudgetOverview(plan, collabState.expenses);
  }, [plan, collabState.expenses]);

  const toggleDayExpanded = (dayNum: number) => {
    setExpandedDays((prev) => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  const handleLogSingleSpot = (activity: ActivitySpot, dayNumber: number) => {
    logItinerarySpotAsExpense(
      plan.id,
      activity,
      dayNumber,
      currentName,
      collabState.members,
      plan.currency || "€",
      plan.startDate
    );
    onRefreshCollabState();
    onShowToast(`Logged "${activity.name}" as shared expense!`);
  };

  const handlePreFillExpense = (activity: ActivitySpot, dayNumber: number) => {
    const day = overview.days.find((d) => d.dayNumber === dayNumber);
    const item = day?.plannedItems.find((p) => p.name === activity.name);
    const amt = item?.estimatedAvg ? item.estimatedAvg.toFixed(2) : "15.00";
    onOpenAddExpenseWithPreFill({
      title: activity.name,
      amount: amt,
      category: item?.category || "food",
      date: day?.dateStr || new Date().toISOString().split("T")[0],
    });
  };

  const handleImportAllForDay = (dayNumber: number) => {
    const day = overview.days.find((d) => d.dayNumber === dayNumber);
    if (!day) return;

    const spotsToImport: Array<{ activity: ActivitySpot; dayNumber: number }> = [];
    const dailyPlan = plan.days?.find((dp) => dp.dayNumber === dayNumber);
    if (dailyPlan && dailyPlan.activities) {
      dailyPlan.activities.forEach((act) => {
        const item = day.plannedItems.find((p) => p.name === act.name);
        if (item && !item.isLogged && item.estimatedAvg > 0) {
          spotsToImport.push({ activity: act, dayNumber });
        }
      });
    }

    if (spotsToImport.length === 0) {
      onShowToast("No unlogged spots with estimated costs found for this day.");
      return;
    }

    const count = batchImportPlannedSpots(
      plan.id,
      spotsToImport,
      currentName,
      collabState.members,
      plan.currency || "€",
      plan.startDate
    );
    onRefreshCollabState();
    onShowToast(`Imported ${count} Day ${dayNumber} spots into Tricount expenses!`);
  };

  const openBatchModal = () => {
    const initialMap: Record<string, boolean> = {};
    overview.days.forEach((d) => {
      d.plannedItems.forEach((p) => {
        if (!p.isLogged && p.estimatedAvg > 0) {
          const key = `${d.dayNumber}-${p.name}`;
          initialMap[key] = true;
        }
      });
    });
    setSelectedSpotsToImport(initialMap);
    setShowBatchImportModal(true);
  };

  const handleExecuteBatchImport = () => {
    const spotsToImport: Array<{ activity: ActivitySpot; dayNumber: number }> = [];
    overview.days.forEach((d) => {
      const dailyPlan = plan.days?.find((dp) => dp.dayNumber === d.dayNumber);
      if (dailyPlan && dailyPlan.activities) {
        dailyPlan.activities.forEach((act) => {
          const key = `${d.dayNumber}-${act.name}`;
          if (selectedSpotsToImport[key]) {
            spotsToImport.push({ activity: act, dayNumber: d.dayNumber });
          }
        });
      }
    });

    if (spotsToImport.length === 0) {
      onShowToast("Please select at least one activity to import.");
      return;
    }

    const count = batchImportPlannedSpots(
      plan.id,
      spotsToImport,
      batchPayer || currentName,
      collabState.members,
      plan.currency || "€",
      plan.startDate
    );
    onRefreshCollabState();
    setShowBatchImportModal(false);
    onShowToast(`Successfully imported ${count} activities into shared expenses!`);
  };

  return (
    <div className="space-y-6 animate-in fade-in-10">
      {/* 1. TOP HERO KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Smartphone consolidated Budget Summary Card */}
        <div className="block sm:hidden p-4 rounded-2xl bg-white border border-[#e5e5df] shadow-2xs space-y-3 hover:border-[#5A5A40] transition-all">
          <div className="flex items-center justify-between border-b border-[#f5f5f0] pb-2">
            <span className="text-xs font-serif font-bold italic text-[#2c2c24] flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#5A5A40]" />
              <TranslatedText text="Trip Budget Summary" />
            </span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-serif italic font-bold border ${
                overview.budgetStatus === "under"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : overview.budgetStatus === "over"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-[#f5f5f0] text-[#5A5A40] border-[#d1d1ca]"
              }`}
            >
              {overview.budgetStatus === "under" ? (
                <>
                  <TranslatedText text={t("budget.underBudget", "Under Budget")} /> ({Math.abs(overview.variancePercentage)}%)
                </>
              ) : overview.budgetStatus === "over" ? (
                <>
                  <TranslatedText text={t("budget.overBudget", "Over Budget")} /> (+{overview.variancePercentage}%)
                </>
              ) : (
                <TranslatedText text={t("budget.onTrack", "On Track")} />
              )}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] text-[#8a8a7e] font-sans block">
                <TranslatedText text="Planned Itinerary" />
              </span>
              <div className="text-base font-serif font-bold italic text-[#2c2c24]">
                {formatAmount(overview.totalPlannedAvg)}
              </div>
              <span className="text-[9px] text-[#6b6b5e] font-mono block">
                ~{formatAmount(overview.dailyPlannedAvg)}/day
              </span>
            </div>

            <div className="space-y-0.5">
              <span className="text-[10px] text-[#8a8a7e] font-sans block">
                <TranslatedText text="Actual Logged" />
              </span>
              <div className="text-base font-serif font-bold italic text-[#2c2c24]">
                {formatAmount(overview.totalActualSpent)}
              </div>
              <span className="text-[9px] text-[#6b6b5e] font-mono block">
                {collabState.expenses.length} logs
              </span>
            </div>
          </div>
        </div>

        {/* Planned Itinerary Cost - Desktop/Tablet only */}
        <div className="hidden sm:block p-4 rounded-2xl bg-white border border-[#e5e5df] shadow-2xs space-y-1.5 hover:border-[#5A5A40] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif italic text-[#8a8a7e]">
              <TranslatedText text={t("budget.plannedEstimate", "Planned Itinerary Estimate")} />
            </span>
            <span className="p-1.5 rounded-xl bg-[#f5f5f0] text-[#5A5A40]">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-serif font-bold italic text-[#2c2c24]">
            {formatAmount(overview.totalPlannedAvg)}
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#6b6b5e]">
            <span className="font-mono">
              ~{formatAmount(overview.dailyPlannedAvg)}/<TranslatedText text="day" />
            </span>
            <span>•</span>
            <span className="truncate">
              {formatAmount(overview.totalPlannedMin)} - {formatAmount(overview.totalPlannedMax)} <TranslatedText text="range" />
            </span>
          </div>
        </div>

        {/* Actual Logged Expenses - Desktop/Tablet only */}
        <div className="hidden sm:block p-4 rounded-2xl bg-white border border-[#e5e5df] shadow-2xs space-y-1.5 hover:border-[#5A5A40] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif italic text-[#8a8a7e]">
              <TranslatedText text={t("budget.actualLogged", "Actual Logged Spend")} />
            </span>
            <span className="p-1.5 rounded-xl bg-[#5A5A40]/10 text-[#5A5A40]">
              <Receipt className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-serif font-bold italic text-[#2c2c24]">
            {formatAmount(overview.totalActualSpent)}
          </div>
          <div className="flex items-center space-x-1.5 text-[11px] text-[#6b6b5e]">
            <span className="font-mono">
              ~{formatAmount(overview.dailyActualAvg)}/<TranslatedText text="day" />
            </span>
            <span>•</span>
            <span>{collabState.expenses.length} <TranslatedText text="expenses logged" /></span>
          </div>
        </div>

        {/* Budget Variance & Health Status - Desktop/Tablet only */}
        <div className="hidden sm:block p-4 rounded-2xl bg-white border border-[#e5e5df] shadow-2xs space-y-1.5 hover:border-[#5A5A40] transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-serif italic text-[#8a8a7e]">
              <TranslatedText text={t("budget.budgetStatus", "Budget Health & Variance")} />
            </span>
            <span className="p-1.5 rounded-xl bg-emerald-50 text-emerald-800">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-xl font-serif italic font-bold border ${
                overview.budgetStatus === "under"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : overview.budgetStatus === "over"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : "bg-[#f5f5f0] text-[#5A5A40] border-[#d1d1ca]"
              }`}
            >
              {overview.budgetStatus === "under" ? (
                <>
                  <TranslatedText text={t("budget.underBudget", "Under Budget")} /> ({Math.abs(overview.variancePercentage)}%)
                </>
              ) : overview.budgetStatus === "over" ? (
                <>
                  <TranslatedText text={t("budget.overBudget", "Over Budget")} /> (+{overview.variancePercentage}%)
                </>
              ) : (
                <TranslatedText text={t("budget.onTrack", "On Track / Balanced")} />
              )}
            </span>
          </div>
          <div className="text-[11px] text-[#6b6b5e] truncate">
            <TranslatedText text="Target Tier:" /> <strong className="capitalize">{overview.budgetTier}</strong> (~{overview.currency}{overview.dailyTargetBudget}/<TranslatedText text="day" />)
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="p-4 rounded-2xl bg-[#5A5A40] text-white shadow-2xs flex flex-col justify-between space-y-2">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-serif italic text-[#d1d1ca]">
                <TranslatedText text={t("budget.smartImport", "Smart Expense Sync")} />
              </span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <p className="text-[11px] text-[#e5e5df] mt-1 leading-snug">
              <TranslatedText text={t("budget.importDesc", "Import itinerary spots directly into Tricount shared ledger.")} />
            </p>
          </div>
          <button
            type="button"
            onClick={openBatchModal}
            className="w-full py-1.5 px-3 bg-white text-[#2c2c24] hover:bg-[#f5f5f0] rounded-xl text-xs font-serif italic font-bold transition-all shadow-xs flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span><TranslatedText text={t("budget.importSpotsBtn", "Import Planned Spots")} /></span>
          </button>
        </div>
      </div>

      {/* 2. CATEGORY BUDGET UTILIZATION PROGRESS BARS */}
      <div className="p-5 rounded-2xl bg-white border border-[#e5e5df] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#f5f5f0] pb-3">
          <div className="flex items-center space-x-2">
            <PieChartIcon className="w-4 h-4 text-[#5A5A40]" />
            <h4 className="font-serif italic font-bold text-sm text-[#2c2c24]">
              <TranslatedText text={t("budget.categoryComparison", "Category Budget vs. Actual Expenditure")} />
            </h4>
          </div>
          <span className="text-xs text-[#8a8a7e] font-mono">
            {overview.categories.filter((c) => c.plannedAvg > 0 || c.actualSpent > 0).length} <TranslatedText text="active categories" />
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {overview.categories
            .filter((c) => c.plannedAvg > 0 || c.actualSpent > 0)
            .map((cat) => {
              const isOver = cat.actualSpent > cat.plannedAvg && cat.plannedAvg > 0;
              const barPct = cat.plannedAvg > 0 ? Math.min(100, Math.round((cat.actualSpent / cat.plannedAvg) * 100)) : cat.actualSpent > 0 ? 100 : 0;

              return (
                <div
                  key={cat.category}
                  className="p-3.5 rounded-xl bg-[#fafaf7] border border-[#e5e5df] space-y-2 hover:bg-white hover:border-[#8a8a7e] transition-all"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2 font-medium text-[#2c2c24]">
                      <span className="text-base">{cat.emoji}</span>
                      <span><TranslatedText text={cat.label} /></span>
                    </div>
                    <div className="text-right">
                      <span className="font-serif italic font-bold text-[#2c2c24]">
                        {overview.currency}{cat.actualSpent.toFixed(2)}
                      </span>
                      <span className="text-[#8a8a7e] text-[11px] ml-1">
                        / {overview.currency}{cat.plannedAvg.toFixed(2)} <TranslatedText text="plan" />
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 rounded-full bg-[#e5e5df] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver
                          ? "bg-rose-500"
                          : barPct > 80
                          ? "bg-amber-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-[#8a8a7e]">
                    <span>
                      {cat.percentageUsed}% <TranslatedText text="of planned budget used" />
                    </span>
                    {isOver && (
                      <span className="text-rose-700 font-semibold flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3" />
                        <span>+{overview.currency}{(cat.actualSpent - cat.plannedAvg).toFixed(2)} <TranslatedText text="over" /></span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* 3. DAY-BY-DAY BUDGET BREAKDOWN & ACTIVITY IMPORT MATRIX */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="font-serif italic font-bold text-base text-[#2c2c24] flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-[#5A5A40]" />
              <span><TranslatedText text={t("budget.dayByDaySchedule", "Daily Itinerary Cost Breakdown & Activity Importer")} /></span>
            </h4>
            <p className="text-xs text-[#6b6b5e] mt-0.5">
              <TranslatedText text={t("budget.dailyBreakdownDesc", "Compare each day's planned activities against actual logged expenses.")} />
            </p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => {
                const allExpanded: Record<number, boolean> = {};
                overview.days.forEach((d) => (allExpanded[d.dayNumber] = true));
                setExpandedDays(allExpanded);
              }}
              className="text-xs text-[#5A5A40] hover:underline font-medium cursor-pointer"
            >
              <TranslatedText text="Expand All" />
            </button>
            <span className="text-[#d1d1ca]">•</span>
            <button
              type="button"
              onClick={() => setExpandedDays({})}
              className="text-xs text-[#8a8a7e] hover:underline font-medium cursor-pointer"
            >
              <TranslatedText text="Collapse All" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {overview.days.map((day) => {
            const isExpanded = !!expandedDays[day.dayNumber];
            const unloggedCount = day.plannedItems.filter((p) => !p.isLogged && p.estimatedAvg > 0).length;

            return (
              <div
                key={day.dayNumber}
                className="bg-white rounded-2xl border border-[#e5e5df] shadow-2xs overflow-hidden transition-all duration-200 hover:border-[#8a8a7e]"
              >
                {/* Header Row */}
                <div
                  onClick={() => toggleDayExpanded(day.dayNumber)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer bg-[#fcfcf9] hover:bg-[#f5f5f0]/60 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-7 h-7 rounded-xl bg-[#5A5A40] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs font-mono">
                      D{day.dayNumber}
                    </span>
                    <div>
                      <h5 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                        <TranslatedText text={day.dayTitle} />
                      </h5>
                      <div className="flex items-center space-x-2 text-[11px] text-[#6b6b5e]">
                        <span className="font-mono">📅 {day.dateStr}</span>
                        <span>•</span>
                        <span>{day.activitiesCount} <TranslatedText text="spots" /></span>
                        {day.loggedExpensesCount > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-800 font-medium">
                              {day.loggedExpensesCount} <TranslatedText text="logged in Tricount" />
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#e5e5df]">
                    <div className="text-right text-xs">
                      <div className="font-serif italic font-bold text-sm text-[#2c2c24]">
                        <TranslatedText text="Actual" />: {overview.currency}{day.actualSpent.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-[#8a8a7e]">
                        <TranslatedText text="Plan" />: ~{overview.currency}{day.plannedAvg.toFixed(2)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      {unloggedCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImportAllForDay(day.dayNumber);
                          }}
                          className="px-2.5 py-1 bg-[#5A5A40]/10 hover:bg-[#5A5A40] hover:text-white text-[#5A5A40] rounded-xl text-[11px] font-serif italic font-semibold transition-colors flex items-center space-x-1 cursor-pointer"
                          title="Import all unlogged spots for this day"
                        >
                          <Download className="w-3 h-3" />
                          <span><TranslatedText text="Import Day" /> ({unloggedCount})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="p-1.5 text-[#8a8a7e] hover:text-[#2c2c24] rounded-lg"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Activity Items List */}
                {isExpanded && (
                  <div className="p-4 border-t border-[#e5e5df] bg-white space-y-2.5 animate-in slide-in-from-top-1 duration-150">
                    <div className="text-xs text-[#8a8a7e] font-serif italic flex items-center justify-between pb-1">
                      <span><TranslatedText text="Planned Activity Venues & Estimated Costs:" /></span>
                      <span><TranslatedText text="Action / Status" /></span>
                    </div>

                    {day.plannedItems.length === 0 ? (
                      <div className="text-center py-4 text-xs text-[#8a8a7e] italic">
                        <TranslatedText text="No planned activities for this day." />
                      </div>
                    ) : (
                      day.plannedItems.map((item, idx) => {
                        const spot = plan.days
                          ?.find((dp) => dp.dayNumber === day.dayNumber)
                          ?.activities?.find((a) => a.name === item.name);

                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-[#fafaf7] border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white hover:border-[#8a8a7e] transition-all"
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center space-x-2">
                                <span className="font-serif italic font-bold text-[#2c2c24]">
                                  <TranslatedText text={item.name} />
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#f5f5f0] text-[#6b6b5e] border border-[#e5e5df] capitalize">
                                  <TranslatedText text={item.category} />
                                </span>
                              </div>
                              <div className="text-[11px] text-[#8a8a7e] flex items-center space-x-2">
                                <span><TranslatedText text="Estimated:" /> <strong className="text-[#2c2c24] font-medium"><TranslatedText text={item.approxCostStr} /></strong></span>
                                {item.estimatedAvg > 0 && (
                                  <>
                                    <span>•</span>
                                    <span>~{overview.currency}{item.estimatedAvg.toFixed(2)} <TranslatedText text="calculated" /></span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                              {item.isLogged ? (
                                <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-serif italic text-[11px] font-semibold flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span><TranslatedText text="Logged in Tricount" /></span>
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handlePreFillExpense(spot || { name: item.name, category: item.category, description: "", approxCost: item.approxCostStr, isSwapped: false, vibes: [] }, day.dayNumber)}
                                    className="px-2.5 py-1 bg-[#f5f5f0] hover:bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] rounded-xl text-[11px] font-serif italic font-medium transition-colors flex items-center space-x-1 cursor-pointer"
                                    title="Edit details before adding to expenses"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span><TranslatedText text="Customize" /></span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleLogSingleSpot(spot || { name: item.name, category: item.category, description: "", approxCost: item.approxCostStr, isSwapped: false, vibes: [] }, day.dayNumber)}
                                    className="px-2.5 py-1 bg-[#5A5A40] hover:bg-[#4a4a35] text-white rounded-xl text-[11px] font-serif italic font-bold transition-colors shadow-2xs flex items-center space-x-1 cursor-pointer"
                                    title="Quick 1-click import with estimated cost"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span><TranslatedText text="1-Click Log" /></span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. NAVIGATION SHORTCUT BUTTONS */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#fafaf7] rounded-2xl border border-[#e5e5df] text-xs">
        <div className="text-[#6b6b5e]">
          <TranslatedText text="Looking for individual ledger entries or settlement calculations?" />
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onNavigateToTab("list")}
            className="px-3.5 py-1.5 bg-white border border-[#d1d1ca] hover:bg-[#f5f5f0] text-[#2c2c24] rounded-xl font-serif italic font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
          >
            <Receipt className="w-3.5 h-3.5 text-[#5A5A40]" />
            <span><TranslatedText text="Open Expense Ledger" /></span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToTab("balances")}
            className="px-3.5 py-1.5 bg-[#5A5A40] text-white hover:bg-[#4a4a35] rounded-xl font-serif italic font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
          >
            <PieChartIcon className="w-3.5 h-3.5" />
            <span><TranslatedText text="View Balances & Settle Up" /></span>
          </button>
        </div>
      </div>

      {/* 5. BATCH IMPORT ITINERARY EXPENSES MODAL */}
      {showBatchImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-20">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#e5e5df] animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
              <div>
                <h4 className="font-serif italic font-bold text-lg text-[#2c2c24] flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-amber-600" />
                  <span><TranslatedText text="Batch Import Itinerary Spots" /></span>
                </h4>
                <p className="text-xs text-[#6b6b5e] mt-0.5">
                  <TranslatedText text="Select which planned itinerary activities to log into Tricount shared expenses." />
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchImportModal(false)}
                className="text-[#8a8a7e] hover:text-[#2c2c24] text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Payer selection */}
            <div className="bg-[#fafaf7] p-3 rounded-2xl border border-[#e5e5df] space-y-1 text-xs">
              <label className="font-serif italic text-[#6b6b5e] block">
                <TranslatedText text="Who paid (or is paying) for these imported expenses?" />
              </label>
              <select
                value={batchPayer}
                onChange={(e) => setBatchPayer(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-[#d1d1ca] rounded-xl font-medium text-[#2c2c24] focus:outline-none"
              >
                {collabState.members.map((m) => (
                  <option key={m} value={m}>
                    {m} {m === currentName ? "(You)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Spots list */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1 text-xs">
              {overview.days.flatMap((d) =>
                d.plannedItems
                  .filter((p) => !p.isLogged && p.estimatedAvg > 0)
                  .map((p) => {
                    const key = `${d.dayNumber}-${p.name}`;
                    const isChecked = !!selectedSpotsToImport[key];

                    return (
                      <label
                        key={key}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-[#5A5A40]/10 border-[#5A5A40]/30 text-[#2c2c24]"
                            : "bg-[#fcfcf9] border-[#e5e5df] text-[#6b6b5e]"
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedSpotsToImport((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }));
                            }}
                            className="rounded text-[#5A5A40] focus:ring-0 w-3.5 h-3.5"
                          />
                          <div className="min-w-0">
                            <span className="font-serif italic font-bold text-[#2c2c24] block truncate">
                              <TranslatedText text={`Day ${d.dayNumber}:`} /> <TranslatedText text={p.name} />
                            </span>
                            <span className="text-[10px] text-[#8a8a7e]">
                              <TranslatedText text={p.category} /> • <TranslatedText text={p.approxCostStr} />
                            </span>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-[#5A5A40] shrink-0">
                          ~{overview.currency}{p.estimatedAvg.toFixed(2)}
                        </span>
                      </label>
                    );
                  })
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[#e5e5df] pt-3 text-xs">
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    overview.days.forEach((d) => {
                      d.plannedItems.forEach((p) => {
                        if (!p.isLogged && p.estimatedAvg > 0) {
                          all[`${d.dayNumber}-${p.name}`] = true;
                        }
                      });
                    });
                    setSelectedSpotsToImport(all);
                  }}
                  className="text-[#5A5A40] hover:underline font-medium cursor-pointer"
                >
                  <TranslatedText text="Select All" />
                </button>
                <span className="text-[#d1d1ca]">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedSpotsToImport({})}
                  className="text-[#8a8a7e] hover:underline font-medium cursor-pointer"
                >
                  <TranslatedText text="Deselect All" />
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBatchImportModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-[#6b6b5e] hover:bg-[#f5f5f0] font-serif italic cursor-pointer"
                >
                  <TranslatedText text="Cancel" />
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatchImport}
                  className="px-4 py-1.5 bg-[#5A5A40] text-white hover:bg-[#4a4a35] rounded-xl font-serif italic font-bold shadow-xs cursor-pointer"
                >
                  <TranslatedText text="Import Selected" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
