import {
  ItineraryPlan,
  GroupCollaborationState,
  ActivityVote,
  ActivityComment,
  GroupPackingItem,
  GroupShoppingItem,
  ShoppingCategory,
  GroupExpenseItem,
  BalanceSheet,
  DebtTransfer,
  ExpenseCategory,
  SplitMode,
  GroupMemberProfile,
  GroupAccessSettings,
  MemberRole,
} from "../types";
import { perfCache } from "./performanceCache";
import { notifyLocalDataChanged } from "./storage";

const COLLAB_PREFIX = "localexplorer_collab_";
const CURRENT_USER_KEY = "localexplorer_collab_current_user";

export function getCurrentUserName(): string {
  try {
    return localStorage.getItem(CURRENT_USER_KEY) || "Traveler";
  } catch {
    return "Traveler";
  }
}

export function setCurrentUserName(name: string): void {
  try {
    localStorage.setItem(CURRENT_USER_KEY, name.trim() || "Traveler");
  } catch (err) {
    console.error("Failed to save current user name:", err);
  }
}

export function getInitialPackingList(destination: string, duration: number, vibes: string[] = []): GroupPackingItem[] {
  const destLower = destination.toLowerCase();
  const isCoastal =
    destLower.includes("donostia") ||
    destLower.includes("sebastian") ||
    destLower.includes("barcelona") ||
    destLower.includes("coast") ||
    destLower.includes("beach") ||
    destLower.includes("island") ||
    destLower.includes("mallorca");

  const baseItems: Array<{ category: GroupPackingItem["category"]; item: string }> = [
    // Essentials & Documents
    { category: "documents", item: "Passport / National ID & Copies" },
    { category: "documents", item: "Accommodation Confirmations & Flight / Train Tickets" },
    { category: "documents", item: "Debit / Credit Cards & Emergency Cash" },
    { category: "documents", item: "Health Insurance Cards / Travel Insurance" },

    // Electronics
    { category: "electronics", item: "Phone Chargers & International Power Adapter" },
    { category: "electronics", item: "Portable Power Bank (10,000+ mAh)" },
    { category: "electronics", item: "Earphones / Headphones" },

    // Clothing & Weather
    { category: "clothes", item: "Comfortable Walking Shoes (Broken-in)" },
    { category: "clothes", item: "Light Windbreaker / Rain Jacket" },
    { category: "clothes", item: "Casual Daywear & Evening Dining Outfits" },
    { category: "clothes", item: "Compact Travel Umbrella" },

    // Health & Hygiene
    { category: "health", item: "Personal Prescriptions & Travel First Aid" },
    { category: "health", item: "Sunscreen & Lip Balm" },
    { category: "health", item: "Refillable Water Bottle" },
  ];

  if (isCoastal) {
    baseItems.push({ category: "clothes", item: "Swimwear & Beach Towel" });
    baseItems.push({ category: "clothes", item: "Sunglasses & Sun Hat" });
  }

  if (
    vibes.some(
      (v) =>
        v.toLowerCase().includes("nightlife") ||
        v.toLowerCase().includes("food") ||
        v.toLowerCase().includes("wine")
    )
  ) {
    baseItems.push({ category: "clothes", item: "Smart-Casual Dinner Attire" });
  }

  return baseItems.map((b, i) => ({
    id: `pack-${Date.now()}-${i}`,
    category: b.category,
    item: b.item,
    checkedBy: [],
  }));
}

