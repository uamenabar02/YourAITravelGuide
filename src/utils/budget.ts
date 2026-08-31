import { ItineraryPlan, ActivitySpot, GroupExpenseItem, ExpenseCategory, SplitMode } from "../types";
import { addGroupExpense } from "./collaboration";

export interface PlannedCostItem {
  activityId?: string;
  name: string;
  category: ExpenseCategory;
  approxCostStr: string;
  estimatedMin: number;
  estimatedMax: number;
  estimatedAvg: number;
  dayNumber: number;
  isLogged?: boolean;
}

export interface DailyBudgetComparison {
  dayNumber: number;
  dayTitle: string;
  theme?: string;
  dateStr?: string;
  plannedMin: number;
  plannedMax: number;
  plannedAvg: number;
  actualSpent: number;
  activitiesCount: number;
  loggedExpensesCount: number;
  plannedItems: PlannedCostItem[];
}

export interface CategoryBudgetComparison {
  category: ExpenseCategory;
  label: string;
  emoji: string;
  plannedAvg: number;
  actualSpent: number;
  percentageUsed: number;
}

export interface TripBudgetOverview {
  currency: string;
  totalPlannedMin: number;
  totalPlannedMax: number;
  totalPlannedAvg: number;
  totalActualSpent: number;
  dailyPlannedAvg: number;
  dailyActualAvg: number;
  dailyTargetBudget?: number;
  budgetTier?: string;
  budgetStatus: "under" | "on_track" | "over";
  variancePercentage: number;
  days: DailyBudgetComparison[];
  categories: CategoryBudgetComparison[];
}

/**
 * Parses approximate cost string into numerical bounds.
 * e.g.:
 *  "Free" -> 0
 *  "€15 - €30" -> min: 15, max: 30, avg: 22.5
 *  "$20 - $35" -> min: 20, max: 35, avg: 27.5
 *  "¥1,000 (~$7)" -> min: 7, max: 7, avg: 7
 *  "$50 MXN (~$3)" -> min: 3, max: 3, avg: 3
 *  "€18" -> min: 18, max: 18, avg: 18
 *  "Free entry (€5 drinks)" -> min: 5, max: 5, avg: 5
 */
export function parseApproxCost(costStr?: string): {
  min: number;
  max: number;
  avg: number;
  isFree: boolean;
} {
  if (!costStr) {
    return { min: 0, max: 0, avg: 0, isFree: true };
  }

  const str = costStr.trim();
  const lower = str.toLowerCase();

  if (lower === "free" || lower === "gratis" || lower === "gratuit" || lower === "0" || lower === "€0" || lower === "$0") {
    return { min: 0, max: 0, avg: 0, isFree: true };
  }

  // Check for conversion notes like "(~$7)" or "(~€12)"
  const approxMatch = str.match(/\(~[€$¥£]?\s*([0-9]+(?:\.[0-9]+)?)\)/i);
  if (approxMatch && approxMatch[1]) {
    const val = parseFloat(approxMatch[1]);
    return { min: val, max: val, avg: val, isFree: false };
  }

  // Check for range with hyphen e.g. "€15 - €30" or "10-25"
  const rangeMatch = str.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–—]\s*[€$¥£]?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    const avg = (min + max) / 2;
    return { min, max, avg, isFree: false };
  }

  // Check for single numbers e.g. "€18" or "15 EUR" or "25.50"
  const singleMatch = str.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (singleMatch && singleMatch[1]) {
    const val = parseFloat(singleMatch[1]);
    return { min: val, max: val, avg: val, isFree: val === 0 };
  }

  // Default fallback if no number parsed but mentions drinks/tasting
  if (lower.includes("drink") || lower.includes("tasting") || lower.includes("pintxo") || lower.includes("snack")) {
    return { min: 5, max: 12, avg: 8.5, isFree: false };
  }

  return { min: 0, max: 0, avg: 0, isFree: true };
}

/**
 * Maps an ActivitySpot category to an ExpenseCategory.
 */
