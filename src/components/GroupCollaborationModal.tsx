import React, { useState, useEffect } from "react";
import {
  ItineraryPlan,
  GroupCollaborationState,
  GroupPackingItem,
  GroupExpenseItem,
  ExpenseCategory,
  SplitMode,
  MemberRole,
  GroupAccessLevel,
  GroupMemberProfile,
} from "../types";
import {
  X,
  Users,
  CheckSquare,
  DollarSign,
  Heart,
  ThumbsUp,
  ThumbsDown,
  Plus,
  Trash2,
  Share2,
  Sparkles,
  Edit3,
  Calendar,
  Filter,
  CheckCircle2,
  ArrowRight,
  Receipt,
  Search,
  Tag,
  Clock,
  Layers,
  PieChart,
  Shield,
  Key,
  Copy,
  UserPlus,
  Check,
  Crown,
  Settings,
  Lock,
  Globe,
  FileText,
} from "lucide-react";
import {
  getCollaborationState,
  saveCollaborationState,
  getCurrentUserName,
  setCurrentUserName,
  addPackingItem,
  togglePackingItemForUser,
  assignPackingItem,
  deletePackingItem,
  addGroupExpense,
  updateGroupExpense,
  deleteGroupExpense,
  calculateBalances,
  calculateDebtSettlements,
  toggleActivityVote,
  addMemberToGroup,
  updateMemberInGroup,
  removeMemberFromGroup,
  updateAccessSettings,
} from "../utils/collaboration";
import { getAvatarColor } from "../utils/formatters";
import { generateShareableUrl } from "../utils/sharing";
import { useLanguage } from "../context/LanguageContext";

interface GroupCollaborationModalProps {
  plan: ItineraryPlan;
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
  isInline?: boolean;
}

const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  food: "🥘 Food & Dining",
  transport: "🚕 Transport & Taxis",
  accommodation: "🏨 Accommodation",
  activities: "🎟️ Activities & Tickets",
  shopping: "🛍️ Shopping & Souvenirs",
  general: "📦 General & Misc",
};