export function getCollaborationState(
  tripId: string,
  destination = "Destination",
  duration = 3,
  vibes: string[] = []
): GroupCollaborationState {
  try {
    const raw = localStorage.getItem(COLLAB_PREFIX + tripId);
    const currentUser = getCurrentUserName();
    if (raw) {
      const parsed: GroupCollaborationState = JSON.parse(raw);
      if (!parsed.members.includes(currentUser)) {
        parsed.members.push(currentUser);
      }

      // Normalize member profiles
      if (!parsed.memberProfiles || parsed.memberProfiles.length === 0) {
        parsed.memberProfiles = parsed.members.map((m, idx) => ({
          id: `m-${idx}-${m.toLowerCase().replace(/\s+/g, "_")}`,
          name: m,
          role: idx === 0 ? "organizer" : "editor",
          joinedAt: Date.now() - (parsed.members.length - idx) * 3600000,
        }));
      } else {
        // Ensure all string members exist in memberProfiles
        parsed.members.forEach((m) => {
          if (!parsed.memberProfiles?.some((p) => p.name === m)) {
            parsed.memberProfiles?.push({
              id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: m,
              role: "editor",
              joinedAt: Date.now(),
            });
          }
        });
      }

      // Normalize access settings
      if (!parsed.accessSettings) {
        parsed.accessSettings = {
          accessLevel: "open_collab",
          inviteCode: `TRIP-${tripId.slice(0, 4).toUpperCase()}`,
          allowGuestsToLogExpenses: true,
          allowGuestsToVote: true,
        };
      }

      // Normalize packing items to have checkedBy array
      if (parsed.packingList) {
        parsed.packingList = parsed.packingList.map((item) => {
          if (!item.checkedBy) {
            item.checkedBy = item.isChecked ? [currentUser] : [];
          }
          return item;
        });
      }
      // Normalize shopping list
      if (!parsed.shoppingList) {
        parsed.shoppingList = getInitialShoppingList(destination, currentUser);
      }
      // Normalize expenses with new Tricount fields if needed
      if (parsed.expenses) {
        parsed.expenses = parsed.expenses.map((exp) => ({
          ...exp,
          category: exp.category || "general",
          date: exp.date || new Date(exp.createdAt || Date.now()).toISOString().split("T")[0],
          splitMode: exp.splitMode || "equal",
          splitBetween: exp.splitBetween?.length > 0 ? exp.splitBetween : parsed.members,
        }));
      }
      return parsed;
    }
  } catch (err) {
    console.error("Failed to read collab state:", err);
  }

  const currentUser = getCurrentUserName();
  const defaultState: GroupCollaborationState = {
    tripId,
    members: [currentUser],
    currentUser,
    memberProfiles: [
      {
        id: `m-0-${currentUser.toLowerCase().replace(/\s+/g, "_")}`,
        name: currentUser,
        role: "organizer",
        joinedAt: Date.now(),
      },
    ],
    accessSettings: {
      accessLevel: "open_collab",
      inviteCode: `TRIP-${tripId.slice(0, 4).toUpperCase()}`,
      allowGuestsToLogExpenses: true,
      allowGuestsToVote: true,
    },
    votes: {},
    comments: {},
    packingList: getInitialPackingList(destination, duration, vibes),
    shoppingList: getInitialShoppingList(destination, currentUser),
    expenses: [],
    lastUpdated: Date.now(),
  };

  saveCollaborationState(defaultState);
  return defaultState;
}

export function saveCollaborationState(state: GroupCollaborationState): void {
  try {
    state.lastUpdated = Date.now();
    perfCache.set(`collab_${state.tripId}`, state, 1000 * 60 * 60 * 24);
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.setItem(COLLAB_PREFIX + state.tripId, JSON.stringify(state));
    }
    notifyLocalDataChanged();
  } catch (err) {
    console.error("Failed to save collab state:", err);
  }
}

// --- Member & Access Management ---