export function mapActivityCategoryToExpenseCategory(cat?: string): ExpenseCategory {
  if (!cat) return "activities";
  const lower = cat.toLowerCase();

  if (
    lower.includes("restaurant") ||
    lower.includes("food") ||
    lower.includes("cafe") ||
    lower.includes("tapas") ||
    lower.includes("pintxos") ||
    lower.includes("bar") ||
    lower.includes("gastronomy") ||
    lower.includes("bakery") ||
    lower.includes("breakfast") ||
    lower.includes("lunch") ||
    lower.includes("dinner") ||
    lower.includes("culinary") ||
    lower.includes("bistro") ||
    lower.includes("tavern")
  ) {
    return "food";
  }

  if (
    lower.includes("transport") ||
    lower.includes("transit") ||
    lower.includes("train") ||
    lower.includes("bus") ||
    lower.includes("metro") ||
    lower.includes("taxi") ||
    lower.includes("ferry") ||
    lower.includes("cable car") ||
    lower.includes("funicular") ||
    lower.includes("car rental")
  ) {
    return "transport";
  }

  if (
    lower.includes("hotel") ||
    lower.includes("accommodation") ||
    lower.includes("hostel") ||
    lower.includes("airbnb") ||
    lower.includes("resort") ||
    lower.includes("apartment")
  ) {
    return "accommodation";
  }

  if (
    lower.includes("shopping") ||
    lower.includes("market") ||
    lower.includes("souvenir") ||
    lower.includes("store") ||
    lower.includes("boutique")
  ) {
    return "shopping";
  }

  return "activities";
}

/**
 * Computes date string for a specific trip day.
 */