export const GroupCollaborationModal: React.FC<GroupCollaborationModalProps> = ({
  plan,
  isOpen,
  onClose,
  onShowToast,
  isInline = false,
}) => {
  const { t, formatCurrency } = useLanguage();
  const [collabState, setCollabState] = useState<GroupCollaborationState>(() =>
    getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags)
  );
  const [activeTab, setActiveTab] = useState<"votes" | "packing" | "expenses" | "members">("votes");
  const [currentName, setCurrentName] = useState(getCurrentUserName());
  const [isEditingName, setIsEditingName] = useState(false);

  // New member adder state
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<MemberRole>("editor");

  // Member editing state inside Members tab
  const [editingMemberOriginalName, setEditingMemberOriginalName] = useState<string | null>(null);
  const [editMemberNameInput, setEditMemberNameInput] = useState("");
  const [editMemberRoleInput, setEditMemberRoleInput] = useState<MemberRole>("editor");

  // --- Packing List State ---
  const [newPackItem, setNewPackItem] = useState("");
  const [newPackCategory, setNewPackCategory] = useState<GroupPackingItem["category"]>("essentials");
  const [newPackAssignee, setNewPackAssignee] = useState("");
  const [packCategoryFilter, setPackCategoryFilter] = useState<string>("all");

  // --- Tricount Expenses State ---
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);

  // Expense Form fields
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<ExpenseCategory>("food");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expPaidBy, setExpPaidBy] = useState(getCurrentUserName());
  const [expSplitMode, setExpSplitMode] = useState<SplitMode>("equal");
  const [expSplitBetween, setExpSplitBetween] = useState<string[]>([]);
  const [expAllocations, setExpAllocations] = useState<Record<string, number>>({});

  // Expense Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaidBy, setFilterPaidBy] = useState<string>("all");
  const [filterSearch, setFilterSearch] = useState("");

  useEffect(() => {
    if (isOpen || isInline) {
      const state = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
      setCollabState(state);
      const name = getCurrentUserName();
      setCurrentName(name);
      setExpPaidBy(name);
      setExpSplitBetween(state.members);
    }
  }, [isOpen, isInline, plan.id, plan.destinationOrTown, plan.totalDays, plan.tags]);

  if (!isOpen && !isInline) return null;

  // --- Member management ---
  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentName.trim()) return;
    const clean = currentName.trim();
    setCurrentUserName(clean);
    const updated = addMemberToGroup(plan.id, clean, "editor");
    setCollabState({ ...updated, currentUser: clean });
    setIsEditingName(false);
    onShowToast?.(`Active profile switched to "${clean}"`, "success");
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const clean = newMemberName.trim();
    if (collabState.members.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      onShowToast?.(`Traveler "${clean}" is already in the group`, "info");
      return;
    }
    const updated = addMemberToGroup(plan.id, clean, newMemberRole);
    setCollabState(updated);
    setNewMemberName("");
    onShowToast?.(`Added "${clean}" (${newMemberRole}) to group roster`, "success");
  };

  const handleStartEditMember = (member: GroupMemberProfile) => {
    setEditingMemberOriginalName(member.name);
    setEditMemberNameInput(member.name);
    setEditMemberRoleInput(member.role);
  };

  const handleSaveEditMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberOriginalName || !editMemberNameInput.trim()) return;
    const updated = updateMemberInGroup(
      plan.id,
      editingMemberOriginalName,
      editMemberNameInput.trim(),
      editMemberRoleInput
    );
    setCollabState(updated);
    if (editingMemberOriginalName === currentName) {
      setCurrentName(editMemberNameInput.trim());
    }
    setEditingMemberOriginalName(null);
    onShowToast?.(`Updated member details for "${editMemberNameInput.trim()}"`, "success");
  };

  const handleRemoveMember = (memberName: string) => {
    if (collabState.members.length <= 1) {
      onShowToast?.("The trip group must contain at least one member.", "error");
      return;
    }
    if (window.confirm(`Are you sure you want to remove ${memberName} from the group?`)) {
      const updated = removeMemberFromGroup(plan.id, memberName);
      setCollabState(updated);
      setCurrentName(updated.currentUser);
      onShowToast?.(`Removed "${memberName}" from the group.`, "info");
    }
  };

  const handleSwitchActiveProfile = (memberName: string) => {
    setCurrentUserName(memberName);
    setCurrentName(memberName);
    setCollabState((prev) => ({ ...prev, currentUser: memberName }));
    onShowToast?.(`Switched active perspective to ${memberName}`, "success");
  };

  const handleUpdateAccessLevel = (level: GroupAccessLevel) => {
    const updated = updateAccessSettings(plan.id, { accessLevel: level });
    setCollabState(updated);
    onShowToast?.(`Access permission mode set to: ${level.replace("_", " ")}`, "success");
  };

  const handleCopyShareLink = () => {
    const url = generateShareableUrl(plan);
    navigator.clipboard.writeText(url);
    onShowToast?.("Group Collab Invite link copied to clipboard!", "success");
  };

  const handleCopyInviteCode = () => {
    const code = collabState.accessSettings?.inviteCode || `TRIP-${plan.id.slice(0, 4).toUpperCase()}`;
    navigator.clipboard.writeText(code);
    onShowToast?.(`Invite code "${code}" copied to clipboard!`, "success");
  };

  const handleExportCollabSummary = () => {
    const balances = calculateBalances(collabState.expenses, collabState.members);
    const settlements = calculateDebtSettlements(balances);
    const totalSpent = collabState.expenses.reduce((acc, e) => acc + e.amount, 0);

    const summaryText = [
      `🌟 Trip Group Collab Summary: ${plan.destinationOrTown} (${plan.totalDays} Days)`,
      `👥 Members (${collabState.members.length}): ${collabState.members.join(", ")}`,
      `🔒 Access Mode: ${collabState.accessSettings?.accessLevel || "open_collab"} (Code: ${collabState.accessSettings?.inviteCode || "N/A"})`,
      "",
      `🎒 Packing Readiness: ${userPackedCount}/${totalPackingCount} items packed by ${currentName}`,
      "",
      `💰 Shared Expenses (Tricount): Total Spent = ${plan.currency || "€"}${totalSpent.toFixed(2)}`,
      "--- Balances ---",
      ...balances.map(
        (b) =>
          `• ${b.member}: Paid ${plan.currency || "€"}${b.totalPaid.toFixed(2)} | Net ${b.netBalance >= 0 ? "+" : ""}${plan.currency || "€"}${b.netBalance.toFixed(2)}`
      ),
      "",
      "--- Who Owes Whom (Minimal Transfers) ---",
      settlements.length === 0
        ? "All group balances are completely settled!"
        : settlements.map(
            (s) => `• ${s.from} pays ${s.to} ➔ ${plan.currency || "€"}${s.amount.toFixed(2)}`
          ).join("\n"),
    ].join("\n");

    navigator.clipboard.writeText(summaryText);
    onShowToast?.("Full Group Collab summary copied to clipboard!", "success");
  };

  // --- Activity Votes Action ---
  const handleVoteInModal = (activityId: string, type: "up" | "down" | "heart") => {
    const updated = toggleActivityVote(plan.id, activityId, type, currentName);
    setCollabState(updated);
  };

  // --- Packing List Actions ---
  const handleAddPacking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackItem.trim()) return;
    addPackingItem(plan.id, newPackItem, newPackCategory, newPackAssignee || undefined);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    setNewPackItem("");
    setNewPackAssignee("");
    onShowToast?.("Item added to group packing list", "success");
  };

  const handleTogglePersonalPack = (itemId: string) => {
    togglePackingItemForUser(plan.id, itemId, currentName);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
  };

  const handleAssignPack = (itemId: string, assignee: string) => {
    assignPackingItem(plan.id, itemId, assignee);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
  };

  const handleDeletePack = (itemId: string) => {
    deletePackingItem(plan.id, itemId);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
  };

  // Personal vs Group packing stats
  const totalPackingCount = collabState.packingList.length;
  const userPackedCount = collabState.packingList.filter(
    (p) => p.checkedBy && p.checkedBy.includes(currentName)
  ).length;
  const userPackingProgress = Math.round((userPackedCount / (totalPackingCount || 1)) * 100);

  const filteredPackingItems = collabState.packingList.filter((item) => {
    if (packCategoryFilter === "all") return true;
    return item.category === packCategoryFilter;
  });

  // --- Tricount Expenses Actions ---
  const openNewExpenseForm = () => {
    setEditingExpenseId(null);
    setExpTitle("");
    setExpAmount("");
    setExpCategory("food");
    setExpDate(new Date().toISOString().split("T")[0]);
    setExpPaidBy(currentName);
    setExpSplitMode("equal");
    setExpSplitBetween(collabState.members);
    setExpAllocations({});
    setIsExpenseFormOpen(true);
  };

  const openEditExpenseForm = (exp: GroupExpenseItem) => {
    setEditingExpenseId(exp.id);
    setExpTitle(exp.title);
    setExpAmount(exp.amount.toString());
    setExpCategory(exp.category);
    setExpDate(exp.date);
    setExpPaidBy(exp.paidBy);
    setExpSplitMode(exp.splitMode);
    setExpSplitBetween(exp.splitBetween);
    setExpAllocations(exp.allocations || {});
    setIsExpenseFormOpen(true);
  };

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expAmount);
    if (!expTitle.trim() || isNaN(amountNum) || amountNum <= 0) {
      onShowToast?.("Please enter a valid expense title and amount", "error");
      return;
    }

    if (expSplitBetween.length === 0) {
      onShowToast?.("Please select at least one member to split the expense with", "error");
      return;
    }

    if (editingExpenseId) {
      updateGroupExpense(plan.id, {
        id: editingExpenseId,
        title: expTitle.trim(),
        amount: amountNum,
        currency: plan.currency || "€",
        paidBy: expPaidBy,
        category: expCategory,
        date: expDate,
        splitMode: expSplitMode,
        splitBetween: expSplitBetween,
        allocations: expAllocations,
      });
      onShowToast?.(`Expense "${expTitle}" updated`, "success");
    } else {
      addGroupExpense(
        plan.id,
        expTitle.trim(),
        amountNum,
        expPaidBy,
        expSplitBetween,
        plan.currency || "€",
        {
          category: expCategory,
          date: expDate,
          splitMode: expSplitMode,
          allocations: expAllocations,
        }
      );
      onShowToast?.(`Expense "${expTitle}" logged`, "success");
    }

    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    setIsExpenseFormOpen(false);
    setEditingExpenseId(null);
  };

  const handleDeleteExpense = (id: string) => {
    deleteGroupExpense(plan.id, id);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    onShowToast?.("Expense deleted", "info");
  };

  const balances = calculateBalances(collabState.expenses, collabState.members);
  const settlements = calculateDebtSettlements(balances);
  const totalGroupSpend = collabState.expenses.reduce((sum, e) => sum + e.amount, 0);

  const filteredExpenses = collabState.expenses.filter((exp) => {
    if (filterCategory !== "all" && exp.category !== filterCategory) return false;
    if (filterPaidBy !== "all" && exp.paidBy !== filterPaidBy) return false;
    if (
      filterSearch &&
      !exp.title.toLowerCase().includes(filterSearch.toLowerCase()) &&
      !exp.paidBy.toLowerCase().includes(filterSearch.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const content = (
    <div
      className={`bg-white rounded-3xl w-full flex flex-col ${
        isInline ? "" : "max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl border border-[#e5e5df]"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Header */}
      <div className="p-5 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30] rounded-t-3xl">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shrink-0 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="font-serif text-lg sm:text-xl font-bold italic text-white truncate">
                {t("collab.title", "Group Travel Hub & Collaboration")}
              </h3>
              <span className="text-[10px] font-sans font-semibold uppercase px-2.5 py-0.5 rounded-full bg-[#ecece4] text-[#2c2c24] shrink-0">
                {collabState.members.length} {t("collab.activeUser", "Travelers")}
              </span>
            </div>
            <p className="text-xs text-[#d1d1ca] font-sans truncate">
              {t("collab.subtitle", "Manage group access, day-by-day activity voting, luggage packing & Tricount expense splits")}
            </p>
          </div>
        </div>

        {!isInline && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#a8a89f] hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        {/* Member Profile Quick-Bar & Share Link */}
        <div className="bg-[#f5f5f0] px-5 py-3 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Active User Switcher */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[#8a8a7e]">{t("collab.activeUser", "Active User")}:</span>
              {!isEditingName ? (
                <div className="flex items-center space-x-1.5">
                  <span className="font-semibold text-[#2c2c24] bg-white px-2.5 py-1 rounded-xl border border-[#d1d1ca] shadow-2xs flex items-center space-x-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${getAvatarColor(currentName)}`}></span>
                    <span>{currentName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="text-[11px] text-[#5A5A40] hover:underline font-serif italic"
                  >
                    {t("collab.rename", "Rename")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveName} className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-xl bg-white font-sans w-32 focus:outline-none focus:border-[#5A5A40]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1 bg-[#5A5A40] text-white rounded-xl text-[11px] font-serif italic hover:bg-[#4a4a35]"
                  >
                    {t("action.save", "Save")}
                  </button>
                </form>
              )}
            </div>

            {/* Quick Add Friend to Group */}
            <form onSubmit={handleAddMember} className="flex items-center space-x-1.5">
              <input
                type="text"
                placeholder={t("collab.addMember", "+ Add traveler...")}
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-xl bg-white w-28 focus:outline-none focus:border-[#5A5A40]"
              />
              <button
                type="submit"
                disabled={!newMemberName.trim()}
                className="px-2 py-1 bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] rounded-xl text-[11px] font-serif italic disabled:opacity-40"
              >
                {t("action.save", "Add")}
              </button>
            </form>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] font-serif italic text-xs transition-colors shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span>{t("action.copyLink", "Copy Invite Link")}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 pt-3 border-b border-[#e5e5df] space-x-4 text-xs font-serif italic overflow-x-auto">
          <button
            onClick={() => setActiveTab("votes")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 ${
              activeTab === "votes"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            🗳️ {t("collab.tab.votes", "Activity Votes by Day")} ({plan.totalDays} {t("action.days", "Days")})
          </button>
          <button
            onClick={() => setActiveTab("packing")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 ${
              activeTab === "packing"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            🎒 {t("collab.tab.packing", "Luggage & Packing")} ({userPackedCount}/{totalPackingCount})
          </button>
          <button
            onClick={() => setActiveTab("expenses")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 ${
              activeTab === "expenses"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            💰 {t("collab.tab.expenses", "Tricount Shared Expenses")} ({collabState.expenses.length})
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`pb-2.5 border-b-2 font-medium transition-all shrink-0 flex items-center space-x-1.5 ${
              activeTab === "members"
                ? "border-[#5A5A40] text-[#5A5A40] font-bold"
                : "border-transparent text-[#8a8a7e] hover:text-[#2c2c24]"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>👥 {t("collab.tab.members", "Members & Access")} ({collabState.members.length})</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: DAY-BY-DAY ACTIVITY VOTES */}
          {activeTab === "votes" && (
            <div className="space-y-6">
              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] flex items-center justify-between">
                <div>
                  <h4 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                    Itinerary Spot Consensus & Group Feedback
                  </h4>
                  <p className="text-xs text-[#6b6b5e]">
                    Vote on spots per day in chronological sequence so the group can lock in consensus.
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span>Must-Do</span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span>Sounds Good</span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <ThumbsDown className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pass</span>
                  </span>
                </div>
              </div>

              {/* Group by Day in Chronological Order */}
              <div className="space-y-6">
                {plan.days.map((day) => (
                  <div
                    key={day.dayNumber}
                    className="border border-[#e5e5df] rounded-2xl overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Day Header Banner */}
                    <div className="bg-[#2c2c24] px-4 py-2.5 text-white flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-serif font-bold italic text-sm">
                          Day {day.dayNumber}: {day.theme || day.dayTitle}
                        </span>
                        <span className="text-[11px] text-[#d1d1ca] font-sans">
                          • {day.activities.length} spots
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#d1d1ca]">
                        {day.estimatedTotalBudget || ""}
                      </span>
                    </div>

                    {/* Activities List for this Day */}
                    <div className="divide-y divide-[#e5e5df]">
                      {day.activities.map((act, actIdx) => {
                        const vote = collabState.votes[act.id] || {
                          up: [],
                          down: [],
                          hearts: [],
                        };
                        const hasHearted = vote.hearts?.includes(currentName);
                        const hasLiked = vote.up?.includes(currentName);
                        const hasDisliked = vote.down?.includes(currentName);

                        return (
                          <div
                            key={act.id || actIdx}
                            className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#fafaf7] transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-[11px] font-mono text-[#8a8a7e] bg-[#f5f5f0] px-1.5 py-0.5 rounded">
                                  {act.time}
                                </span>
                                <h5 className="font-serif font-bold italic text-sm text-[#2c2c24] truncate">
                                  {act.name}
                                </h5>
                                <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] capitalize">
                                  {act.category}
                                </span>
                              </div>
                              <p className="text-xs text-[#6b6b5e] line-clamp-1 mt-1 font-sans">
                                {act.description}
                              </p>

                              {/* Voter Pill List */}
                              {(vote.hearts?.length > 0 ||
                                vote.up?.length > 0 ||
                                vote.down?.length > 0) && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2 text-[10px]">
                                  {vote.hearts?.map((u) => (
                                    <span
                                      key={u}
                                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200"
                                    >
                                      <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                                      <span>{u}</span>
                                    </span>
                                  ))}
                                  {vote.up?.map((u) => (
                                    <span
                                      key={u}
                                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    >
                                      <ThumbsUp className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                                      <span>{u}</span>
                                    </span>
                                  ))}
                                  {vote.down?.map((u) => (
                                    <span
                                      key={u}
                                      className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200"
                                    >
                                      <ThumbsDown className="w-2.5 h-2.5 text-amber-700" />
                                      <span>{u}</span>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Voting Buttons */}
                            <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => handleVoteInModal(act.id, "heart")}
                                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-serif italic border transition-all ${
                                  hasHearted
                                    ? "bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-2xs"
                                    : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-rose-300 hover:text-rose-600"
                                }`}
                                title="Love it / Must-do"
                              >
                                <Heart
                                  className={`w-3.5 h-3.5 ${
                                    hasHearted ? "fill-rose-500 text-rose-500" : ""
                                  }`}
                                />
                                <span>{vote.hearts?.length || 0}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVoteInModal(act.id, "up")}
                                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-serif italic border transition-all ${
                                  hasLiked
                                    ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs"
                                    : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-emerald-300 hover:text-emerald-600"
                                }`}
                                title="Sounds good"
                              >
                                <ThumbsUp
                                  className={`w-3.5 h-3.5 ${
                                    hasLiked ? "fill-emerald-600 text-emerald-600" : ""
                                  }`}
                                />
                                <span>{vote.up?.length || 0}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleVoteInModal(act.id, "down")}
                                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl text-xs font-serif italic border transition-all ${
                                  hasDisliked
                                    ? "bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-2xs"
                                    : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-amber-300 hover:text-amber-700"
                                }`}
                                title="Pass / Swap"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                                <span>{vote.down?.length || 0}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PACKING LIST */}
          {activeTab === "packing" && (
            <div className="space-y-5">
              {/* Personal Readiness Banner */}
              <div className="bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-serif italic font-bold text-sm text-[#2c2c24] flex items-center space-x-2">
                    <span>🎒 {currentName}'s Luggage Readiness</span>
                    <span className="text-xs font-mono font-normal text-[#5A5A40]">
                      ({userPackedCount} of {totalPackingCount} items packed)
                    </span>
                  </h4>
                  <p className="text-xs text-[#6b6b5e]">
                    Check off items for your own luggage while viewing group baggage assignments.
                  </p>
                </div>

                <div className="w-full sm:w-48 bg-[#ecece4] rounded-full h-3 overflow-hidden border border-[#d1d1ca]">
                  <div
                    className="bg-[#5A5A40] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${userPackingProgress}%` }}
                  />
                </div>
              </div>

              {/* Add Custom Item & Category Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <form
                  onSubmit={handleAddPacking}
                  className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Add custom packing item..."
                    value={newPackItem}
                    onChange={(e) => setNewPackItem(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:border-[#5A5A40]"
                  />
                  <select
                    value={newPackCategory}
                    onChange={(e) =>
                      setNewPackCategory(e.target.value as GroupPackingItem["category"])
                    }
                    className="px-2.5 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                  >
                    <option value="essentials">Essentials</option>
                    <option value="clothes">Clothing</option>
                    <option value="electronics">Electronics</option>
                    <option value="documents">Documents</option>
                    <option value="health">Health & Care</option>
                    <option value="custom">Custom</option>
                  </select>
                  <select
                    value={newPackAssignee}
                    onChange={(e) => setNewPackAssignee(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                  >
                    <option value="">Assign to (Optional)</option>
                    {collabState.members.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] shrink-0"
                  >
                    + Add
                  </button>
                </form>
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "all", label: "All Items" },
                  { id: "documents", label: "📄 Documents" },
                  { id: "clothes", label: "👕 Clothing" },
                  { id: "electronics", label: "🔌 Electronics" },
                  { id: "health", label: "🩹 Health" },
                  { id: "custom", label: "✨ Custom" },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPackCategoryFilter(cat.id)}
                    className={`px-3 py-1 rounded-xl text-xs font-serif italic transition-all shrink-0 ${
                      packCategoryFilter === cat.id
                        ? "bg-[#5A5A40] text-white font-semibold shadow-xs"
                        : "bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="border border-[#e5e5df] rounded-2xl divide-y divide-[#e5e5df] bg-white overflow-hidden shadow-2xs">
                {filteredPackingItems.map((item) => {
                  const isCheckedForUser =
                    item.checkedBy && item.checkedBy.includes(currentName);
                  const packedByCount = item.checkedBy?.length || 0;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                        isCheckedForUser ? "bg-emerald-50/30" : "hover:bg-[#fafaf7]"
                      }`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={isCheckedForUser}
                          onChange={() => handleTogglePersonalPack(item.id)}
                          className="rounded text-[#5A5A40] focus:ring-0 w-4 h-4 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={`font-medium text-[#2c2c24] ${
                              isCheckedForUser ? "line-through text-[#8a8a7e]" : ""
                            }`}
                          >
                            {item.item}
                          </span>
                          <div className="flex items-center space-x-2 text-[10px] text-[#8a8a7e] mt-0.5">
                            <span className="capitalize">{item.category}</span>
                            {item.assignedTo && (
                              <span className="text-[#5A5A40] font-semibold bg-[#ecece4] px-1.5 py-0.2 rounded">
                                Assigned: {item.assignedTo}
                              </span>
                            )}
                            {packedByCount > 0 && (
                              <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                Packed by {item.checkedBy?.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        <select
                          value={item.assignedTo || ""}
                          onChange={(e) => handleAssignPack(item.id, e.target.value)}
                          className="text-[11px] border border-[#d1d1ca] rounded-lg px-2 py-1 bg-white text-[#2c2c24]"
                        >
                          <option value="">No Assignee</option>
                          {collabState.members.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleDeletePack(item.id)}
                          className="p-1.5 text-[#8a8a7e] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: TRICOUNT EXPENSES */}
          {activeTab === "expenses" && (
            <div className="space-y-6">
              {/* Overview & Minimal Debt Settlement Box */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Total Spend */}
                <div className="p-4 rounded-2xl bg-[#f5f5f0] border border-[#e5e5df] space-y-1">
                  <span className="text-xs text-[#8a8a7e] font-serif italic">Total Group Spend</span>
                  <div className="text-2xl font-serif font-bold italic text-[#2c2c24]">
                    {plan.currency || "€"}{totalGroupSpend.toFixed(2)}
                  </div>
                  <span className="text-[11px] text-[#6b6b5e]">
                    Across {collabState.expenses.length} logged expense item{collabState.expenses.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Tricount Balance per Member */}
                <div className="md:col-span-2 p-4 rounded-2xl bg-white border border-[#e5e5df] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-serif italic font-bold text-[#2c2c24]">
                      ⚖️ Tricount Member Net Balances:
                    </span>
                    <span className="text-[11px] text-[#8a8a7e]">
                      Positive = Gets Refund, Negative = Owes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {balances.map((b) => (
                      <div
                        key={b.member}
                        className="p-2 rounded-xl bg-[#f5f5f0] border border-[#e5e5df] flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className={`w-2 h-2 rounded-full ${getAvatarColor(b.member)}`}></span>
                          <span className="font-medium text-[#2c2c24] truncate">{b.member}</span>
                        </div>
                        <span
                          className={`font-serif italic font-bold px-2 py-0.5 rounded-lg border ${
                            b.netBalance >= 0.01
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : b.netBalance <= -0.01
                              ? "bg-amber-50 text-amber-900 border-amber-200"
                              : "bg-[#ecece4] text-[#6b6b5e] border-[#d1d1ca]"
                          }`}
                        >
                          {b.netBalance >= 0 ? "+" : ""}
                          {plan.currency || "€"}{b.netBalance.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Debt Transfer Plan */}
              {settlements.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl space-y-2">
                  <h5 className="font-serif italic font-bold text-xs text-amber-950 flex items-center space-x-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>Optimal Settlement Transfer Plan (Who Pays Whom):</span>
                  </h5>
                  <div className="space-y-1.5">
                    {settlements.map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs bg-white p-2.5 rounded-xl border border-amber-200/80"
                      >
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-[#2c2c24]">{s.from}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                          <span className="font-bold text-[#2c2c24]">{s.to}</span>
                        </div>
                        <span className="font-serif italic font-bold text-sm text-emerald-800">
                          {plan.currency || "€"}{s.amount.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense Action Toolbar & Search */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2 flex-1 max-w-sm">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-[#8a8a7e] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search expenses..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                  >
                    <option value="all">All Categories</option>
                    <option value="food">🥘 Food</option>
                    <option value="transport">🚕 Transport</option>
                    <option value="accommodation">🏨 Lodging</option>
                    <option value="activities">🎟️ Activities</option>
                    <option value="shopping">🛍️ Shopping</option>
                    <option value="general">📦 General</option>
                  </select>

                  <button
                    type="button"
                    onClick={openNewExpenseForm}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Add New Expense</span>
                  </button>
                </div>
              </div>

              {/* Add / Edit Expense Drawer Form */}
              {isExpenseFormOpen && (
                <form
                  onSubmit={handleSaveExpense}
                  className="bg-[#f5f5f0] border border-[#d1d1ca] p-4 sm:p-5 rounded-2xl space-y-4 animate-in fade-in-10"
                >
                  <div className="flex items-center justify-between border-b border-[#e5e5df] pb-2">
                    <h5 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                      {editingExpenseId ? "Edit Expense Entry" : "Log New Shared Group Expense"}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setIsExpenseFormOpen(false)}
                      className="text-[#8a8a7e] hover:text-[#2c2c24]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[#6b6b5e] mb-1 font-serif italic">
                        Expense Description / Vendor:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bar Nestor Pintxos, Taxi to Airport..."
                        value={expTitle}
                        onChange={(e) => setExpTitle(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#6b6b5e] mb-1 font-serif italic">
                        Total Amount ({plan.currency || "€"}):
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={expAmount}
                        onChange={(e) => setExpAmount(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] font-mono focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>

                    <div>
                      <label className="block text-[#6b6b5e] mb-1 font-serif italic">Category:</label>
                      <select
                        value={expCategory}
                        onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                        className="w-full px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                      >
                        <option value="food">🥘 Food & Dining</option>
                        <option value="transport">🚕 Transport & Taxis</option>
                        <option value="accommodation">🏨 Accommodation</option>
                        <option value="activities">🎟️ Activities & Tickets</option>
                        <option value="shopping">🛍️ Shopping & Souvenirs</option>
                        <option value="general">📦 General & Misc</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[#6b6b5e] mb-1 font-serif italic">Paid By:</label>
                      <select
                        value={expPaidBy}
                        onChange={(e) => setExpPaidBy(e.target.value)}
                        className="w-full px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                      >
                        {collabState.members.map((m) => (
                          <option key={m} value={m}>
                            {m} {m === currentName ? "(You)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Splitting Mode Selector */}
                  <div className="space-y-2 border-t border-[#e5e5df] pt-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-serif italic font-bold text-[#2c2c24]">
                        How should this be split?
                      </span>
                      <div className="flex items-center space-x-1">
                        {[
                          { mode: "equal", label: "Equally (=)" },
                          { mode: "exact", label: "Exact Amounts (€)" },
                          { mode: "shares", label: "Slices / Shares (⚖️)" },
                        ].map((m) => (
                          <button
                            key={m.mode}
                            type="button"
                            onClick={() => setExpSplitMode(m.mode as SplitMode)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-serif italic border transition-all ${
                              expSplitMode === m.mode
                                ? "bg-[#5A5A40] text-white font-bold border-[#5A5A40]"
                                : "bg-white text-[#6b6b5e] border-[#d1d1ca] hover:bg-[#ecece4]"
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Member checklist / allocations */}
                    <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] divide-y divide-[#e5e5df]">
                      {collabState.members.map((member) => {
                        const isIncluded = expSplitBetween.includes(member);

                        return (
                          <div
                            key={member}
                            className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
                          >
                            <label className="flex items-center space-x-2 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={isIncluded}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setExpSplitBetween([...expSplitBetween, member]);
                                  } else {
                                    setExpSplitBetween(expSplitBetween.filter((m) => m !== member));
                                  }
                                }}
                                className="rounded text-[#5A5A40] focus:ring-0 w-3.5 h-3.5"
                              />
                              <span className="font-medium text-[#2c2c24] truncate">{member}</span>
                            </label>

                            {/* Exact amount input */}
                            {expSplitMode === "exact" && isIncluded && (
                              <div className="flex items-center space-x-1">
                                <span className="text-[#8a8a7e]">{plan.currency || "€"}</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={expAllocations[member] || ""}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setExpAllocations({ ...expAllocations, [member]: val });
                                  }}
                                  className="w-20 px-2 py-0.5 border border-[#d1d1ca] rounded-lg font-mono text-xs text-right"
                                />
                              </div>
                            )}

                            {/* Shares input */}
                            {expSplitMode === "shares" && isIncluded && (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0.5"
                                  placeholder="1"
                                  value={expAllocations[member] ?? 1}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 1;
                                    setExpAllocations({ ...expAllocations, [member]: val });
                                  }}
                                  className="w-16 px-2 py-0.5 border border-[#d1d1ca] rounded-lg font-mono text-xs text-right"
                                />
                                <span className="text-[#8a8a7e] text-[11px]">shares</span>
                              </div>
                            )}

                            {/* Equal mode preview */}
                            {expSplitMode === "equal" && isIncluded && (
                              <span className="text-[11px] font-mono text-[#5A5A40]">
                                {plan.currency || "€"}
                                {(
                                  (parseFloat(expAmount) || 0) / (expSplitBetween.length || 1)
                                ).toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form Submit & Cancel */}
                  <div className="flex items-center justify-end space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsExpenseFormOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl text-[#6b6b5e] hover:bg-[#ecece4] font-serif italic"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#5A5A40] text-white rounded-xl font-serif italic hover:bg-[#4a4a35] transition-colors shadow-xs"
                    >
                      {editingExpenseId ? "Save Changes" : "Save Expense"}
                    </button>
                  </div>
                </form>
              )}

              {/* Expenses List */}
              <div className="space-y-2">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-8 bg-[#f5f5f0]/60 rounded-2xl border border-dashed border-[#d1d1ca] text-xs text-[#8a8a7e]">
                    No expenses found matching the current filters. Click "+ Add New Expense" to log one!
                  </div>
                ) : (
                  filteredExpenses.map((exp) => (
                    <div
                      key={exp.id}
                      className="p-3.5 rounded-2xl bg-white border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs hover:border-[#5A5A40] transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-semibold text-[#2c2c24] text-sm">{exp.title}</span>
                          <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                            {CATEGORY_ICONS[exp.category] || "📦 General"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-[#8a8a7e] mt-0.5">
                          <span>📅 {exp.date}</span>
                          <span>•</span>
                          <span>
                            Paid by <strong>{exp.paidBy}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Split: {exp.splitMode === "equal" ? "Equally" : exp.splitMode === "exact" ? "Exact amounts" : "Slices"} ({exp.splitBetween.length} members)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="font-serif italic font-bold text-base text-[#2c2c24]">
                          {exp.currency}{exp.amount.toFixed(2)}
                        </span>

                        <button
                          type="button"
                          onClick={() => openEditExpenseForm(exp)}
                          title="Edit Expense"
                          className="p-1.5 text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0] rounded-lg transition-colors"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(exp.id)}
                          title="Delete Expense"
                          className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MEMBERS & ACCESS MANAGEMENT */}
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Access Settings & Invite Controls */}
              <div className="bg-[#f5f5f0] p-4 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e5e5df]">
                  <div>
                    <h4 className="font-serif italic font-bold text-sm text-[#2c2c24] flex items-center space-x-2">
                      <Key className="w-4 h-4 text-[#5A5A40]" />
                      <span>Group Access & Collaboration Permissions</span>
                    </h4>
                    <p className="text-xs text-[#6b6b5e]">
                      Control who can view or edit activity votes, luggage items, and shared expenses.
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={handleExportCollabSummary}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] font-serif italic text-xs transition-colors shadow-2xs"
                      title="Copy complete markdown summary of trip members, voting consensus & settlements"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#5A5A40]" />
                      <span>Export Summary</span>
                    </button>
                  </div>
                </div>

                {/* Access Level Radio Group */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => handleUpdateAccessLevel("open_collab")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      (collabState.accessSettings?.accessLevel || "open_collab") === "open_collab"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Globe className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Open Collab</span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      Anyone with the trip invite link can vote, check luggage, and split costs.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateAccessLevel("invite_only")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      collabState.accessSettings?.accessLevel === "invite_only"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Users className="w-3.5 h-3.5 text-amber-700" />
                      <span>Invite-Only</span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      Only registered group members can make edits; guests have view-only access.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleUpdateAccessLevel("view_only")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      collabState.accessSettings?.accessLevel === "view_only"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Lock className="w-3.5 h-3.5 text-stone-700" />
                      <span>Read-Only</span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      Freeze all group changes. The itinerary and hub are locked for viewing only.
                    </p>
                  </button>
                </div>

                {/* Invite Code & Direct Link Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 text-xs">
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-[#d1d1ca]">
                    <span className="text-[#8a8a7e]">Trip Passcode:</span>
                    <span className="font-mono font-bold text-[#2c2c24]">
                      {collabState.accessSettings?.inviteCode || `TRIP-${plan.id.slice(0, 4).toUpperCase()}`}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyInviteCode}
                      className="text-[#5A5A40] hover:text-[#2c2c24] p-1"
                      title="Copy Passcode"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic text-xs hover:bg-[#4a4a35] transition-colors shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Copy Collab Invite Link</span>
                  </button>
                </div>
              </div>

              {/* Add New Traveler Form */}
              <div className="bg-white p-4 rounded-2xl border border-[#d1d1ca] space-y-3 shadow-2xs">
                <h5 className="font-serif italic font-bold text-xs text-[#2c2c24] flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4 text-[#5A5A40]" />
                  <span>Add Traveler to Group:</span>
                </h5>

                <form onSubmit={handleAddMember} className="flex flex-wrap sm:flex-nowrap items-center gap-2 text-xs">
                  <input
                    type="text"
                    placeholder="Enter traveler's name..."
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none focus:border-[#5A5A40]"
                  />

                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as MemberRole)}
                    className="px-3 py-2 border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                  >
                    <option value="editor">✏️ Editor / Traveler</option>
                    <option value="organizer">👑 Organizer</option>
                    <option value="viewer">👁️ Viewer</option>
                  </select>

                  <button
                    type="submit"
                    disabled={!newMemberName.trim()}
                    className="px-4 py-2 bg-[#5A5A40] text-white font-serif italic rounded-xl hover:bg-[#4a4a35] transition-colors disabled:opacity-40 shrink-0"
                  >
                    + Add to Group
                  </button>
                </form>
              </div>

              {/* Travelers Roster List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-serif italic font-bold text-[#2c2c24]">
                    Active Travelers Roster ({collabState.members.length} Members):
                  </span>
                  <span className="text-[#8a8a7e]">
                    Click "Act As" to test perspective or toggle roles
                  </span>
                </div>

                <div className="border border-[#e5e5df] rounded-2xl divide-y divide-[#e5e5df] bg-white overflow-hidden shadow-2xs">
                  {(collabState.memberProfiles || []).map((profile) => {
                    const isSelf = profile.name === currentName;
                    const isEditingThis = editingMemberOriginalName === profile.name;
                    const memberPackingCount = collabState.packingList.filter(
                      (p) => p.checkedBy && p.checkedBy.includes(profile.name)
                    ).length;
                    const memberExpensesPaid = collabState.expenses
                      .filter((e) => e.paidBy === profile.name)
                      .reduce((sum, e) => sum + e.amount, 0);

                    return (
                      <div
                        key={profile.id || profile.name}
                        className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-colors ${
                          isSelf ? "bg-[#fbfbf9]" : "hover:bg-[#fafaf7]"
                        }`}
                      >
                        {/* Member identity */}
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${getAvatarColor(
                              profile.name
                            )}`}
                          >
                            {profile.name.charAt(0).toUpperCase()}
                          </div>

                          {!isEditingThis ? (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[#2c2c24] text-sm truncate">
                                  {profile.name}
                                </span>
                                {isSelf && (
                                  <span className="text-[10px] font-sans font-semibold px-2 py-0.2 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca]">
                                    Active Profile
                                  </span>
                                )}
                                <span
                                  className={`text-[10px] font-sans px-2 py-0.2 rounded-full border ${
                                    profile.role === "organizer"
                                      ? "bg-amber-50 text-amber-900 border-amber-200"
                                      : profile.role === "viewer"
                                      ? "bg-stone-50 text-stone-700 border-stone-200"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                                >
                                  {profile.role === "organizer"
                                    ? "👑 Organizer"
                                    : profile.role === "viewer"
                                    ? "👁️ Viewer"
                                    : "✏️ Contributor"}
                                </span>
                              </div>

                              <div className="flex items-center space-x-3 text-[11px] text-[#8a8a7e] mt-0.5">
                                <span>🎒 {memberPackingCount} packed</span>
                                <span>•</span>
                                <span>💰 {plan.currency || "€"}{memberExpensesPaid.toFixed(2)} paid</span>
                              </div>
                            </div>
                          ) : (
                            <form
                              onSubmit={handleSaveEditMember}
                              className="flex flex-wrap items-center gap-2 flex-1"
                            >
                              <input
                                type="text"
                                value={editMemberNameInput}
                                onChange={(e) => setEditMemberNameInput(e.target.value)}
                                className="px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] w-36"
                                autoFocus
                              />
                              <select
                                value={editMemberRoleInput}
                                onChange={(e) =>
                                  setEditMemberRoleInput(e.target.value as MemberRole)
                                }
                                className="px-2 py-1 text-xs border border-[#d1d1ca] rounded-xl bg-white"
                              >
                                <option value="editor">✏️ Contributor</option>
                                <option value="organizer">👑 Organizer</option>
                                <option value="viewer">👁️ Viewer</option>
                              </select>
                              <button
                                type="submit"
                                className="px-2.5 py-1 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingMemberOriginalName(null)}
                                className="px-2 py-1 text-[#6b6b5e] hover:bg-[#ecece4] rounded-xl text-xs"
                              >
                                Cancel
                              </button>
                            </form>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleSwitchActiveProfile(profile.name)}
                              className="px-2.5 py-1 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] font-serif italic text-xs transition-colors"
                              title="Switch to act as this traveler"
                            >
                              Act as {profile.name}
                            </button>
                          )}

                          {!isEditingThis && (
                            <button
                              type="button"
                              onClick={() => handleStartEditMember(profile)}
                              className="p-1.5 text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#ecece4] rounded-lg transition-colors"
                              title="Edit Member Name or Role"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {collabState.members.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(profile.name)}
                              className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Remove Member from Group"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between text-xs rounded-b-3xl">
          <span className="text-[#8a8a7e] font-sans">
            Group Data Auto-Saved for {plan.destinationOrTown}
          </span>
          {!isInline && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs"
            >
              Done
            </button>
          )}
        </div>
      </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-20 select-none"
      onClick={onClose}
    >
      {content}
    </div>
  );
};