export function addMemberToGroup(
  tripId: string,
  name: string,
  role: MemberRole = "editor"
): GroupCollaborationState {
  const state = getCollaborationState(tripId);
  const clean = name.trim();
  if (!clean) return state;

  if (!state.members.includes(clean)) {
    state.members.push(clean);
  }

  if (!state.memberProfiles) {
    state.memberProfiles = [];
  }

  const existingProfile = state.memberProfiles.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (!existingProfile) {
    state.memberProfiles.push({
      id: `m-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: clean,
      role,
      joinedAt: Date.now(),
    });
  } else {
    existingProfile.role = role;
  }

  saveCollaborationState(state);
  return state;
}

export function updateMemberInGroup(
  tripId: string,
  oldName: string,
  newName: string,
  role: MemberRole
): GroupCollaborationState {
  const state = getCollaborationState(tripId);
  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();

  if (!cleanNew) return state;

  // Update members array
  state.members = state.members.map((m) => (m === cleanOld ? cleanNew : m));

  // Update member profiles
  if (state.memberProfiles) {
    state.memberProfiles = state.memberProfiles.map((p) =>
      p.name === cleanOld ? { ...p, name: cleanNew, role } : p
    );
  }

  // Update current user if renamed
  if (state.currentUser === cleanOld) {
    state.currentUser = cleanNew;
    setCurrentUserName(cleanNew);
  }

  // Update packing list checkedBy & assignedTo
  state.packingList = state.packingList.map((item) => ({
    ...item,
    assignedTo: item.assignedTo === cleanOld ? cleanNew : item.assignedTo,
    checkedBy: (item.checkedBy || []).map((u) => (u === cleanOld ? cleanNew : u)),
  }));

  // Update expense paidBy & splitBetween
  state.expenses = state.expenses.map((exp) => {
    const updatedSplit = (exp.splitBetween || []).map((u) => (u === cleanOld ? cleanNew : u));
    let updatedAlloc = exp.allocations;
    if (updatedAlloc && cleanOld in updatedAlloc) {
      updatedAlloc = { ...updatedAlloc, [cleanNew]: updatedAlloc[cleanOld] };
      delete updatedAlloc[cleanOld];
    }
    return {
      ...exp,
      paidBy: exp.paidBy === cleanOld ? cleanNew : exp.paidBy,
      splitBetween: updatedSplit,
      allocations: updatedAlloc,
    };
  });

  saveCollaborationState(state);
  return state;
}

export function removeMemberFromGroup(tripId: string, memberName: string): GroupCollaborationState {
  const state = getCollaborationState(tripId);
  const clean = memberName.trim();

  // Keep at least one member
  if (state.members.length <= 1) {
    return state;
  }

  state.members = state.members.filter((m) => m !== clean);
  if (state.memberProfiles) {
    state.memberProfiles = state.memberProfiles.filter((p) => p.name !== clean);
  }

  // If current active user was removed, switch to the first remaining member
  if (state.currentUser === clean) {
    const fallback = state.members[0] || "Traveler";
    state.currentUser = fallback;
    setCurrentUserName(fallback);
  }

  // Clean unassigned packing and expenses
  state.packingList = state.packingList.map((item) => ({
    ...item,
    assignedTo: item.assignedTo === clean ? undefined : item.assignedTo,
    checkedBy: (item.checkedBy || []).filter((u) => u !== clean),
  }));

  state.expenses = state.expenses.map((exp) => ({
    ...exp,
    splitBetween: (exp.splitBetween || []).filter((u) => u !== clean),
  }));

  saveCollaborationState(state);
  return state;
}

export function updateAccessSettings(
  tripId: string,
  settings: Partial<GroupAccessSettings>
): GroupCollaborationState {
  const state = getCollaborationState(tripId);
  state.accessSettings = {
    ...(state.accessSettings || {
      accessLevel: "open_collab",
      inviteCode: `TRIP-${tripId.slice(0, 4).toUpperCase()}`,
      allowGuestsToLogExpenses: true,
      allowGuestsToVote: true,
    }),
    ...settings,
  };
  saveCollaborationState(state);
  return state;
}

export function toggleActivityVote(
  tripId: string,
  activityId: string,
  voteType: "up" | "down" | "heart",
  memberName: string
): GroupCollaborationState {
  const state = getCollaborationState(tripId);
  const currentVote: ActivityVote = state.votes[activityId] || { upvotes: [], downvotes: [], hearts: [] };

  const cleanName = memberName.trim() || getCurrentUserName();
  if (!state.members.includes(cleanName)) {
    state.members.push(cleanName);
  }

  if (voteType === "up") {
    if (currentVote.upvotes.includes(cleanName)) {
      currentVote.upvotes = currentVote.upvotes.filter((m) => m !== cleanName);
    } else {
      currentVote.upvotes.push(cleanName);
      currentVote.downvotes = currentVote.downvotes.filter((m) => m !== cleanName);
    }
  } else if (voteType === "down") {
    if (currentVote.downvotes.includes(cleanName)) {
      currentVote.downvotes = currentVote.downvotes.filter((m) => m !== cleanName);
    } else {
      currentVote.downvotes.push(cleanName);
      currentVote.upvotes = currentVote.upvotes.filter((m) => m !== cleanName);
      currentVote.hearts = currentVote.hearts.filter((m) => m !== cleanName);
    }
  } else if (voteType === "heart") {
    if (currentVote.hearts.includes(cleanName)) {
      currentVote.hearts = currentVote.hearts.filter((m) => m !== cleanName);
    } else {
      currentVote.hearts.push(cleanName);
      currentVote.downvotes = currentVote.downvotes.filter((m) => m !== cleanName);
    }
  }

  state.votes[activityId] = currentVote;
  saveCollaborationState(state);
  return state;
}

export function addActivityComment(
  tripId: string,
  activityId: string,
  text: string,
  author: string
): ActivityComment {
  const state = getCollaborationState(tripId);
  const cleanAuthor = author.trim() || getCurrentUserName();

  if (!state.members.includes(cleanAuthor)) {
    state.members.push(cleanAuthor);
  }

  const newComment: ActivityComment = {
    id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    activityId,
    author: cleanAuthor,
    text: text.trim(),
    timestamp: Date.now(),
  };

  const list = state.comments[activityId] || [];
  state.comments[activityId] = [...list, newComment];
  saveCollaborationState(state);
  return newComment;
}

export function deleteActivityComment(tripId: string, activityId: string, commentId: string): void {
  const state = getCollaborationState(tripId);
  const list = state.comments[activityId] || [];
  state.comments[activityId] = list.filter((c) => c.id !== commentId);
  saveCollaborationState(state);
}

// --- Packing Checklist with Personal Toggle per User ---
export function togglePackingItemForUser(tripId: string, itemId: string, userName: string): void {
  const state = getCollaborationState(tripId);
  const cleanName = userName.trim() || getCurrentUserName();
  if (!state.members.includes(cleanName)) {
    state.members.push(cleanName);
  }

  state.packingList = state.packingList.map((item) => {
    if (item.id === itemId) {
      const currentChecked = item.checkedBy || [];
      const isAlreadyChecked = currentChecked.includes(cleanName);
      const newChecked = isAlreadyChecked
        ? currentChecked.filter((u) => u !== cleanName)
        : [...currentChecked, cleanName];

      return {
        ...item,
        checkedBy: newChecked,
        isChecked: newChecked.includes(cleanName),
      };
    }
    return item;
  });

  saveCollaborationState(state);
}

export function deletePackingItem(tripId: string, itemId: string): void {
  const state = getCollaborationState(tripId);
  state.packingList = state.packingList.filter((item) => item.id !== itemId);
  saveCollaborationState(state);
}

export function assignPackingItem(tripId: string, itemId: string, assignee?: string): void {
  const state = getCollaborationState(tripId);
  state.packingList = state.packingList.map((item) =>
    item.id === itemId ? { ...item, assignedTo: assignee || undefined } : item
  );
  saveCollaborationState(state);
}

export function addPackingItem(
  tripId: string,
  item: string,
  category: GroupPackingItem["category"],
  assignedTo?: string
): GroupPackingItem {
  const state = getCollaborationState(tripId);
  const newItem: GroupPackingItem = {
    id: `pack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    item: item.trim(),
    category,
    assignedTo: assignedTo || undefined,
    checkedBy: [],
  };
  state.packingList.push(newItem);
  saveCollaborationState(state);
  return newItem;
}

import { generateSmartPackingList } from "./packingGenerator";

export function generateSmartGroupPackingList(plan: ItineraryPlan): GroupPackingItem[] {
  const smartItems = generateSmartPackingList(plan);
  return smartItems.map((item) => ({
    id: item.id,
    category: item.category as GroupPackingItem["category"],
    item: item.item,
    reason: item.reason,
    checkedBy: item.isPacked ? [getCurrentUserName()] : [],
  }));
}

export function resetPackingListWithWeatherAI(plan: ItineraryPlan): GroupPackingItem[] {
  const state = getCollaborationState(plan.id);
  const freshItems = generateSmartGroupPackingList(plan);
  state.packingList = freshItems;
  saveCollaborationState(state);
  return freshItems;
}

export function packAllItemsForUser(tripId: string, userName: string): void {
  const state = getCollaborationState(tripId);
  const cleanName = userName.trim() || getCurrentUserName();
  state.packingList = state.packingList.map((item) => {
    const set = new Set(item.checkedBy || []);
    set.add(cleanName);
    return { ...item, checkedBy: Array.from(set), isChecked: true };
  });
  saveCollaborationState(state);
}

export function unpackAllItemsForUser(tripId: string, userName: string): void {
  const state = getCollaborationState(tripId);
  const cleanName = userName.trim() || getCurrentUserName();
  state.packingList = state.packingList.map((item) => {
    const newChecked = (item.checkedBy || []).filter((u) => u !== cleanName);
    return { ...item, checkedBy: newChecked, isChecked: newChecked.length > 0 };
  });
  saveCollaborationState(state);
}

// --- Tricount Style Expenses & Splits ---

export function addGroupExpense(
  tripId: string,
  title: string,
  amount: number,
  paidBy: string,
  splitBetween: string[],
  currency = "€",
  options: {
    category?: ExpenseCategory;
    date?: string;
    splitMode?: SplitMode;
    allocations?: Record<string, number>;
    notes?: string;
  } = {}
): GroupExpenseItem {
  const state = getCollaborationState(tripId);
  const cleanPayer = paidBy.trim() || getCurrentUserName();
  if (!state.members.includes(cleanPayer)) {
    state.members.push(cleanPayer);
  }

  const newExpense: GroupExpenseItem = {
    id: `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    title: title.trim(),
    amount: Math.max(0, amount),
    paidBy: cleanPayer,
    currency,
    category: options.category || "general",
    date: options.date || new Date().toISOString().split("T")[0],
    splitMode: options.splitMode || "equal",
    splitBetween: splitBetween.length > 0 ? splitBetween : state.members,
    allocations: options.allocations,
    notes: options.notes,
    createdAt: Date.now(),
  };

  state.expenses.push(newExpense);
  saveCollaborationState(state);
  return newExpense;
}

export function updateGroupExpense(
  tripId: string,
  updatedExpense: Partial<GroupExpenseItem> & { id: string }
): void {
  const state = getCollaborationState(tripId);
  state.expenses = state.expenses.map((e) =>
    e.id === updatedExpense.id
      ? {
          ...e,
          ...updatedExpense,
          createdAt: e.createdAt || Date.now(),
        }
      : e
  );
  saveCollaborationState(state);
}

export function deleteGroupExpense(tripId: string, expenseId: string): void {
  const state = getCollaborationState(tripId);
  state.expenses = state.expenses.filter((e) => e.id !== expenseId);
  saveCollaborationState(state);
}

/**
 * Calculates Tricount net balances taking into account:
 * - Equal splits
 * - Exact amount splits (€ per member)
 * - Shares/Slices splits (parts per member)
 */
export function calculateBalances(expenses: GroupExpenseItem[], members: string[]): BalanceSheet[] {
  const allMembers = Array.from(
    new Set([...members, ...expenses.map((e) => e.paidBy), ...expenses.flatMap((e) => e.splitBetween || [])])
  ).filter(Boolean);

  const balanceMap: Record<string, { paid: number; owed: number }> = {};
  allMembers.forEach((m) => {
    balanceMap[m] = { paid: 0, owed: 0 };
  });

  expenses.forEach((exp) => {
    const payer = exp.paidBy;
    if (!balanceMap[payer]) {
      balanceMap[payer] = { paid: 0, owed: 0 };
    }
    balanceMap[payer].paid += exp.amount;

    const participants = exp.splitBetween && exp.splitBetween.length > 0 ? exp.splitBetween : allMembers;

    if (exp.splitMode === "exact" && exp.allocations) {
      // Exact amounts per member
      participants.forEach((p) => {
        if (!balanceMap[p]) balanceMap[p] = { paid: 0, owed: 0 };
        const owedAmt = exp.allocations?.[p] || 0;
        balanceMap[p].owed += owedAmt;
      });
    } else if (exp.splitMode === "shares" && exp.allocations) {
      // Slices / Shares per member
      let totalShares = 0;
      participants.forEach((p) => {
        const shares = exp.allocations?.[p] ?? 1;
        totalShares += Math.max(0, shares);
      });
      if (totalShares <= 0) totalShares = participants.length || 1;

      participants.forEach((p) => {
        if (!balanceMap[p]) balanceMap[p] = { paid: 0, owed: 0 };
        const memberShares = exp.allocations?.[p] ?? 1;
        const memberAmount = (memberShares / totalShares) * exp.amount;
        balanceMap[p].owed += memberAmount;
      });
    } else {
      // Equal split
      const share = exp.amount / (participants.length || 1);
      participants.forEach((p) => {
        if (!balanceMap[p]) balanceMap[p] = { paid: 0, owed: 0 };
        balanceMap[p].owed += share;
      });
    }
  });

  return allMembers.map((m) => {
    const paid = balanceMap[m]?.paid || 0;
    const owed = balanceMap[m]?.owed || 0;
    return {
      member: m,
      totalPaid: Math.round(paid * 100) / 100,
      totalOwed: Math.round(owed * 100) / 100,
      netBalance: Math.round((paid - owed) * 100) / 100,
    };
  });
}

/**
 * Generates an optimal debt settlement plan (Who owes whom) minimizing the total number of transactions.
 */
export function calculateDebtSettlements(balances: BalanceSheet[]): DebtTransfer[] {
  // Separate into debtors (negative balance) and creditors (positive balance)
  const debtors: Array<{ member: string; amount: number }> = [];
  const creditors: Array<{ member: string; amount: number }> = [];

  balances.forEach((b) => {
    if (b.netBalance < -0.01) {
      debtors.push({ member: b.member, amount: Math.abs(b.netBalance) });
    } else if (b.netBalance > 0.01) {
      creditors.push({ member: b.member, amount: b.netBalance });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: DebtTransfer[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const settleAmount = Math.min(debtor.amount, creditor.amount);
    if (settleAmount > 0.01) {
      transfers.push({
        from: debtor.member,
        to: creditor.member,
        amount: Math.round(settleAmount * 100) / 100,
      });
    }

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return transfers;
}

// --- Bring!-inspired Shopping List Catalog & Actions ---

export interface BringPresetItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  emoji: string;
}

export const BRING_CATEGORIES: Array<{ id: ShoppingCategory; label: string; icon: string }> = [
  { id: "fresh_produce", label: "Fresh Produce", icon: "🥦" },
  { id: "bakery_snacks", label: "Bakery & Snacks", icon: "🥖" },
  { id: "drinks", label: "Drinks & Beverages", icon: "🥤" },
  { id: "pantry_cooking", label: "Pantry & Cooking", icon: "🫒" },
  { id: "toiletries_meds", label: "Toiletries & Meds", icon: "🧴" },
  { id: "camping_gear", label: "Outdoor & Beach", icon: "⛺" },
  { id: "household_misc", label: "Household & Misc", icon: "⚡" },
];

export const BRING_PRESET_ITEMS: BringPresetItem[] = [
  // fresh_produce
  { id: "p-1", name: "Apples & Bananas", category: "fresh_produce", emoji: "🍎" },
  { id: "p-2", name: "Fresh Berries", category: "fresh_produce", emoji: "🍓" },
  { id: "p-3", name: "Avocados & Tomatoes", category: "fresh_produce", emoji: "🥑" },
  { id: "p-4", name: "Lemons & Limes", category: "fresh_produce", emoji: "🍋" },
  { id: "p-5", name: "Salad Greens", category: "fresh_produce", emoji: "🥗" },

  // bakery_snacks
  { id: "p-6", name: "Fresh Baguette / Bread", category: "bakery_snacks", emoji: "🥖" },
  { id: "p-7", name: "Potato Chips & Dips", category: "bakery_snacks", emoji: "🥔" },
  { id: "p-8", name: "Croissants & Pastries", category: "bakery_snacks", emoji: "🥐" },
  { id: "p-9", name: "Nuts & Dried Fruit", category: "bakery_snacks", emoji: "🥜" },
  { id: "p-10", name: "Crackers & Biscuits", category: "bakery_snacks", emoji: "🥨" },

  // drinks
  { id: "p-11", name: "Mineral Water (Bottles)", category: "drinks", emoji: "💧" },
  { id: "p-12", name: "Specialty Coffee / Beans", category: "drinks", emoji: "☕" },
  { id: "p-13", name: "Fresh Juices & Sodas", category: "drinks", emoji: "🧃" },
  { id: "p-14", name: "Local Wine / Cava", category: "drinks", emoji: "🍷" },
  { id: "p-15", name: "Craft Beer / Cider", category: "drinks", emoji: "🍺" },

  // pantry_cooking
  { id: "p-16", name: "Local Cheese Selection", category: "pantry_cooking", emoji: "🧀" },
  { id: "p-17", name: "Fresh Milk / Oat Milk", category: "pantry_cooking", emoji: "🥛" },
  { id: "p-18", name: "Eggs & Butter", category: "pantry_cooking", emoji: "🍳" },
  { id: "p-19", name: "Olive Oil & Salt", category: "pantry_cooking", emoji: "🫒" },
  { id: "p-20", name: "Pasta & Tomato Sauce", category: "pantry_cooking", emoji: "🍝" },

  // toiletries_meds
  { id: "p-21", name: "Sunscreen & Aftersun", category: "toiletries_meds", emoji: "🧴" },
  { id: "p-22", name: "Mosquito Bug Spray", category: "toiletries_meds", emoji: "🦟" },
  { id: "p-23", name: "First Aid & Painkillers", category: "toiletries_meds", emoji: "🩹" },
  { id: "p-24", name: "Toothpaste & Brush", category: "toiletries_meds", emoji: "🪥" },
  { id: "p-25", name: "Wet Wipes & Tissues", category: "toiletries_meds", emoji: "🧻" },

  // camping_gear
  { id: "p-26", name: "Charcoal & Firestarter", category: "camping_gear", emoji: "🔥" },
  { id: "p-27", name: "Bag of Ice Cubes", category: "camping_gear", emoji: "🧊" },
  { id: "p-28", name: "BBQ Sausages & Meat", category: "camping_gear", emoji: "🥩" },
  { id: "p-29", name: "Beach / Picnic Towel", category: "camping_gear", emoji: "🏖️" },
  { id: "p-30", name: "Portable Cooler Box", category: "camping_gear", emoji: "🧊" },

  // household_misc
  { id: "p-31", name: "Trash Bags", category: "household_misc", emoji: "🗑️" },
  { id: "p-32", name: "Paper Towels & Napkins", category: "household_misc", emoji: "🧻" },
  { id: "p-33", name: "Power Bank & Cables", category: "household_misc", emoji: "⚡" },
  { id: "p-34", name: "Playing Cards / Games", category: "household_misc", emoji: "🃏" },
  { id: "p-35", name: "Aluminum Foil & Zip Bags", category: "household_misc", emoji: "📦" },
];

export function getInitialShoppingList(destination: string, addedBy = "Traveler"): GroupShoppingItem[] {
  const defaults: Array<{ name: string; category: ShoppingCategory; emoji: string; quantity?: string }> = [
    { name: "Mineral Water (Bottles)", category: "drinks", emoji: "💧", quantity: "6x 1.5L" },
    { name: "Specialty Coffee / Beans", category: "drinks", emoji: "☕", quantity: "1 pack" },
    { name: "Fresh Baguette / Bread", category: "bakery_snacks", emoji: "🥖", quantity: "2" },
    { name: "Local Cheese Selection", category: "pantry_cooking", emoji: "🧀", quantity: "Assorted" },
    { name: "Sunscreen & Aftersun", category: "toiletries_meds", emoji: "🧴", quantity: "SPF 50" },
    { name: "Apples & Bananas", category: "fresh_produce", emoji: "🍎", quantity: "1 basket" },
  ];

  return defaults.map((d, i) => ({
    id: `shop-init-${Date.now()}-${i}`,
    name: d.name,
    category: d.category,
    emoji: d.emoji,
    quantity: d.quantity,
    status: "needed",
    addedBy,
    createdAt: Date.now() - i * 1000,
  }));
}

export function addShoppingItem(
  tripId: string,
  name: string,
  category: ShoppingCategory,
  emoji = "🛒",
  quantity?: string,
  assignedTo?: string,
  addedBy?: string
): GroupShoppingItem {
  const state = getCollaborationState(tripId);
  const cleanAddedBy = addedBy || getCurrentUserName();

  const newItem: GroupShoppingItem = {
    id: `shop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: name.trim(),
    category,
    emoji,
    quantity: quantity?.trim() || undefined,
    assignedTo: assignedTo || undefined,
    status: "needed",
    addedBy: cleanAddedBy,
    createdAt: Date.now(),
  };

  if (!state.shoppingList) {
    state.shoppingList = [];
  }

  // Check if item already exists in needed status; if so, update quantity or return existing
  const existingIdx = state.shoppingList.findIndex(
    (item) => item.name.toLowerCase() === name.trim().toLowerCase() && item.status === "needed"
  );

  if (existingIdx !== -1) {
    state.shoppingList[existingIdx] = {
      ...state.shoppingList[existingIdx],
      quantity: quantity?.trim() || state.shoppingList[existingIdx].quantity,
      assignedTo: assignedTo || state.shoppingList[existingIdx].assignedTo,
    };
    saveCollaborationState(state);
    return state.shoppingList[existingIdx];
  }

  state.shoppingList.push(newItem);
  saveCollaborationState(state);
  return newItem;
}

export function toggleShoppingItemStatus(tripId: string, itemId: string, currentUser?: string): void {
  const state = getCollaborationState(tripId);
  const activeUser = currentUser || getCurrentUserName();

  if (state.shoppingList) {
    state.shoppingList = state.shoppingList.map((item) => {
      if (item.id === itemId) {
        const nextStatus = item.status === "needed" ? "bought" : "needed";
        return {
          ...item,
          status: nextStatus,
          // If marking bought, auto-assign to the user who bought it if unassigned
          assignedTo: nextStatus === "bought" && !item.assignedTo ? activeUser : item.assignedTo,
        };
      }
      return item;
    });
    saveCollaborationState(state);
  }
}

export function assignShoppingItem(tripId: string, itemId: string, assignee?: string): void {
  const state = getCollaborationState(tripId);
  if (state.shoppingList) {
    state.shoppingList = state.shoppingList.map((item) =>
      item.id === itemId ? { ...item, assignedTo: assignee || undefined } : item
    );
    saveCollaborationState(state);
  }
}

export function deleteShoppingItem(tripId: string, itemId: string): void {
  const state = getCollaborationState(tripId);
  if (state.shoppingList) {
    state.shoppingList = state.shoppingList.filter((item) => item.id !== itemId);
    saveCollaborationState(state);
  }
}

export function clearBoughtShoppingItems(tripId: string): void {
  const state = getCollaborationState(tripId);
  if (state.shoppingList) {
    state.shoppingList = state.shoppingList.filter((item) => item.status !== "bought");
    saveCollaborationState(state);
  }
}