export function getDateForDay(startDateStr?: string, dayNumber: number = 1): string {
  if (!startDateStr) {
    const today = new Date();
    today.setDate(today.getDate() + (dayNumber - 1));
    return today.toISOString().split("T")[0];
  }
  try {
    const date = new Date(startDateStr);
    date.setDate(date.getDate() + (dayNumber - 1));
    return date.toISOString().split("T")[0];
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

/**
 * Analyzes whether an itinerary activity has already been logged as an expense in Tricount.
 */
export function isActivityLogged(
  activity: ActivitySpot,
  expenses: GroupExpenseItem[],
  dayNumber: number,
  startDate?: string
): boolean {
  const actNameLower = activity.name.toLowerCase().trim();
  const dayDate = getDateForDay(startDate, dayNumber);

  return expenses.some((exp) => {
    const expTitleLower = exp.title.toLowerCase().trim();
    // Direct or substring match
    if (expTitleLower.includes(actNameLower) || actNameLower.includes(expTitleLower)) {
      return true;
    }
    // Same date and very similar keyword
    if (exp.date === dayDate && expTitleLower.split(" ").some((w) => w.length > 4 && actNameLower.includes(w))) {
      return true;
    }
    return false;
  });
}

/**
 * Calculates complete Cost & Expense summary overview comparing planned vs actuals.
 */
export function calculateTripBudgetOverview(
  plan: ItineraryPlan,
  expenses: GroupExpenseItem[]
): TripBudgetOverview {
  const currency = plan.currency || "€";
  const dailyPlans = plan.days || [];
  const totalDays = Math.max(1, plan.totalDays || dailyPlans.length || 1);

  let totalPlannedMin = 0;
  let totalPlannedMax = 0;
  let totalPlannedAvg = 0;

  const categoryTotals: Record<ExpenseCategory, { planned: number; actual: number; label: string; emoji: string }> = {
    food: { planned: 0, actual: 0, label: "Food & Dining", emoji: "🥘" },
    activities: { planned: 0, actual: 0, label: "Activities & Tickets", emoji: "🎟️" },
    transport: { planned: 0, actual: 0, label: "Transport & Transit", emoji: "🚕" },
    accommodation: { planned: 0, actual: 0, label: "Accommodation", emoji: "🏨" },
    shopping: { planned: 0, actual: 0, label: "Shopping & Souvenirs", emoji: "🛍️" },
    general: { planned: 0, actual: 0, label: "General & Misc", emoji: "📦" },
  };

  // Add accommodation estimated costs if present
  if (plan.accommodation) {
    // If budget tier is luxury ~€180/night, mid-range ~€90/night, budget ~€40/night
    const nights = Math.max(1, totalDays - 1);
    let nightlyEst = 90;
    if (plan.budgetTier === "budget") nightlyEst = 40;
    if (plan.budgetTier === "luxury") nightlyEst = 220;
    const totalAccEst = nights * nightlyEst;
    totalPlannedMin += totalAccEst * 0.85;
    totalPlannedMax += totalAccEst * 1.25;
    totalPlannedAvg += totalAccEst;
    categoryTotals.accommodation.planned += totalAccEst;
  }

  const daysComparison: DailyBudgetComparison[] = dailyPlans.map((day, idx) => {
    const dayNumber = day.dayNumber || idx + 1;
    const dayDate = getDateForDay(plan.startDate, dayNumber);
    const dayActivities = day.activities || [];

    let dayPlannedMin = 0;
    let dayPlannedMax = 0;
    let dayPlannedAvg = 0;

    const plannedItems: PlannedCostItem[] = dayActivities.map((act) => {
      const parsed = parseApproxCost(act.approxCost);
      const expCat = mapActivityCategoryToExpenseCategory(act.category);

      dayPlannedMin += parsed.min;
      dayPlannedMax += parsed.max;
      dayPlannedAvg += parsed.avg;

      categoryTotals[expCat].planned += parsed.avg;

      const isLogged = isActivityLogged(act, expenses, dayNumber, plan.startDate);

      return {
        activityId: act.id,
        name: act.name,
        category: expCat,
        approxCostStr: act.approxCost || "Free",
        estimatedMin: parsed.min,
        estimatedMax: parsed.max,
        estimatedAvg: parsed.avg,
        dayNumber,
        isLogged,
      };
    });

    // If day has estimatedTotalBudget string, factor it in if no activities had numeric costs
    if (dayPlannedAvg === 0 && day.estimatedTotalBudget) {
      const parsedDay = parseApproxCost(day.estimatedTotalBudget);
      dayPlannedMin = parsedDay.min;
      dayPlannedMax = parsedDay.max;
      dayPlannedAvg = parsedDay.avg;
      categoryTotals.food.planned += parsedDay.avg * 0.6;
      categoryTotals.activities.planned += parsedDay.avg * 0.4;
    }

    totalPlannedMin += dayPlannedMin;
    totalPlannedMax += dayPlannedMax;
    totalPlannedAvg += dayPlannedAvg;

    // Calculate actual logged expenses matching this day
    const dayExpenses = expenses.filter((exp) => {
      if (exp.date === dayDate) return true;
      // Also match by title note e.g. "Day 1"
      if (exp.title.toLowerCase().includes(`day ${dayNumber}`) || exp.notes?.toLowerCase().includes(`day ${dayNumber}`)) {
        return true;
      }
      return false;
    });

    const dayActualSpent = dayExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return {
      dayNumber,
      dayTitle: day.dayTitle || `Day ${dayNumber}: ${day.theme || "Exploration"}`,
      theme: day.theme,
      dateStr: dayDate,
      plannedMin: Math.round(dayPlannedMin * 100) / 100,
      plannedMax: Math.round(dayPlannedMax * 100) / 100,
      plannedAvg: Math.round(dayPlannedAvg * 100) / 100,
      actualSpent: Math.round(dayActualSpent * 100) / 100,
      activitiesCount: dayActivities.length,
      loggedExpensesCount: dayExpenses.length,
      plannedItems,
    };
  });

  // Calculate actual totals by category
  let totalActualSpent = 0;
  expenses.forEach((exp) => {
    const amt = exp.amount || 0;
    totalActualSpent += amt;
    const cat = exp.category || "general";
    if (categoryTotals[cat]) {
      categoryTotals[cat].actual += amt;
    } else {
      categoryTotals.general.actual += amt;
    }
  });

  // Daily target budget determination
  let dailyTargetBudget = plan.exactBudgetPerDay;
  if (!dailyTargetBudget || dailyTargetBudget <= 0) {
    if (plan.budgetTier === "budget") dailyTargetBudget = 50;
    else if (plan.budgetTier === "luxury") dailyTargetBudget = 250;
    else dailyTargetBudget = 110; // mid-range default
  }

  const dailyPlannedAvg = totalPlannedAvg / totalDays;
  const dailyActualAvg = totalActualSpent / totalDays;

  // Determine budget status
  let budgetStatus: "under" | "on_track" | "over" = "on_track";
  let variancePercentage = 0;

  if (totalPlannedAvg > 0) {
    variancePercentage = Math.round(((totalActualSpent - totalPlannedAvg) / totalPlannedAvg) * 100);
    if (variancePercentage > 15) {
      budgetStatus = "over";
    } else if (variancePercentage < -15 && totalActualSpent > 0) {
      budgetStatus = "under";
    }
  }

  const categories: CategoryBudgetComparison[] = (Object.keys(categoryTotals) as ExpenseCategory[]).map((cat) => {
    const item = categoryTotals[cat];
    const percentageUsed = item.planned > 0 ? Math.min(200, Math.round((item.actual / item.planned) * 100)) : item.actual > 0 ? 100 : 0;
    return {
      category: cat,
      label: item.label,
      emoji: item.emoji,
      plannedAvg: Math.round(item.planned * 100) / 100,
      actualSpent: Math.round(item.actual * 100) / 100,
      percentageUsed,
    };
  });

  return {
    currency,
    totalPlannedMin: Math.round(totalPlannedMin * 100) / 100,
    totalPlannedMax: Math.round(totalPlannedMax * 100) / 100,
    totalPlannedAvg: Math.round(totalPlannedAvg * 100) / 100,
    totalActualSpent: Math.round(totalActualSpent * 100) / 100,
    dailyPlannedAvg: Math.round(dailyPlannedAvg * 100) / 100,
    dailyActualAvg: Math.round(dailyActualAvg * 100) / 100,
    dailyTargetBudget,
    budgetTier: plan.budgetTier || "mid-range",
    budgetStatus,
    variancePercentage,
    days: daysComparison,
    categories,
  };
}

/**
 * 1-Tap quick action: Logs a planned itinerary spot as a shared expense in Tricount.
 */
export function logItinerarySpotAsExpense(
  tripId: string,
  activity: ActivitySpot,
  dayNumber: number,
  payer: string,
  members: string[],
  currency = "€",
  startDate?: string,
  splitMode: SplitMode = "equal"
): GroupExpenseItem {
  const parsed = parseApproxCost(activity.approxCost);
  const amount = parsed.avg > 0 ? parsed.avg : 10; // Fallback sensible default if free or unstated
  const category = mapActivityCategoryToExpenseCategory(activity.category);
  const date = getDateForDay(startDate, dayNumber);

  return addGroupExpense(
    tripId,
    activity.name,
    amount,
    payer,
    members,
    currency,
    {
      category,
      date,
      splitMode,
      notes: `Imported from Itinerary Day ${dayNumber} (${activity.approxCost || "Estimated"})`,
    }
  );
}

/**
 * 1-Tap batch import: Logs all spots in a day (or entire trip) with estimated cost > 0.
 */
export function batchImportPlannedSpots(
  tripId: string,
  spots: Array<{ activity: ActivitySpot; dayNumber: number }>,
  payer: string,
  members: string[],
  currency = "€",
  startDate?: string
): number {
  let count = 0;
  spots.forEach(({ activity, dayNumber }) => {
    const parsed = parseApproxCost(activity.approxCost);
    if (parsed.avg > 0) {
      logItinerarySpotAsExpense(tripId, activity, dayNumber, payer, members, currency, startDate, "equal");
      count++;
    }
  });
  return count;
}
