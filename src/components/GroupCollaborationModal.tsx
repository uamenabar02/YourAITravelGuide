import React, { useState, useEffect } from "react";
import {
  ItineraryPlan,
  GroupCollaborationState,
  GroupPackingItem,
  GroupShoppingItem,
  ShoppingCategory,
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
  Briefcase,
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
  Save,
  FolderOpen,
  Link2,
  Unlink,
  UserCheck,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  MapPin,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { CostExpenseSummary } from "./CostExpenseSummary";
import { useAuth } from "../context/AuthContext";
import {
  getUserPermissions,
  claimMemberIdentity,
  unlinkMemberIdentity,
  updateMemberRoleInTrip,
  assignMemberAccountEmail,
  publishSharedTripUpdate,
  subscribeToSharedTrip,
  updateTripVisibility,
} from "../utils/sharedTripService";
import {
  BRING_CATEGORIES,
  BRING_PRESET_ITEMS,
  addShoppingItem,
  toggleShoppingItemStatus,
  assignShoppingItem,
  deleteShoppingItem,
  clearBoughtShoppingItems,
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
  resetPackingListWithWeatherAI,
  packAllItemsForUser,
  unpackAllItemsForUser,
  generateSmartGroupPackingList,
} from "../utils/collaboration";
import { getAvatarColor } from "../utils/formatters";
import { generateShareableUrl } from "../utils/sharing";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import {
  PieChart as RePieChart,
  Pie as RePie,
  Cell as ReCell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
} from "recharts";

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  food: "Food & Dining",
  transport: "Transport & Taxis",
  accommodation: "Accommodation",
  activities: "Activities & Tickets",
  shopping: "Shopping & Souvenirs",
  general: "General & Misc",
};

const CATEGORY_COLORS: Record<string, string> = {
  food: "#10b981",          // Emerald
  transport: "#f59e0b",     // Amber
  accommodation: "#6366f1", // Indigo
  activities: "#f43f5e",    // Rose
  shopping: "#a855f7",     // Purple
  general: "#64748b",      // Slate
};

const CURRENCY_CONVERSION_RATES: Record<string, { symbol: string; rateToBase: number }> = {
  USD: { symbol: "$", rateToBase: 0.91 },   // 1 USD = 0.91 EUR
  GBP: { symbol: "£", rateToBase: 1.17 },   // 1 GBP = 1.17 EUR
  JPY: { symbol: "¥", rateToBase: 0.0062 }, // 1 JPY = 0.0062 EUR
  CHF: { symbol: "CHF", rateToBase: 1.06 }, // 1 CHF = 1.06 EUR
  CAD: { symbol: "C$", rateToBase: 0.67 },  // 1 CAD = 0.67 EUR
  AUD: { symbol: "A$", rateToBase: 0.61 },  // 1 AUD = 0.61 EUR
  COP: { symbol: "COP", rateToBase: 0.00022 },
  MXN: { symbol: "Mex$", rateToBase: 0.054 },
};

interface GroupCollaborationModalProps {
  plan: ItineraryPlan;
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (msg: string, type?: "success" | "info" | "error") => void;
  isInline?: boolean;
  initialTab?: "votes" | "packing" | "shopping" | "expenses" | "members";
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
  initialTab,
}) => {
  const { t, formatCurrency } = useLanguage();
  const { user, activeEmail } = useAuth();
  const [collabState, setCollabState] = useState<GroupCollaborationState>(() =>
    getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags)
  );
  const [activeTab, setActiveTab] = useState<"votes" | "packing" | "shopping" | "expenses" | "members">(
    initialTab || "votes"
  );
  const [currentName, setCurrentName] = useState(getCurrentUserName());
  const [isEditingName, setIsEditingName] = useState(false);

  // Community Sharing & Visibility States
  const [visibility, setVisibility] = useState<"private" | "public" | "passcode">("private");
  const [passcode, setPasscode] = useState("");
  const [tempPasscode, setTempPasscode] = useState("");
  const [isEditingPasscode, setIsEditingPasscode] = useState(false);
  const [isSavingVisibility, setIsSavingVisibility] = useState(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Direct Account Assignment State for Organizers
  const [assigningAccountForMember, setAssigningAccountForMember] = useState<string | null>(null);
  const [targetAccountEmailInput, setTargetAccountEmailInput] = useState("");

  const userPerms = getUserPermissions(plan, collabState, activeEmail || user?.email);

  // Real-time Firestore sync for group collaboration state and visibility settings
  useEffect(() => {
    if (!plan?.id) return;
    const unsubscribe = subscribeToSharedTrip(plan.id, (sharedDoc) => {
      if (sharedDoc) {
        if (sharedDoc.collabState) {
          setCollabState(sharedDoc.collabState);
        }
        if (sharedDoc.visibility) {
          setVisibility(sharedDoc.visibility);
        } else {
          setVisibility("private");
        }
        if (sharedDoc.passcode) {
          setPasscode(sharedDoc.passcode);
        } else {
          setPasscode("");
        }
      }
    });
    return () => unsubscribe();
  }, [plan?.id]);

  // Keep currentName in sync with calculated memberName from permissions
  useEffect(() => {
    if (userPerms.memberName && userPerms.memberName !== currentName) {
      setCurrentName(userPerms.memberName);
    }
  }, [userPerms.memberName]);

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
  const [showPackingForm, setShowPackingForm] = useState(false);
  const [packSearchQuery, setPackSearchQuery] = useState("");

  // --- Bring! Shopping List State ---
  const [shopCategoryFilter, setShopCategoryFilter] = useState<string>("all");
  const [shopSearchQuery, setShopSearchQuery] = useState("");
  const [customShopName, setCustomShopName] = useState("");
  const [customShopQuantity, setCustomShopQuantity] = useState("");
  const [customShopCategory, setCustomShopCategory] = useState<ShoppingCategory>("drinks");
  const [customShopAssignee, setCustomShopAssignee] = useState("");
  const [showCustomShopForm, setShowCustomShopForm] = useState(false);

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

  // Expense Filters & Sorting
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterPaidBy, setFilterPaidBy] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date_desc");
  const [filterSearch, setFilterSearch] = useState("");
  const [expensesSubTab, setExpensesSubTab] = useState<"summary" | "list" | "balances">("list");

  const getTripDayForDate = (dateStr: string): number | null => {
    if (!dateStr || !plan.startDate) return null;
    try {
      const start = new Date(plan.startDate);
      const current = new Date(dateStr);
      // Strip hours to compare dates only
      start.setHours(0, 0, 0, 0);
      current.setHours(0, 0, 0, 0);
      const diffTime = current.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays + 1; // Day 1, Day 2, etc.
    } catch {
      return null;
    }
  };

  const [showNetBalances, setShowNetBalances] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth > 768 : true
  );

  // Currency Converter fields
  const [converterOpen, setConverterOpen] = useState(false);
  const [converterCurrency, setConverterCurrency] = useState("USD");
  const [converterAmount, setConverterAmount] = useState("");
  const [converterRate, setConverterRate] = useState("0.91");
  const [expandedActIds, setExpandedActIds] = useState<Record<string, boolean>>({});

  const toggleExpandAct = (id: string) => {
    setExpandedActIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Group Password, Saving & Loading State
  const [groupPasswordInput, setGroupPasswordInput] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [saveGroupName, setSaveGroupName] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [expandedMembers, setExpandedMembers] = useState<Record<string, boolean>>({});

  const toggleExpandMember = (memberName: string) => {
    setExpandedMembers((prev) => ({ ...prev, [memberName]: !prev[memberName] }));
  };
  const [savedGroups, setSavedGroups] = useState<{ name: string; members: string[]; passcode: string }[]>(() => {
    try {
      const stored = localStorage.getItem("travel_saved_groups");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!isOpen && !isInline) return;

    const state = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
    setCollabState(state);
    const name = getCurrentUserName();
    setCurrentName(name);
    setExpPaidBy(name);
    setExpSplitBetween(state.members);

    const handleSync = () => {
      queueMicrotask(() => {
        const state = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
        setCollabState(state);
      });
    };

    window.addEventListener("localexplorer_cloud_sync_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("localexplorer_cloud_sync_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
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

  const handleSaveVisibility = async (newVisibility: "private" | "public" | "passcode", customPasscode?: string) => {
    setIsSavingVisibility(true);
    const emailToUse = activeEmail || user?.email || "";
    const res = await updateTripVisibility(plan.id, newVisibility, customPasscode || passcode, emailToUse);
    setIsSavingVisibility(false);
    if (res.success) {
      if (onShowToast) {
        onShowToast(
          t(
            "collab.visibilityUpdated",
            `Visibility updated to ${newVisibility === "public" ? "🌍 Public to Community" : newVisibility === "passcode" ? "🔑 Passcode Protected" : "🔒 Private"}`
          ),
          "success"
        );
      }
      setIsEditingPasscode(false);
    } else {
      if (onShowToast) {
        onShowToast(res.message || "Failed to update visibility settings.", "error");
      }
    }
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

  const handleChangePassword = (newPass: string) => {
    if (!newPass.trim()) return;
    const updated = {
      ...collabState,
      accessSettings: {
        ...collabState.accessSettings,
        inviteCode: newPass.trim().toUpperCase(),
      },
    };
    setCollabState(updated);
    saveCollaborationState(updated);
    setIsChangingPassword(false);
    setGroupPasswordInput("");
    onShowToast?.("Group passcode updated successfully!", "success");
  };

  const handleSaveGroup = (name: string) => {
    if (!name.trim()) return;
    const newGroup = {
      name: name.trim(),
      members: [...collabState.members],
      passcode: collabState.accessSettings?.inviteCode || `TRIP-${plan.id.slice(0, 4).toUpperCase()}`,
    };
    
    const filtered = savedGroups.filter((g) => g.name !== newGroup.name);
    const updated = [...filtered, newGroup];
    setSavedGroups(updated);
    localStorage.setItem("travel_saved_groups", JSON.stringify(updated));
    setSaveGroupName("");
    setIsSavingGroup(false);
    onShowToast?.(`Group "${newGroup.name}" saved successfully!`, "success");
  };

  const handleLoadGroup = (groupName: string) => {
    const selected = savedGroups.find((g) => g.name === groupName);
    if (!selected) return;
    
    const updated = {
      ...collabState,
      members: selected.members,
      accessSettings: {
        ...collabState.accessSettings,
        inviteCode: selected.passcode,
      },
    };
    setCollabState(updated);
    saveCollaborationState(updated);
    onShowToast?.(`Loaded group "${selected.name}" with ${selected.members.length} members!`, "success");
  };

  const handleDeleteSavedGroup = (groupName: string) => {
    const updated = savedGroups.filter((g) => g.name !== groupName);
    setSavedGroups(updated);
    localStorage.setItem("travel_saved_groups", JSON.stringify(updated));
    onShowToast?.(`Deleted saved group "${groupName}"`, "success");
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
    setShowPackingForm(false);
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

  const handleResetPackingWithWeatherAI = () => {
    const fresh = resetPackingListWithWeatherAI(plan);
    setCollabState((prev) => ({ ...prev, packingList: fresh }));
    onShowToast?.("Regenerated smart weather-tailored packing list!", "success");
  };

  const handlePackAll = () => {
    packAllItemsForUser(plan.id, currentName);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    onShowToast?.("Marked all items as packed in your luggage", "success");
  };

  const handleUnpackAll = () => {
    unpackAllItemsForUser(plan.id, currentName);
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    onShowToast?.("Unchecked all packing items for your luggage", "info");
  };

  const handleCopyPackingList = () => {
    const lines = [
      `🎒 Smart Packing List for ${plan.destinationOrTown} (${collabState.packingList.length} items)`,
      `Traveler: ${currentName} (${userPackedCount}/${totalPackingCount} packed)`,
      `-----------------------------------------`,
      ...collabState.packingList.map((item) => {
        const isPacked = item.checkedBy?.includes(currentName);
        const icon = isPacked ? "[✓]" : "[ ]";
        const assignee = item.assignedTo ? ` (Assigned: ${item.assignedTo})` : "";
        const tip = item.reason ? ` — Tip: ${item.reason}` : "";
        return `${icon} ${item.item}${assignee}${tip}`;
      }),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    onShowToast?.("Packing checklist copied to clipboard!", "success");
  };

  // Personal vs Group packing stats
  const totalPackingCount = collabState.packingList.length;
  const userPackedCount = collabState.packingList.filter(
    (p) => p.checkedBy && p.checkedBy.includes(currentName)
  ).length;
  const userPackingProgress = Math.round((userPackedCount / (totalPackingCount || 1)) * 100);

  const filteredPackingItems = collabState.packingList.filter((item) => {
    if (packCategoryFilter !== "all" && item.category !== packCategoryFilter) return false;
    if (packSearchQuery.trim()) {
      const q = packSearchQuery.toLowerCase().trim();
      const itemMatch = item.item.toLowerCase().includes(q);
      const assigneeMatch = item.assignedTo?.toLowerCase().includes(q);
      const categoryMatch = item.category.toLowerCase().includes(q);
      if (!itemMatch && !assigneeMatch && !categoryMatch) return false;
    }
    return true;
  });

  const myTotalSpend = collabState.expenses
    .filter((e) => e.paidBy === currentName)
    .reduce((sum, e) => sum + e.amount, 0);

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

  const openAddExpenseWithPreFill = (preFill: {
    title: string;
    amount: string;
    category: ExpenseCategory;
    date: string;
  }) => {
    setEditingExpenseId(null);
    setExpTitle(preFill.title);
    setExpAmount(preFill.amount);
    setExpCategory(preFill.category);
    setExpDate(preFill.date);
    setExpPaidBy(currentName);
    setExpSplitMode("equal");
    setExpSplitBetween(collabState.members);
    setExpAllocations({});
    setExpensesSubTab("list");
    setIsExpenseFormOpen(true);
  };

  const handleRefreshCollabState = () => {
    const state = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
    setCollabState(state);
  };

  const getLivePreviewPayments = () => {
    const totalAmt = parseFloat(expAmount) || 0;
    const result: Record<string, { amount: number; isManual: boolean }> = {};
    
    collabState.members.forEach((m) => {
      result[m] = { amount: 0, isManual: false };
    });

    if (expSplitBetween.length === 0) return result;

    if (expSplitMode === "equal") {
      const share = totalAmt / expSplitBetween.length;
      expSplitBetween.forEach((m) => {
        result[m] = { amount: share, isManual: false };
      });
    } else if (expSplitMode === "exact") {
      const manualAllocations: Record<string, number> = {};
      let manualSum = 0;
      
      expSplitBetween.forEach((m) => {
        if (expAllocations[m] !== undefined && expAllocations[m] !== null) {
          manualAllocations[m] = expAllocations[m];
          manualSum += expAllocations[m];
        }
      });

      const unallocatedMembers = expSplitBetween.filter(
        (m) => expAllocations[m] === undefined || expAllocations[m] === null
      );

      if (totalAmt <= 0) {
        expSplitBetween.forEach((m) => {
          result[m] = {
            amount: manualAllocations[m] || 0,
            isManual: expAllocations[m] !== undefined,
          };
        });
      } else {
        const remaining = Math.max(0, totalAmt - manualSum);
        const share = unallocatedMembers.length > 0 ? remaining / unallocatedMembers.length : 0;
        
        expSplitBetween.forEach((m) => {
          if (expAllocations[m] !== undefined && expAllocations[m] !== null) {
            result[m] = { amount: manualAllocations[m], isManual: true };
          } else {
            result[m] = { amount: share, isManual: false };
          }
        });
      }
    } else if (expSplitMode === "shares") {
      let totalShares = 0;
      expSplitBetween.forEach((m) => {
        const sh = expAllocations[m] ?? 1;
        totalShares += Math.max(0, sh);
      });

      if (totalShares <= 0) totalShares = expSplitBetween.length || 1;

      expSplitBetween.forEach((m) => {
        const sh = expAllocations[m] ?? 1;
        const calculatedShare = (sh / totalShares) * totalAmt;
        result[m] = { amount: calculatedShare, isManual: expAllocations[m] !== undefined };
      });
    }

    return result;
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

    let finalAllocations = { ...expAllocations };
    if (expSplitMode === "exact") {
      const preview = getLivePreviewPayments();
      const materialized: Record<string, number> = {};
      expSplitBetween.forEach((m) => {
        materialized[m] = Math.round((preview[m]?.amount || 0) * 100) / 100;
      });
      finalAllocations = materialized;
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
        allocations: finalAllocations,
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
          allocations: finalAllocations,
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

  const handleRecordSettlement = (from: string, to: string, amount: number) => {
    addGroupExpense(
      plan.id,
      `Settlement: ${from} paid ${to}`,
      amount,
      from,
      [to],
      plan.currency || "€",
      {
        category: "general",
        date: new Date().toISOString().split("T")[0],
        splitMode: "equal",
        allocations: {},
      }
    );
    const updated = getCollaborationState(plan.id);
    setCollabState(updated);
    onShowToast?.(`Settlement recorded: ${from} paid ${to} ${plan.currency || "€"}${amount.toFixed(2)}`, "success");
  };

  const getCategoryData = () => {
    const dataMap: Record<ExpenseCategory, number> = {
      food: 0,
      transport: 0,
      accommodation: 0,
      activities: 0,
      shopping: 0,
      general: 0,
    };
    collabState.expenses.forEach((e) => {
      const cat = e.category || "general";
      dataMap[cat] = (dataMap[cat] || 0) + e.amount;
    });

    return Object.entries(dataMap)
      .map(([cat, amt]) => ({
        name: CATEGORY_NAMES[cat as ExpenseCategory] || cat,
        value: Math.round(amt * 100) / 100,
        category: cat,
      }))
      .filter((item) => item.value > 0);
  };

  const handleExportLedgerReport = () => {
    const bSummary = calculateBalances(collabState.expenses, collabState.members);
    const sSummary = calculateDebtSettlements(bSummary);
    const totalSpent = collabState.expenses.reduce((acc, e) => acc + e.amount, 0);

    const textReport = [
      `=========================================`,
      `🌍 SHARED EXPENSE LEDGER REPORT: ${plan.destinationOrTown.toUpperCase()}`,
      `=========================================`,
      `📅 Generated On: ${new Date().toLocaleDateString()}`,
      `👥 Group Members: ${collabState.members.join(", ")}`,
      `💰 Total Trip Shared Cost: ${plan.currency || "€"}${totalSpent.toFixed(2)}`,
      `-----------------------------------------`,
      `📊 MEMBER BALANCES SUMMARY:`,
      `-----------------------------------------`,
      ...bSummary.map(
        (b) =>
          `• ${b.member.padEnd(12)} | Spent: ${plan.currency || "€"}${b.totalPaid.toFixed(2).padStart(8)} | Net: ${b.netBalance >= 0 ? "+" : ""}${plan.currency || "€"}${b.netBalance.toFixed(2)}`
      ),
      "",
      `-----------------------------------------`,
      `🤝 OPTIMAL DEBT SETTLEMENT TRANSFER PLAN:`,
      `-----------------------------------------`,
      sSummary.length === 0
        ? "✔ All group balances are completely settled!"
        : sSummary.map(
            (s) => `• ${s.from} pays ${s.to} ➔ ${plan.currency || "€"}${s.amount.toFixed(2)}`
          ).join("\n"),
      "",
      `-----------------------------------------`,
      `🧾 DETAILED EXPENSES LEDGER:`,
      `-----------------------------------------`,
      ...collabState.expenses.map((e, idx) => {
        const dateStr = e.date || "N/A";
        return `${(idx + 1).toString().padStart(2)}. [${dateStr}] ${e.title.padEnd(20)} | Paid by: ${e.paidBy.padEnd(10)} | Amount: ${plan.currency || "€"}${e.amount.toFixed(2)} (Split: ${e.splitMode})`;
      }),
      `=========================================`,
    ].join("\n");

    try {
      navigator.clipboard.writeText(textReport);
      onShowToast?.("Ledger summary copied to clipboard!", "success");
    } catch (err) {
      // Fallback
    }

    // CSV represention and file trigger
    const csvHeader = "ID,Date,Description,Paid By,Amount,Currency,Split Mode,Split Between\n";
    const csvRows = collabState.expenses.map((e, idx) => {
      const escapedTitle = `"${e.title.replace(/"/g, '""')}"`;
      const escapedMembers = `"${e.splitBetween.join(", ")}"`;
      return `${idx + 1},${e.date},${escapedTitle},${e.paidBy},${e.amount},${plan.currency || "€"},${e.splitMode},${escapedMembers}`;
    }).join("\n");
    const csvContent = csvHeader + csvRows;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Tricount_Ledger_${plan.destinationOrTown.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const balances = calculateBalances(collabState.expenses, collabState.members);
  const settlements = calculateDebtSettlements(balances);
  const totalGroupSpend = collabState.expenses.reduce((sum, e) => sum + e.amount, 0);

  const uniqueExpenseDates = (Array.from(
    new Set(collabState.expenses.map((e) => e.date).filter(Boolean))
  ) as string[]).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const filteredExpenses = collabState.expenses
    .filter((exp) => {
      if (filterCategory !== "all" && exp.category !== filterCategory) return false;
      if (filterPaidBy !== "all" && exp.paidBy !== filterPaidBy) return false;
      if (filterDate !== "all" && exp.date !== filterDate) return false;
      if (
        filterSearch &&
        !exp.title.toLowerCase().includes(filterSearch.toLowerCase()) &&
        !exp.paidBy.toLowerCase().includes(filterSearch.toLowerCase())
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "date_desc") {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      if (sortBy === "date_asc") {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      if (sortBy === "amount_desc") {
        return b.amount - a.amount;
      }
      if (sortBy === "amount_asc") {
        return a.amount - b.amount;
      }
      return 0;
    });

  const content = (
    <div
      className={`bg-white rounded-3xl w-full flex flex-col ${
        isInline ? "" : "max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl border border-[#e5e5df]"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Modal Header - Hidden on mobile if inline */}
      <div className={`p-4 sm:p-6 bg-[#2c2c24] text-white flex items-center justify-between border-b border-[#3a3a30] rounded-t-3xl ${isInline ? 'hidden md:flex' : 'flex'}`}>
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

        {/* Member Profile Quick-Bar & Share Link - Compressed on mobile */}
        <div className="bg-[#f5f5f0] px-3 sm:px-5 py-2.5 border-b border-[#e5e5df] flex flex-wrap items-center justify-between gap-2.5 text-[11px] sm:text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active User Switcher */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
              <span className="text-[#8a8a7e] hidden sm:inline">{t("collab.activeUser", "Active User")}:</span>
              {!isEditingName ? (
                <div className="flex items-center space-x-1 sm:space-x-1.5">
                  <span className="font-semibold text-[#2c2c24] bg-white px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl border border-[#d1d1ca] shadow-2xs flex items-center space-x-1 sm:space-x-1.5 text-[10px] sm:text-xs">
                    <span className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${getAvatarColor(currentName)}`}></span>
                    <span>{currentName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="text-[10px] sm:text-[11px] text-[#5A5A40] hover:underline font-serif italic"
                  >
                    {t("collab.rename", "Rename")}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveName} className="flex items-center space-x-1 sm:space-x-1.5">
                  <input
                    type="text"
                    value={currentName}
                    onChange={(e) => setCurrentName(e.target.value)}
                    className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs border border-[#d1d1ca] rounded-lg sm:rounded-xl bg-white font-sans w-20 sm:w-32 focus:outline-none focus:border-[#5A5A40]"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-0.5 bg-[#5A5A40] text-white rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-serif italic hover:bg-[#4a4a35]"
                  >
                    {t("action.save", "Save")}
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-1 sm:space-x-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="flex items-center space-x-1 px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] font-serif italic text-[10px] sm:text-xs transition-colors shadow-2xs shrink-0"
            >
              <Share2 className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-[#5A5A40]" />
              <span className="hidden sm:inline">{t("action.copyLink", "Copy Invite Link")}</span>
              <span className="inline sm:hidden">{t("action.share", "Share")}</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation - Aligned with App Navigation Bar Aesthetic */}
        <div className="px-1 sm:px-6 py-3 border-b border-[#e5e5df]/60 bg-[#fafaf7]">
          <div className="bg-white p-1 rounded-2xl border border-[#e5e5df] w-full grid grid-cols-5 gap-0.5 sm:gap-1 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTab("votes")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "votes"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden md:inline">{t("collab.tab.votes", "Activity Votes")}</span>
              <span className="inline md:hidden truncate max-w-full"><TranslatedText text="Votes" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("packing")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "packing"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden md:inline">{t("collab.tab.packing", "Luggage")}</span>
              <span className="inline md:hidden truncate max-w-full"><TranslatedText text="Packing" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("shopping")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "shopping"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden md:inline">{t("collab.tab.shopping", "Shopping")}</span>
              <span className="inline md:hidden truncate max-w-full"><TranslatedText text="Shop" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("expenses")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "expenses"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden md:inline">{t("collab.tab.expenses", "Expenses")}</span>
              <span className="inline md:hidden truncate max-w-full"><TranslatedText text="Expenses" /></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 py-1.5 sm:py-2.5 px-0.5 sm:px-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer text-center w-full min-w-0 ${
                activeTab === "members"
                  ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                  : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden md:inline">{t("collab.tab.members", "Members")}</span>
              <span className="inline md:hidden truncate max-w-full"><TranslatedText text="Members" /></span>
            </button>
          </div>
        </div>

        {/* Tab Content Panes */}
        <div className="p-3 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: DAY-BY-DAY ACTIVITY VOTES */}
          {activeTab === "votes" && (
            <div className="space-y-4 sm:space-y-6">
              <div className="bg-[#f5f5f0] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-serif italic font-bold text-xs sm:text-sm text-[#2c2c24]">
                    <TranslatedText text="Itinerary Spot Consensus & Group Feedback" />
                  </h4>
                  <p className="text-[10px] sm:text-xs text-[#6b6b5e]">
                    <TranslatedText text="Vote on spots per day in chronological sequence so the group can lock in consensus." />
                  </p>
                </div>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                    <span><TranslatedText text="Must-Do" /></span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span><TranslatedText text="Sounds Good" /></span>
                  </span>
                  <span className="flex items-center space-x-1 text-[#2c2c24]">
                    <ThumbsDown className="w-3.5 h-3.5 text-amber-600" />
                    <span><TranslatedText text="Pass" /></span>
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
                          <TranslatedText text={`Day ${day.dayNumber}`} />: <TranslatedText text={day.theme || day.dayTitle} />
                        </span>
                        <span className="text-[11px] text-[#d1d1ca] font-sans">
                          • {day.activities.length} <TranslatedText text="spots" />
                        </span>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#d1d1ca] hidden sm:inline">
                        {day.estimatedTotalBudget || ""}
                      </span>
                    </div>
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
                        const isExpanded = !!expandedActIds[act.id];

                        return (
                          <div
                            key={act.id || actIdx}
                            className="p-4 hover:bg-[#fafaf7] transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div
                                className="min-w-0 flex-1 cursor-pointer"
                                onClick={() => toggleExpandAct(act.id)}
                              >
                                <div className="flex items-center space-x-2">
                                  <h5 className="font-serif font-bold italic text-sm text-[#2c2c24] break-words whitespace-normal hover:text-[#5A5A40] transition-colors">
                                    <TranslatedText text={act.name} />
                                  </h5>
                                  <span className="text-[#8a8a7e] hover:text-[#2c2c24] transition-colors">
                                    {isExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5 inline" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5 inline" />
                                    )}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                  <span className="text-[10px] sm:text-[11px] font-mono text-[#8a8a7e] bg-[#f5f5f0] px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">
                                    {act.time}
                                  </span>
                                  <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-[#ecece4] text-[#5A5A40] border border-[#d1d1ca] capitalize shrink-0">
                                    <TranslatedText text={act.category} />
                                  </span>
                                  {act.duration && (
                                    <span className="text-[10px] font-sans px-1.5 py-0.5 text-[#8a8a7e] shrink-0">
                                      ⏱️ <TranslatedText text={act.duration} />
                                    </span>
                                  )}
                                </div>
                                {act.description && !isExpanded && (
                                  <p className="text-xs text-[#6b6b5e] line-clamp-1 mt-1 font-sans hidden md:block">
                                    <TranslatedText text={act.description} />
                                  </p>
                                )}
                              </div>

                              {/* Voting Buttons with custom active/inactive feedback */}
                              <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                                <button
                                  type="button"
                                  onClick={() => handleVoteInModal(act.id, "heart")}
                                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-serif italic border transition-all duration-150 ${
                                    hasHearted
                                      ? "bg-rose-50 border-rose-300 text-rose-700 font-bold shadow-2xs scale-[1.03]"
                                      : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50/20"
                                  }`}
                                  title="Love it / Must-do"
                                >
                                  <Heart
                                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                      hasHearted ? "fill-rose-500 text-rose-500 scale-110" : "group-hover:scale-110"
                                    }`}
                                  />
                                  <span>{vote.hearts?.length || 0}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleVoteInModal(act.id, "up")}
                                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-serif italic border transition-all duration-150 ${
                                    hasLiked
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-700 font-bold shadow-2xs scale-[1.03]"
                                      : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50/20"
                                  }`}
                                  title="Sounds good"
                                >
                                  <ThumbsUp
                                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                      hasLiked ? "fill-emerald-600 text-emerald-600 scale-110" : "group-hover:scale-110"
                                    }`}
                                  />
                                  <span>{vote.up?.length || 0}</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleVoteInModal(act.id, "down")}
                                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-serif italic border transition-all duration-150 ${
                                    hasDisliked
                                      ? "bg-amber-50 border-amber-300 text-amber-800 font-bold shadow-2xs scale-[1.03]"
                                      : "bg-white border-[#d1d1ca] text-[#6b6b5e] hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50/20"
                                  }`}
                                  title="Pass / Swap"
                                >
                                  <ThumbsDown
                                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                                      hasDisliked ? "fill-amber-600 text-amber-700 scale-110" : ""
                                    }`}
                                  />
                                  <span>{vote.down?.length || 0}</span>
                                </button>
                              </div>
                            </div>

                            {/* Expandable Activity Details within Group Hub */}
                            {isExpanded && (
                              <div className="mt-3 p-3.5 bg-[#fafaf7] rounded-xl border border-[#ecece5] space-y-2.5 text-xs">
                                {act.description && (
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] font-sans"><TranslatedText text="About Spot" /></span>
                                    <p className="text-[#2c2c24] font-sans leading-relaxed break-words whitespace-normal">
                                      <TranslatedText text={act.description} />
                                    </p>
                                  </div>
                                )}
                                {act.mustSeeReason && (
                                  <div className="p-2.5 bg-[#ecece4]/40 rounded-lg border border-[#d1d1ca]/40">
                                    <span className="text-[10px] font-bold text-[#5A5A40] block mb-0.5"><TranslatedText text="💡 EXCLUSIVE LOCAL INSIGHT" /></span>
                                    <p className="font-serif italic text-[#4a4a37]">
                                      "<TranslatedText text={act.mustSeeReason} />"
                                    </p>
                                  </div>
                                )}
                                {act.address && (
                                  <div className="flex items-center space-x-2 text-[11px] text-[#6b6b5e]">
                                    <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                                    <span className="truncate">{act.address}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Voter Pill List */}
                            {(vote.hearts?.length > 0 ||
                              vote.up?.length > 0 ||
                              vote.down?.length > 0) && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-dashed border-[#ecece5] text-[10px]">
                                {vote.hearts?.map((u) => (
                                  <span
                                    key={u}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"
                                  >
                                    <Heart className="w-2.5 h-2.5 fill-rose-500 text-rose-500" />
                                    <span className="font-sans font-medium">{u}</span>
                                  </span>
                                ))}
                                {vote.up?.map((u) => (
                                  <span
                                    key={u}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  >
                                    <ThumbsUp className="w-2.5 h-2.5 fill-emerald-600 text-emerald-600" />
                                    <span className="font-sans font-medium">{u}</span>
                                  </span>
                                ))}
                                {vote.down?.map((u) => (
                                  <span
                                    key={u}
                                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
                                  >
                                    <ThumbsDown className="w-2.5 h-2.5 text-amber-700" />
                                    <span className="font-sans font-medium">{u}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: PACKING LIST (SMART WEATHER-AWARE) */}
          {activeTab === "packing" && (
            <div className="space-y-5">
              {/* Weather & Climate Intelligence Bar */}
              <div className="bg-gradient-to-r from-[#f7f7f2] via-[#f5f5ee] to-[#ecece4] p-4 rounded-2xl border border-[#d1d1ca] shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100/80 text-amber-900 border border-amber-300 rounded-xl shrink-0">
                      <Sparkles className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                          <TranslatedText text="Destination Luggage Assistant" />: <TranslatedText text={plan.destinationOrTown} />
                        </h4>
                        <span className="text-[10px] font-sans font-semibold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                          <TranslatedText text="AI Weather Tailored" />
                        </span>
                      </div>
                      <p className="text-xs text-[#6b6b5e] mt-0.5">
                        {plan.weatherForecast ? (
                          <><TranslatedText text="Forecasted Range" />: {plan.weatherForecast.avgLowC}°C – {plan.weatherForecast.avgHighC}°C • <TranslatedText text="Max Rain Chance" />: {Math.max(...plan.weatherForecast.dailyForecast.map(d => d.precipitationChance))}%</>
                        ) : (
                          <><TranslatedText text={`Tailored for ${plan.totalDays} days in`} /> <TranslatedText text={plan.destinationOrTown} /></>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* AI Regenerate Button */}
                  <button
                    type="button"
                    onClick={handleResetPackingWithWeatherAI}
                    className="px-3.5 py-2 bg-[#2c2c24] hover:bg-[#3d3d32] text-white text-xs font-serif italic rounded-xl transition-all shadow-2xs flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                    title="Regenerate packing list using live weather forecast & activity profile"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span><TranslatedText text="Regenerate with AI" /></span>
                  </button>
                </div>

                {/* Personal Readiness Banner */}
                <div className="bg-white/80 backdrop-blur-xs p-3 rounded-xl border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-base">🎒</span>
                    <div>
                      <div className="text-xs font-serif italic font-semibold text-[#2c2c24]">
                        {currentName}'s <TranslatedText text="Luggage Readiness" />
                      </div>
                      <div className="text-[11px] text-[#6b6b5e]">
                        {userPackedCount} <TranslatedText text="of" /> {totalPackingCount} <TranslatedText text="items packed in your bags" />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <div className="w-full sm:w-36 bg-[#ecece4] rounded-full h-2.5 overflow-hidden border border-[#d1d1ca]">
                      <div
                        className="bg-[#5A5A40] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${userPackingProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-[#5A5A40] shrink-0">
                      {userPackingProgress}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Action Toolbar & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#8a8a7e] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search packing items by name, category, or assignee..."
                    value={packSearchQuery}
                    onChange={(e) => setPackSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40] text-[#2c2c24]"
                  />
                  {packSearchQuery && (
                    <button
                      onClick={() => setPackSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a8a7e] hover:text-[#2c2c24]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Bulk Actions & Add Button */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePackAll}
                    className="px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#e0e0d6] text-[#2c2c24] text-xs rounded-xl transition-all border border-[#d1d1ca] font-serif italic"
                    title="Mark all items as packed for your luggage"
                  >
                    ✓ <TranslatedText text="Pack All" />
                  </button>
                  <button
                    type="button"
                    onClick={handleUnpackAll}
                    className="px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#e0e0d6] text-[#2c2c24] text-xs rounded-xl transition-all border border-[#d1d1ca] font-serif italic"
                    title="Uncheck all items for your luggage"
                  >
                    ✕ <TranslatedText text="Unpack All" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPackingList}
                    className="px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#e0e0d6] text-[#2c2c24] text-xs rounded-xl transition-all border border-[#d1d1ca] font-serif italic flex items-center space-x-1"
                    title="Copy text checklist to clipboard"
                  >
                    <Copy className="w-3 h-3 text-[#5A5A40]" />
                    <span><TranslatedText text="Copy" /></span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPackingForm(!showPackingForm)}
                    className="px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors shrink-0 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                  >
                    {showPackingForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{showPackingForm ? <TranslatedText text="Cancel" /> : <TranslatedText text="+ Add Item" />}</span>
                  </button>
                </div>
              </div>

              {/* Add Custom Item Form (Hidden by default) */}
              {showPackingForm && (
                <form
                  onSubmit={handleAddPacking}
                  className="p-4 bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl space-y-3 animate-in fade-in-10"
                >
                  <h5 className="font-serif italic font-bold text-xs text-[#2c2c24]">
                    <TranslatedText text="Add New Packing Item" />
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <input
                      type="text"
                      required
                      placeholder="Item name (e.g. Passport, Power bank...)"
                      value={newPackItem}
                      onChange={(e) => setNewPackItem(e.target.value)}
                      className="sm:col-span-1 px-3 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                    <select
                      value={newPackCategory}
                      onChange={(e) =>
                        setNewPackCategory(e.target.value as GroupPackingItem["category"])
                      }
                      className="px-2.5 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                    >
                      <option value="essentials">Essentials</option>
                      <option value="weather">Weather Apparel</option>
                      <option value="activities">Activity Gear</option>
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
                  </div>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowPackingForm(false)}
                      className="px-3 py-1.5 text-xs font-serif italic text-[#6b6b5e] hover:bg-[#ecece4] rounded-xl"
                    >
                      <TranslatedText text="Cancel" />
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors"
                    >
                      <TranslatedText text="Save Item" />
                    </button>
                  </div>
                </form>
              )}

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pb-1">
                {[
                  { id: "all", label: "All Items", count: collabState.packingList.length },
                  { id: "documents", label: "📄 Documents", count: collabState.packingList.filter(i => i.category === "documents").length },
                  { id: "weather", label: "🧥 Weather Apparel", count: collabState.packingList.filter(i => i.category === "weather").length },
                  { id: "activities", label: "🎟️ Activity Gear", count: collabState.packingList.filter(i => i.category === "activities").length },
                  { id: "clothes", label: "👕 Clothing", count: collabState.packingList.filter(i => i.category === "clothes" || i.category === "essentials").length },
                  { id: "electronics", label: "🔌 Electronics", count: collabState.packingList.filter(i => i.category === "electronics").length },
                  { id: "health", label: "🩹 Health", count: collabState.packingList.filter(i => i.category === "health").length },
                  { id: "custom", label: "✨ Custom", count: collabState.packingList.filter(i => i.category === "custom").length },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setPackCategoryFilter(cat.id)}
                    className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-serif italic transition-all shrink-0 flex items-center space-x-1 ${
                      packCategoryFilter === cat.id
                        ? "bg-[#5A5A40] text-white font-semibold shadow-xs"
                        : "bg-[#f5f5f0] text-[#2c2c24] border border-[#d1d1ca] hover:bg-[#ecece4]"
                    }`}
                  >
                    <span><TranslatedText text={cat.label} /></span>
                    {cat.count > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono ${
                        packCategoryFilter === cat.id ? "bg-white/20 text-white" : "bg-[#ecece4] text-[#5A5A40]"
                      }`}>
                        {cat.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Items List */}
              <div className="border border-[#e5e5df] rounded-2xl divide-y divide-[#e5e5df] bg-white overflow-hidden shadow-2xs">
                {filteredPackingItems.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#8a8a7e] space-y-2">
                    <p className="font-serif italic font-semibold text-sm text-[#2c2c24]"><TranslatedText text="No packing items found" /></p>
                    <p><TranslatedText text="Try clearing your category filter or click 'Regenerate with AI' to generate a list." /></p>
                  </div>
                ) : (
                  filteredPackingItems.map((item) => {
                    const isCheckedForUser = item.checkedBy && item.checkedBy.includes(currentName);
                    const packedByCount = item.checkedBy?.length || 0;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 sm:p-3.5 flex items-start justify-between gap-3 text-xs transition-colors ${
                          isCheckedForUser ? "bg-emerald-50/30" : "hover:bg-[#fafaf7]"
                        }`}
                      >
                        <div className="flex items-start space-x-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isCheckedForUser}
                            onChange={() => handleTogglePersonalPack(item.id)}
                            className="rounded text-[#5A5A40] focus:ring-0 w-4 h-4 mt-0.5 cursor-pointer shrink-0"
                          />
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`font-medium text-[#2c2c24] text-xs sm:text-sm ${
                                  isCheckedForUser ? "line-through text-[#8a8a7e]" : ""
                                }`}
                              >
                                <TranslatedText text={item.item} />
                              </span>

                              {/* Category Badge */}
                              <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                                item.category === "documents" ? "bg-sky-50 text-sky-800 border-sky-200" :
                                item.category === "weather" ? "bg-amber-50 text-amber-900 border-amber-200" :
                                item.category === "activities" ? "bg-rose-50 text-rose-800 border-rose-200" :
                                item.category === "electronics" ? "bg-purple-50 text-purple-800 border-purple-200" :
                                item.category === "health" ? "bg-teal-50 text-teal-800 border-teal-200" :
                                "bg-[#f5f5f0] text-[#6b6b5e] border-[#e5e5df]"
                              }`}>
                                <TranslatedText text={item.category} />
                              </span>
                            </div>

                            {/* Reason / Weather Tip */}
                            {item.reason && (
                              <p className="text-[11px] text-[#6b6b5e] italic">
                                💡 <TranslatedText text={item.reason} />
                              </p>
                            )}

                            {/* Metadata Badges */}
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[#8a8a7e] pt-0.5">
                              {item.assignedTo && (
                                <span className="text-[#5A5A40] font-semibold bg-[#ecece4] px-1.5 py-0.2 rounded border border-[#d1d1ca]">
                                  <TranslatedText text="Assigned" />: {item.assignedTo}
                                </span>
                              )}
                              {packedByCount > 0 && (
                                <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">
                                  <TranslatedText text="Packed by" /> {item.checkedBy?.join(", ")}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 shrink-0 self-center">
                          <select
                            value={item.assignedTo || ""}
                            onChange={(e) => handleAssignPack(item.id, e.target.value)}
                            className="text-[11px] border border-[#d1d1ca] rounded-lg px-2 py-1 bg-white text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
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
                            className="p-1.5 text-[#8a8a7e] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 3: SHOPPING LIST (BRING!-INSPIRED) */}
          {activeTab === "shopping" && (
            <div className="space-y-6">
              {/* Header Banner & Quick Add Preset Catalog */}
              <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e5e5df] shadow-2xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5e5df] pb-4">
                  <div>
                    <h4 className="font-serif font-bold text-lg text-[#2c2c24] flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5 text-[#5A5A40]" />
                      <span><TranslatedText text="Group Shopping List" /></span>
                      <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold font-sans uppercase">
                        <TranslatedText text="Real-Time" />
                      </span>
                    </h4>
                    <p className="text-xs text-[#6b6b5e] mt-0.5">
                      <TranslatedText text="Tap pre-established category tiles to quick-add, or create custom items for the trip." />
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCustomShopForm(!showCustomShopForm)}
                    className="px-3.5 py-2 rounded-xl bg-[#5A5A40] text-white hover:bg-[#474732] text-xs font-semibold transition-all shadow-2xs flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span><TranslatedText text="Custom Item" /></span>
                  </button>
                </div>

                {/* Search & Category Filter Pills / Dropdown */}
                <div className="flex flex-col gap-3">
                  {/* Search input */}
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#8a8a7e]" />
                    <input
                      type="text"
                      placeholder="Search items to buy or add..."
                      value={shopSearchQuery}
                      onChange={(e) => setShopSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl text-[#2c2c24] focus:outline-none focus:ring-1 focus:ring-[#5A5A40]"
                    />
                  </div>

                  {/* Category Pill Filters (With overflow-x-auto, they are guaranteed 100% visible and swipeable on all devices) - Desktop/Tablet only */}
                  <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setShopCategoryFilter("all")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0 ${
                        shopCategoryFilter === "all"
                          ? "bg-[#2c2c24] text-white border-[#2c2c24]"
                          : "bg-[#f5f5f0] text-[#6b6b5e] border-[#d1d1ca] hover:bg-[#ecece4]"
                      }`}
                    >
                      <TranslatedText text="All Categories" />
                    </button>

                    {BRING_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setShopCategoryFilter(cat.id)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1 border shrink-0 ${
                          shopCategoryFilter === cat.id
                            ? "bg-[#5A5A40] text-white border-[#474732]"
                            : "bg-[#f5f5f0] text-[#6b6b5e] border-[#d1d1ca] hover:bg-[#ecece4]"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span><TranslatedText text={cat.label} /></span>
                      </button>
                    ))}
                  </div>

                  {/* Category Filter Dropdown - Smartphone only */}
                  <div className="block sm:hidden relative w-full">
                    <label htmlFor="mobile-shop-category-select" className="sr-only">
                      <TranslatedText text="Select Category" />
                    </label>
                    <select
                      id="mobile-shop-category-select"
                      value={shopCategoryFilter}
                      onChange={(e) => setShopCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-[#f5f5f0] border border-[#d1d1ca] text-[#2c2c24] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer appearance-none pr-10"
                      style={{
                        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235A5A40' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "right 12px center",
                        backgroundSize: "16px",
                      }}
                    >
                      <option value="all">📁 All Categories</option>
                      {BRING_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Item Form */}
                {showCustomShopForm && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!customShopName.trim()) return;
                      const presetMatch = BRING_PRESET_ITEMS.find((p) => p.name.toLowerCase() === customShopName.trim().toLowerCase());
                      const emoji = presetMatch ? presetMatch.emoji : "🛒";
                      addShoppingItem(
                        plan.id,
                        customShopName.trim(),
                        customShopCategory,
                        emoji,
                        customShopQuantity,
                        customShopAssignee,
                        currentName
                      );
                      const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                      setCollabState(updated);
                      publishSharedTripUpdate(plan, updated);
                      setCustomShopName("");
                      setCustomShopQuantity("");
                      setShowCustomShopForm(false);
                      if (onShowToast) onShowToast(`Added "${customShopName.trim()}" to shopping list!`, "success");
                    }}
                    className="p-4 bg-[#f5f5f0] border border-[#d1d1ca] rounded-2xl space-y-3 animate-fade-in"
                  >
                    <h5 className="font-serif italic font-bold text-xs text-[#2c2c24]">
                      <TranslatedText text="Add Custom Shopping Item" />
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Item name (e.g. Local Cava, Olive Oil...)"
                        value={customShopName}
                        onChange={(e) => setCustomShopName(e.target.value)}
                        className="sm:col-span-2 px-3 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Quantity (e.g. 2 bottles, 500g)"
                        value={customShopQuantity}
                        onChange={(e) => setCustomShopQuantity(e.target.value)}
                        className="px-3 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none"
                      />
                      <select
                        value={customShopCategory}
                        onChange={(e) => setCustomShopCategory(e.target.value as ShoppingCategory)}
                        className="px-2.5 py-2 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24]"
                      >
                        {BRING_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCustomShopForm(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#6b6b5e] hover:bg-[#ecece4]"
                      >
                        <TranslatedText text="Cancel" />
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-[#5A5A40] text-white text-xs font-semibold hover:bg-[#474732]"
                      >
                        <TranslatedText text="Add Item" />
                      </button>
                    </div>
                  </form>
                )}

                {/* Pre-Established Bring! Items Quick-Add Grid */}
                <div className="space-y-2.5">
                  <p className="text-xs font-serif italic text-[#5A5A40] font-bold flex items-center justify-between">
                    <span>⚡ <TranslatedText text="Quick-Add Preset Catalog (Tap tile to add to trip)" /></span>
                    <span className="text-[10px] text-[#8a8a7e] font-sans font-normal">
                      <TranslatedText text="Based on preset catalog" />
                    </span>
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 bg-[#fafaf7] rounded-2xl border border-[#ecece5]">
                    {BRING_PRESET_ITEMS.filter((item) => {
                      const matchesCategory = shopCategoryFilter === "all" || item.category === shopCategoryFilter;
                      const matchesQuery = !shopSearchQuery || item.name.toLowerCase().includes(shopSearchQuery.toLowerCase());
                      return matchesCategory && matchesQuery;
                    }).map((preset) => {
                      const isAlreadyAdded = (collabState.shoppingList || []).some(
                        (i) => i.name.toLowerCase() === preset.name.toLowerCase() && i.status === "needed"
                      );

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            addShoppingItem(plan.id, preset.name, preset.category, preset.emoji, undefined, undefined, currentName);
                            const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                            setCollabState(updated);
                            publishSharedTripUpdate(plan, updated);
                            if (onShowToast) onShowToast(`Added "${preset.name}" to shopping list!`, "info");
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-all flex items-center space-x-2 group cursor-pointer ${
                            isAlreadyAdded
                              ? "bg-amber-50/80 border-amber-300 text-amber-900"
                              : "bg-white border-[#e5e5df] hover:border-[#5A5A40] hover:bg-[#f5f5f0]"
                          }`}
                        >
                          <span className="text-xl shrink-0 group-hover:scale-110 transition-transform">
                            {preset.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-[#2c2c24] truncate leading-tight">
                              <TranslatedText text={preset.name} />
                            </p>
                            <p className="text-[9px] text-[#8a8a7e] truncate font-sans">
                              {isAlreadyAdded ? <TranslatedText text="✓ Added" /> : <TranslatedText text="+ Tap to add" />}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Shopping List Items Sections: Needed vs Bought */}
              <div className="space-y-6">
                {/* Section 1: Needed Items (To Buy) */}
                <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e5e5df] shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
                    <h4 className="font-serif font-bold text-base text-[#2c2c24] flex items-center gap-2">
                      <ShoppingCart className="w-4.5 h-4.5 text-amber-600" />
                      <span><TranslatedText text="Items Needed" /> ({ (collabState.shoppingList || []).filter((i) => i.status === "needed").length })</span>
                    </h4>
                    <span className="text-xs text-[#8a8a7e]">
                      <TranslatedText text="Tap item card to mark as bought" />
                    </span>
                  </div>

                  {(collabState.shoppingList || []).filter((i) => i.status === "needed").length === 0 ? (
                    <div className="py-8 text-center bg-[#fafaf7] rounded-2xl border border-dashed border-[#d1d1ca] space-y-2">
                      <p className="text-2xl">🎉</p>
                      <p className="text-xs font-serif italic text-[#5A5A40] font-bold">
                        <TranslatedText text="No pending items! Quick-add from presets above or add a custom item." />
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {(collabState.shoppingList || [])
                        .filter((i) => i.status === "needed")
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-2xl border border-[#e5e5df] bg-white hover:bg-[#fafaf7] transition-all space-y-2 flex flex-col justify-between group shadow-2xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  toggleShoppingItemStatus(plan.id, item.id, currentName);
                                  const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                                  setCollabState(updated);
                                  publishSharedTripUpdate(plan, updated);
                                }}
                                className="flex items-center space-x-2.5 text-left min-w-0 flex-1 cursor-pointer"
                              >
                                <div className="w-5 h-5 rounded-full border-2 border-[#d1d1ca] group-hover:border-[#5A5A40] flex items-center justify-center shrink-0 transition-colors">
                                  <Check className="w-3.5 h-3.5 text-white group-hover:text-[#5A5A40] transition-colors" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-[#2c2c24] flex items-center gap-1.5 truncate">
                                    <span>{item.emoji || "🛒"}</span>
                                    <span><TranslatedText text={item.name} /></span>
                                  </p>
                                  {item.quantity && (
                                    <span className="inline-block text-[10px] text-[#5A5A40] bg-[#f5f5f0] px-2 py-0.5 rounded-full font-mono mt-0.5">
                                      <TranslatedText text={item.quantity} />
                                    </span>
                                  )}
                                </div>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  deleteShoppingItem(plan.id, item.id);
                                  const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                                  setCollabState(updated);
                                  publishSharedTripUpdate(plan, updated);
                                }}
                                className="p-1 text-[#8a8a7e] hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors shrink-0"
                                title="Delete item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Assignee Footer */}
                            <div className="flex items-center justify-between text-[10px] pt-1 border-t border-[#ecece5]">
                              <span className="text-[#8a8a7e]">
                                <TranslatedText text="Added by" /> {item.addedBy}
                              </span>
                              <select
                                value={item.assignedTo || ""}
                                onChange={(e) => {
                                  assignShoppingItem(plan.id, item.id, e.target.value || undefined);
                                  const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                                  setCollabState(updated);
                                  publishSharedTripUpdate(plan, updated);
                                }}
                                className="px-2 py-0.5 rounded-lg border border-[#d1d1ca] bg-[#f5f5f0] text-[#2c2c24] font-medium"
                              >
                                <option value="">Who buys?</option>
                                {collabState.members.map((m) => (
                                  <option key={m} value={m}>
                                    👤 {m}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Section 2: In Cart / Bought Items */}
                {(collabState.shoppingList || []).some((i) => i.status === "bought") && (
                  <div className="bg-[#fafaf7] p-5 sm:p-6 rounded-3xl border border-[#e5e5df] space-y-4">
                    <div className="flex items-center justify-between border-b border-[#e5e5df] pb-3">
                      <h4 className="font-serif font-bold text-sm text-emerald-800 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span><TranslatedText text="In Cart / Bought" /> ({ (collabState.shoppingList || []).filter((i) => i.status === "bought").length })</span>
                      </h4>

                      <button
                        type="button"
                        onClick={() => {
                          clearBoughtShoppingItems(plan.id);
                          const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                          setCollabState(updated);
                          publishSharedTripUpdate(plan, updated);
                        }}
                        className="text-xs text-[#8a8a7e] hover:text-rose-600 underline font-semibold"
                      >
                        <TranslatedText text="Clear Bought Items" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {(collabState.shoppingList || [])
                        .filter((i) => i.status === "bought")
                        .map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between text-xs text-emerald-950 opacity-80"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                toggleShoppingItemStatus(plan.id, item.id, currentName);
                                const updated = getCollaborationState(plan.id, plan.destinationOrTown, plan.totalDays, plan.tags);
                                setCollabState(updated);
                                publishSharedTripUpdate(plan, updated);
                              }}
                              className="flex items-center space-x-2 text-left min-w-0 flex-1 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="line-through font-medium truncate">{item.emoji || "🛒"} <TranslatedText text={item.name} /></span>
                            </button>

                            {item.assignedTo && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold shrink-0">
                                {item.assignedTo}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: TRICOUNT EXPENSES */}
          {activeTab === "expenses" && (
            <div className="space-y-6">
              {/* SUB-TAB NAV BAR */}
              <div className="bg-white p-1 rounded-2xl border border-[#e5e5df] w-full grid grid-cols-3 gap-1 shadow-2xs mb-4">
                <button
                  type="button"
                  onClick={() => setExpensesSubTab("list")}
                  className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap px-1 sm:px-3 ${
                    expensesSubTab === "list"
                      ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                      : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>
                    <span className="hidden xs:inline">{t("budget.tab.list", "Expense Ledger")} ({collabState.expenses.length})</span>
                    <span className="xs:hidden">Ledger ({collabState.expenses.length})</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpensesSubTab("summary")}
                  className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap px-1 sm:px-3 ${
                    expensesSubTab === "summary"
                      ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                      : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>
                    <span className="hidden xs:inline">{t("budget.tab.summary", "Cost & Budget Summary")}</span>
                    <span className="xs:hidden">Summary</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setExpensesSubTab("balances")}
                  className={`flex items-center justify-center space-x-1 sm:space-x-1.5 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-semibold tracking-tight transition-all cursor-pointer whitespace-nowrap px-1 sm:px-3 ${
                    expensesSubTab === "balances"
                      ? "bg-[#5A5A40] text-white shadow-xs font-bold"
                      : "text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0]"
                  }`}
                >
                  <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>
                    <span className="hidden xs:inline">{t("budget.tab.balances", "Balances & Settle")}</span>
                    <span className="xs:hidden">Balances</span>
                  </span>
                </button>
              </div>

              {/* SUB-TAB 1: COST & BUDGET SUMMARY VIEW */}
              {expensesSubTab === "summary" && (
                <CostExpenseSummary
                  plan={plan}
                  collabState={collabState}
                  currentName={currentName}
                  onRefreshCollabState={handleRefreshCollabState}
                  onShowToast={onShowToast}
                  onNavigateToTab={(subTab) => setExpensesSubTab(subTab)}
                  onOpenAddExpenseWithPreFill={openAddExpenseWithPreFill}
                />
              )}
              {/* PAGE 2: RESUME, BALANCES & ANALYTICS VIEW */}
              {expensesSubTab === "balances" && (
                <div className="space-y-6 animate-in fade-in-10">
                  {/* Overview & Minimal Debt Settlement Box */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Total Spend & Member Spend */}
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-2.5">
                      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#f5f5f0] border border-[#e5e5df] space-y-1">
                        <span className="text-xs text-[#8a8a7e] font-serif italic"><TranslatedText text="Total Group Spend" /></span>
                        <div className="text-xl sm:text-2xl font-serif font-bold italic text-[#2c2c24]">
                          {plan.currency || "€"}{totalGroupSpend.toFixed(2)}
                        </div>
                        <span className="text-[11px] text-[#6b6b5e] block truncate">
                          <TranslatedText text="Across" /> {collabState.expenses.length} <TranslatedText text={collabState.expenses.length !== 1 ? "items" : "item"} />
                        </span>
                      </div>

                      <div className="p-3.5 sm:p-4 rounded-2xl bg-[#5A5A40]/10 border border-[#5A5A40]/20 space-y-1">
                        <span className="text-xs text-[#5A5A40] font-serif italic font-semibold block truncate">
                          <TranslatedText text="My Spend" /> ({currentName})
                        </span>
                        <div className="text-xl sm:text-2xl font-serif font-bold italic text-[#2c2c24]">
                          {plan.currency || "€"}{myTotalSpend.toFixed(2)}
                        </div>
                        <span className="text-[11px] text-[#6b6b5e] block truncate">
                          <TranslatedText text="Paid by you" /> ({collabState.expenses.filter((e) => e.paidBy === currentName).length} <TranslatedText text={collabState.expenses.filter((e) => e.paidBy === currentName).length !== 1 ? "items" : "item"} />)
                        </span>
                      </div>
                    </div>

                    {/* Tricount Balance per Member */}
                    <div className="md:col-span-2 p-4 rounded-2xl bg-white border border-[#e5e5df] space-y-3 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-[#f5f5f0] text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-serif italic font-bold text-[#2c2c24]">
                            ⚖️ <TranslatedText text="Net Balances & Analytics" />:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowNetBalances(!showNetBalances)}
                            className="text-[10px] bg-[#f5f5f0] border border-[#d1d1ca] hover:bg-[#ecece4] px-2 py-0.5 rounded-lg font-sans font-medium text-[#5A5A40] transition-colors cursor-pointer"
                          >
                            {showNetBalances ? <TranslatedText text="Hide Balances" /> : <TranslatedText text="Show Balances" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowAnalytics(!showAnalytics)}
                            className="text-[10px] bg-[#f5f5f0] border border-[#d1d1ca] hover:bg-[#ecece4] px-2 py-0.5 rounded-lg font-sans font-medium text-[#5A5A40] transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <span>📊 {showAnalytics ? <TranslatedText text="Hide Analytics" /> : <TranslatedText text="Show Analytics" />}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleExportLedgerReport}
                          className="text-[10px] bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-2 py-0.5 rounded-lg font-sans font-semibold text-emerald-800 transition-colors flex items-center space-x-1 cursor-pointer self-start sm:self-auto"
                          title="Export Shared Ledger Report & Download CSV"
                        >
                          <span>📋 <TranslatedText text="Export Ledger Report" /></span>
                        </button>
                      </div>

                      {showNetBalances ? (
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
                      ) : (
                        <div className="text-center py-5 text-xs text-[#8a8a7e] italic bg-[#f5f5f0]/40 rounded-xl border border-dashed border-[#d1d1ca]">
                          <TranslatedText text="Member balances are currently hidden. Click 'Show Balances' to reveal." />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Category Breakdown Donut Chart */}
                  {showAnalytics && (
                    <div className="p-4 rounded-2xl bg-white border border-[#e5e5df] space-y-3.5 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-[#f5f5f0] pb-1.5">
                        <h5 className="font-serif italic font-bold text-xs text-[#2c2c24] flex items-center space-x-1.5">
                          <span>📊 <TranslatedText text="Group Spending Category Breakdown" />:</span>
                        </h5>
                        <span className="text-[10px] font-mono text-[#8a8a7e]">{getCategoryData().length} <TranslatedText text="Active Categories" /></span>
                      </div>
                      {collabState.expenses.length === 0 ? (
                        <div className="text-center py-6 text-xs text-[#8a8a7e] italic">
                          <TranslatedText text="No expenses logged yet. Add your first shared cost to activate analytics!" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
                          {/* Pie Chart container */}
                          <div className="h-44 w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <RePie
                                  data={getCategoryData()}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={45}
                                  outerRadius={65}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {getCategoryData().map((entry, index) => (
                                    <ReCell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category] || "#64748b"} />
                                  ))}
                                </RePie>
                                <ReTooltip
                                  formatter={(value: number) => [`${plan.currency || "€"}${value.toFixed(2)}`, "Spent"]}
                                  contentStyle={{ backgroundColor: "#f5f5f0", borderRadius: "12px", border: "1px solid #d1d1ca", fontSize: "11px" }}
                                />
                              </RePieChart>
                            </ResponsiveContainer>
                          </div>
                          {/* List of categories with values and percentages */}
                          <div className="space-y-1.5 text-xs max-h-44 overflow-y-auto pr-1">
                            {getCategoryData().map((item) => {
                              const pct = ((item.value / totalGroupSpend) * 100).toFixed(1);
                              return (
                                <div key={item.category} className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#fafaf7] transition-colors">
                                  <div className="flex items-center space-x-2">
                                    <span
                                      className="w-2.5 h-2.5 rounded-full shrink-0"
                                      style={{ backgroundColor: CATEGORY_COLORS[item.category] || "#64748b" }}
                                    ></span>
                                    <span className="font-medium text-[#2c2c24]">
                                      <TranslatedText text={CATEGORY_ICONS[item.category as ExpenseCategory] || item.name} />
                                    </span>
                                  </div>
                                  <span className="font-mono text-[#6b6b5e] bg-[#f5f5f0] px-2 py-0.5 rounded-lg border border-[#e5e5df]/60 shrink-0 text-[11px]">
                                    {plan.currency || "€"}{item.value.toFixed(2)} ({pct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Debt Transfer Plan */}
                  {settlements.length > 0 && (
                    <div className="bg-amber-50/60 border border-amber-200 p-4 rounded-2xl space-y-2">
                      <h5 className="font-serif italic font-bold text-xs text-amber-950 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                        <span><TranslatedText text="Optimal Settlement Transfer Plan (Who Pays Whom)" />:</span>
                      </h5>
                      <div className="space-y-1.5">
                        {settlements.map((s, idx) => (
                          <div
                            key={idx}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs bg-white p-3 rounded-xl border border-amber-200/80"
                          >
                            <div className="flex items-center justify-between sm:justify-start gap-4">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-[#2c2c24]">{s.from}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                                <span className="font-bold text-[#2c2c24]">{s.to}</span>
                              </div>
                              <span className="font-serif italic font-bold text-sm text-emerald-800">
                                {plan.currency || "€"}{s.amount.toFixed(2)}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRecordSettlement(s.from, s.to, s.amount)}
                              className="px-2.5 py-1 bg-[#5A5A40] text-white hover:bg-[#4a4a35] font-serif italic text-[11px] rounded-lg shadow-2xs transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span><TranslatedText text="Mark as Paid" /></span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PAGE 1: EXPENSES LIST VIEW */}
              {expensesSubTab === "list" && (
                <div className="space-y-6">
                  {/* Expense Action Toolbar & Search */}
                  <div className="flex flex-wrap items-center gap-2 bg-[#fafaf7] p-3 rounded-2xl border border-[#e5e5df]">
                    <div className="relative flex-1 min-w-[140px]">
                      <Search className="w-3.5 h-3.5 text-[#8a8a7e] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search descriptions..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white focus:outline-none focus:border-[#5A5A40]"
                      />
                    </div>

                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none cursor-pointer"
                    >
                      <option value="all">Category: All</option>
                      <option value="food">🥘 Food & Dining</option>
                      <option value="transport">🚕 Transport</option>
                      <option value="accommodation">🏨 Accommodation</option>
                      <option value="activities">🎟️ Activities</option>
                      <option value="shopping">🛍️ Shopping</option>
                      <option value="general">📦 General</option>
                    </select>

                    <select
                      value={filterPaidBy}
                      onChange={(e) => setFilterPaidBy(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none cursor-pointer"
                    >
                      <option value="all">Payer: All</option>
                      {collabState.members.map((m) => (
                        <option key={m} value={m}>
                          Paid By: {m}
                        </option>
                      ))}
                    </select>

                    <select
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none cursor-pointer"
                    >
                      <option value="all">Date: All Dates</option>
                      {uniqueExpenseDates.map((d) => {
                        let formattedDate = d;
                        try {
                          formattedDate = new Date(d).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        } catch {}
                        return (
                          <option key={d} value={d}>
                            {formattedDate}
                          </option>
                        );
                      })}
                    </select>

                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="px-2 py-1.5 text-xs border border-[#d1d1ca] rounded-xl bg-white text-[#2c2c24] focus:outline-none cursor-pointer"
                    >
                      <option value="date_desc">Newest First</option>
                      <option value="date_asc">Oldest First</option>
                      <option value="amount_desc">Amount: High to Low</option>
                      <option value="amount_asc">Amount: Low to High</option>
                    </select>

                    <button
                      type="button"
                      onClick={openNewExpenseForm}
                      className="flex items-center justify-center px-3.5 py-1.5 bg-[#5A5A40] text-white rounded-xl text-xs font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs shrink-0 cursor-pointer ml-auto"
                      title="Add New Expense"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span>+ <TranslatedText text="Add Expense" /></span>
                    </button>
                  </div>

              {/* Add / Edit Expense Drawer Form */}
              {isExpenseFormOpen && (() => {
                const previewPayments = getLivePreviewPayments();
                return (
                  <form
                    onSubmit={handleSaveExpense}
                    className="bg-[#f5f5f0] border border-[#d1d1ca] p-4 sm:p-5 rounded-2xl space-y-4 animate-in fade-in-10"
                  >
                    <div className="flex items-center justify-between border-b border-[#e5e5df] pb-2">
                      <h5 className="font-serif italic font-bold text-sm text-[#2c2c24]">
                        {editingExpenseId ? <TranslatedText text="Edit Expense Entry" /> : <TranslatedText text="Log New Shared Group Expense" />}
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
                          <TranslatedText text="Expense Description / Vendor" />:
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[#6b6b5e] font-serif italic">
                            <TranslatedText text="Total Amount" /> ({plan.currency || "€"}):
                          </label>
                          <button
                            type="button"
                            onClick={() => setConverterOpen(!converterOpen)}
                            className="text-[10px] text-amber-800 hover:text-amber-950 hover:underline font-semibold flex items-center space-x-1 cursor-pointer bg-transparent border-0 p-0"
                          >
                            <span>💱 <TranslatedText text="Foreign Currency" /></span>
                          </button>
                        </div>
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
                        <label className="block text-[#6b6b5e] mb-1 font-serif italic"><TranslatedText text="Category" />:</label>
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
                        <label className="block text-[#6b6b5e] mb-1 font-serif italic"><TranslatedText text="Paid By" />:</label>
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

                    {/* Collapsible Currency Converter helper */}
                    {converterOpen && (
                      <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-150 text-xs">
                        <div className="flex items-center justify-between font-serif italic font-bold text-amber-950">
                          <span>💱 <TranslatedText text="Multi-Currency Calculator" />:</span>
                          <button
                            type="button"
                            onClick={() => setConverterOpen(false)}
                            className="text-amber-800 hover:text-amber-950 text-[10px] font-sans font-bold cursor-pointer"
                          >
                            <TranslatedText text="Hide Converter" />
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] text-[#6b6b5e] mb-0.5"><TranslatedText text="Currency" />:</label>
                            <select
                              value={converterCurrency}
                              onChange={(e) => {
                                const cur = e.target.value;
                                setConverterCurrency(cur);
                                const preset = CURRENCY_CONVERSION_RATES[cur];
                                if (preset) {
                                  setConverterRate(preset.rateToBase.toString());
                                  const amtVal = parseFloat(converterAmount) || 0;
                                  if (amtVal > 0) {
                                    setExpAmount((amtVal * preset.rateToBase).toFixed(2));
                                  }
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#d1d1ca] rounded-lg bg-white"
                            >
                              {Object.keys(CURRENCY_CONVERSION_RATES).map((c) => (
                                <option key={c} value={c}>
                                  {c} ({CURRENCY_CONVERSION_RATES[c].symbol})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#6b6b5e] mb-0.5"><TranslatedText text="Amount" />:</label>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="0.00"
                              value={converterAmount}
                              onChange={(e) => {
                                const amt = e.target.value;
                                setConverterAmount(amt);
                                const rateVal = parseFloat(converterRate) || 0;
                                const amtVal = parseFloat(amt) || 0;
                                if (amtVal > 0 && rateVal > 0) {
                                  setExpAmount((amtVal * rateVal).toFixed(2));
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#d1d1ca] rounded-lg bg-white font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-[#6b6b5e] mb-0.5"><TranslatedText text="Rate" /> ({plan.currency || "€"}):</label>
                            <input
                              type="number"
                              step="0.00001"
                              value={converterRate}
                              onChange={(e) => {
                                const rate = e.target.value;
                                setConverterRate(rate);
                                const rateVal = parseFloat(rate) || 0;
                                const amtVal = parseFloat(converterAmount) || 0;
                                if (amtVal > 0 && rateVal > 0) {
                                  setExpAmount((amtVal * rateVal).toFixed(2));
                                }
                              }}
                              className="w-full px-2 py-1 text-xs border border-[#d1d1ca] rounded-lg bg-white font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#6b6b5e] pt-1 border-t border-amber-200/40">
                          <span>
                            <TranslatedText text="Calculation" />: <strong className="font-mono text-[#2c2c24]">{CURRENCY_CONVERSION_RATES[converterCurrency]?.symbol || ""}{parseFloat(converterAmount) || 0}</strong> × <strong className="font-mono text-[#2c2c24]">{parseFloat(converterRate) || 0}</strong>
                          </span>
                          <span>
                            ➔ <TranslatedText text="Total" />: <strong className="font-mono text-emerald-800 text-[11px] font-bold">{plan.currency || "€"}{((parseFloat(converterAmount) || 0) * (parseFloat(converterRate) || 0)).toFixed(2)}</strong>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Splitting Mode Selector */}
                    <div className="space-y-3.5 border-t border-[#e5e5df] pt-4 text-xs">
                      <div>
                        <span className="font-serif italic font-bold text-sm text-[#2c2c24] block">
                          <TranslatedText text="How should this be split?" />
                        </span>
                        <p className="text-[10px] text-[#8a8a7e] mt-0.5 font-sans">
                          <TranslatedText text="Choose how to divide costs among the participating members:" />
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                        {[
                          {
                            mode: "equal",
                            title: "Equally",
                            emoji: "⚖️",
                            desc: "Split evenly",
                          },
                          {
                            mode: "exact",
                            title: "Exact",
                            emoji: "🪙",
                            desc: "Custom amounts",
                          },
                          {
                            mode: "shares",
                            title: "Slices",
                            emoji: "🍕",
                            desc: "By slices/shares",
                          },
                        ].map((m) => {
                          const isSelected = expSplitMode === m.mode;
                          return (
                            <button
                              key={m.mode}
                              type="button"
                              onClick={() => setExpSplitMode(m.mode as SplitMode)}
                              className={`relative p-2.5 sm:p-3 rounded-2xl border text-center flex flex-col items-center justify-center transition-all duration-200 cursor-pointer overflow-hidden ${
                                isSelected
                                  ? "bg-white border-[#5A5A40] text-[#2c2c24] shadow-md ring-1 ring-[#5A5A40] scale-[1.02]"
                                  : "bg-[#fcfcf9] border-[#e5e5df] text-[#6b6b5e] hover:bg-white hover:border-[#8a8a7e] hover:text-[#2c2c24] shadow-2xs"
                              }`}
                            >
                              {/* Selected indicator pin */}
                              {isSelected && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#5A5A40]" />
                              )}
                              <span className={`text-lg sm:text-xl mb-1 transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>{m.emoji}</span>
                              <span className={`font-serif italic font-extrabold text-[11px] sm:text-[12px] transition-colors leading-none ${isSelected ? 'text-[#2c2c24]' : 'text-[#6b6b5e]'}`}>
                                <TranslatedText text={m.title} />
                              </span>
                              <span
                                className={`text-[9px] mt-1 font-sans leading-tight transition-colors ${
                                  isSelected ? "text-[#5A5A40] font-medium" : "text-[#8a8a7e]"
                                }`}
                              >
                                <TranslatedText text={m.desc} />
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Preview Summary Status Bar */}
                      <div className="p-3 bg-[#fafaf7] rounded-xl border border-[#ecece5] space-y-2 text-xs">
                        <div className="flex items-center justify-between font-serif italic font-semibold text-[#2c2c24]">
                          <span>📈 <TranslatedText text="Live Cost Allocation Preview" />:</span>
                          <span className="text-[#5A5A40] font-sans font-bold">
                            {plan.currency || "€"}{(parseFloat(expAmount) || 0).toFixed(2)}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-[#6b6b5e]">
                          <div>
                            <span><TranslatedText text="Split Type" />: </span>
                            <span className="font-semibold text-[#2c2c24] capitalize"><TranslatedText text={expSplitMode} /></span>
                          </div>
                          <div className="text-right">
                            <span><TranslatedText text="Paying Members" />: </span>
                            <span className="font-semibold text-[#2c2c24]">{expSplitBetween.length} / {collabState.members.length}</span>
                          </div>
                        </div>

                        {/* Warnings and Resets for Exact mode */}
                        {expSplitMode === "exact" && (
                          <div className="pt-1.5 border-t border-[#ecece5] flex flex-col gap-1.5">
                            {(() => {
                              const totalAmt = parseFloat(expAmount) || 0;
                              const manualSum = Object.keys(expAllocations)
                                .filter((m) => expSplitBetween.includes(m))
                                .reduce((sum, m) => sum + (expAllocations[m] || 0), 0);
                              const mismatch = manualSum - totalAmt;

                              if (totalAmt > 0 && Math.abs(mismatch) > 0.01) {
                                if (manualSum > totalAmt) {
                                  return (
                                    <div className="p-2.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-[11px] flex items-center justify-between gap-2 animate-in fade-in-5 duration-150">
                                      <span className="font-sans leading-relaxed">
                                        ⚠️ <TranslatedText text="Custom inputs" /> (<strong>{plan.currency || "€"}{manualSum.toFixed(2)}</strong>) <TranslatedText text="exceed the total by" /> <strong>{plan.currency || "€"}{mismatch.toFixed(2)}</strong>.
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpAllocations({})}
                                        className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[10px] hover:bg-rose-700 transition-colors font-semibold font-sans whitespace-nowrap"
                                      >
                                        <TranslatedText text="Reset All" />
                                      </button>
                                    </div>
                                  );
                                } else {
                                  return (
                                    <div className="p-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-[11px] flex items-center justify-between gap-2">
                                      <span className="font-sans leading-relaxed">
                                        💡 <TranslatedText text="Slices allocation: unfilled members will split the remaining" /> <strong>{plan.currency || "€"}{(totalAmt - manualSum).toFixed(2)}</strong> <TranslatedText text="evenly." />
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setExpAllocations({})}
                                        className="px-2.5 py-1 bg-amber-600 text-white rounded-lg text-[10px] hover:bg-amber-700 transition-colors font-semibold font-sans whitespace-nowrap"
                                      >
                                        <TranslatedText text="Reset All" />
                                      </button>
                                    </div>
                                  );
                                }
                              } else if (totalAmt > 0 && Math.abs(mismatch) <= 0.01 && expSplitBetween.some(m => expAllocations[m] === undefined)) {
                                return (
                                  <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px]">
                                    <span className="font-sans">
                                      ✨ <TranslatedText text="Balanced! Exactly 100% of the total has been custom-allocated." />
                                    </span>
                                  </div>
                                );
                              }
                              return (
                                <div className="text-[10px] text-[#8a8a7e] font-sans">
                                  {Object.keys(expAllocations).length > 0 ? (
                                    <span>
                                      <TranslatedText text="Custom allocations" />: {plan.currency || "€"}{manualSum.toFixed(2)} | <TranslatedText text="Auto-allocated remainder" />: {plan.currency || "€"}{Math.max(0, totalAmt - manualSum).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span><TranslatedText text="Enter custom amounts below. Empty fields are split automatically." /></span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Member checklist / allocations */}
                      <div className="bg-white p-3 rounded-xl border border-[#d1d1ca] divide-y divide-[#e5e5df]">
                        {collabState.members.map((member) => {
                          const isIncluded = expSplitBetween.includes(member);

                          return (
                            <div
                              key={member}
                              className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
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

                              {/* Exact amount input & dynamic preview */}
                              {expSplitMode === "exact" && isIncluded && (
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-sans font-medium uppercase tracking-wider ${
                                    expAllocations[member] !== undefined && expAllocations[member] !== null
                                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                                      : "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                  }`}>
                                    {expAllocations[member] !== undefined && expAllocations[member] !== null
                                      ? <TranslatedText text="Custom" />
                                      : <TranslatedText text="Auto" />}
                                  </span>
                                  <div className="flex items-center space-x-1">
                                    <span className="text-[#8a8a7e]">{plan.currency || "€"}</span>
                                    <input
                                      type="number"
                                      step="0.01"
                                      placeholder={previewPayments[member]?.amount ? previewPayments[member].amount.toFixed(2) : "0.00"}
                                      value={expAllocations[member] || ""}
                                      onChange={(e) => {
                                        const inputStr = e.target.value;
                                        if (inputStr === "") {
                                          const next = { ...expAllocations };
                                          delete next[member];
                                          setExpAllocations(next);
                                        } else {
                                          const val = parseFloat(inputStr) || 0;
                                          setExpAllocations({ ...expAllocations, [member]: val });
                                        }
                                      }}
                                      className="w-20 px-2 py-0.5 border border-[#d1d1ca] rounded-lg font-mono text-xs text-right focus:outline-none focus:border-[#5A5A40]"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Shares input & preview */}
                              {expSplitMode === "shares" && isIncluded && (
                                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-1.5 py-0.5 rounded-md font-mono font-semibold">
                                    {plan.currency || "€"}{previewPayments[member]?.amount ? previewPayments[member].amount.toFixed(2) : "0.00"}
                                  </span>
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
                                      className="w-16 px-2 py-0.5 border border-[#d1d1ca] rounded-lg font-mono text-xs text-right focus:outline-none focus:border-[#5A5A40]"
                                    />
                                    <span className="text-[#8a8a7e] text-[11px] font-serif italic"><TranslatedText text="slices" /></span>
                                  </div>
                                </div>
                              )}

                              {/* Equal mode preview */}
                              {expSplitMode === "equal" && isIncluded && (
                                <span className="text-[11px] font-mono text-[#5A5A40] shrink-0">
                                  {plan.currency || "€"}
                                  {(previewPayments[member]?.amount || 0).toFixed(2)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dedicated Collapsed/Open Payment Breakdown Preview */}
                    <div className="bg-[#fafaf7] p-3 rounded-2xl border border-[#e5e5df] space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-serif italic font-bold text-xs text-[#2c2c24] flex items-center gap-1.5">
                          🔍 <TranslatedText text="Final Payment Breakdown Preview" />:
                        </span>
                        <span className="text-[10px] text-[#6b6b5e] font-sans">
                          {expSplitBetween.length} <TranslatedText text="Participating" /> <TranslatedText text={expSplitBetween.length !== 1 ? 'members' : 'member'} />
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                        {collabState.members.map((member) => {
                          const payment = previewPayments[member]?.amount || 0;
                          const isIncluded = expSplitBetween.includes(member);
                          return (
                            <div 
                              key={member}
                              className={`p-2.5 rounded-xl border transition-all duration-150 ${
                                isIncluded 
                                  ? "bg-white border-[#d1d1ca] shadow-2xs" 
                                  : "bg-[#f5f5f0]/50 border-transparent opacity-50"
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 mb-1 min-w-0">
                                <span className={`w-2 h-2 rounded-full ${getAvatarColor(member)} shrink-0`}></span>
                                <span className="font-sans font-bold text-[10px] text-[#2c2c24] truncate">{member}</span>
                              </div>
                              <div className="font-serif italic font-extrabold text-[#2c2c24] text-[13px]">
                                {isIncluded ? `${plan.currency || "€"}${payment.toFixed(2)}` : "—"}
                              </div>
                              {isIncluded && (
                                <div className="text-[9px] text-[#8a8a7e] font-sans">
                                  {expSplitMode === "equal" && <TranslatedText text="Equal Share" />}
                                  {expSplitMode === "exact" && (previewPayments[member]?.isManual ? <TranslatedText text="Custom Input" /> : <TranslatedText text="Auto Share" />)}
                                  {expSplitMode === "shares" && <><TranslatedText text="Slice" />: {expAllocations[member] ?? 1}</>}
                                </div>
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
                        <TranslatedText text="Cancel" />
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-[#5A5A40] text-white rounded-xl font-serif italic hover:bg-[#4a4a35] transition-colors shadow-xs"
                      >
                        {editingExpenseId ? <TranslatedText text="Save Changes" /> : <TranslatedText text="Save Expense" />}
                      </button>
                    </div>
                  </form>
                );
              })()}

              {/* Expenses List */}
              <div className="space-y-3">
                {filteredExpenses.length === 0 ? (
                  <div className="text-center py-10 bg-[#f5f5f0]/60 rounded-3xl border border-dashed border-[#d1d1ca] text-xs text-[#8a8a7e]">
                    <TranslatedText text="No expenses found matching the current filters. Click '+ Add New Expense' to log one!" />
                  </div>
                ) : (
                  filteredExpenses.map((exp) => {
                    // Category-specific high contrast editorial classes
                    let categoryColor = "bg-slate-50 text-slate-800 border-slate-200/80";
                    if (exp.category === "food") categoryColor = "bg-emerald-50 text-emerald-800 border-emerald-200/60";
                    else if (exp.category === "transport") categoryColor = "bg-amber-50 text-amber-900 border-amber-200/60";
                    else if (exp.category === "accommodation") categoryColor = "bg-indigo-50 text-indigo-800 border-indigo-200/60";
                    else if (exp.category === "activities") categoryColor = "bg-rose-50 text-rose-800 border-rose-200/60";
                    else if (exp.category === "shopping") categoryColor = "bg-purple-50 text-purple-800 border-purple-200/60";

                    return (
                      <div
                        key={exp.id}
                        className="p-4 rounded-2xl bg-white border border-[#e5e5df] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs shadow-2xs hover:border-[#5A5A40] hover:shadow-xs transition-all duration-150"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-serif font-bold italic text-sm text-[#2c2c24]"><TranslatedText text={exp.title} /></span>
                            <span className={`text-[10px] font-sans px-2.5 py-0.5 rounded-full border ${categoryColor} shrink-0`}>
                              <TranslatedText text={CATEGORY_ICONS[exp.category] || "📦 General"} />
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#6b6b5e] font-sans">
                            <span className="bg-[#f5f5f0] px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 flex items-center gap-1">
                              <span>📅 {exp.date}</span>
                              {(() => {
                                const tripDay = getTripDayForDate(exp.date);
                                if (tripDay !== null && tripDay >= 1 && tripDay <= (plan.totalDays || 1)) {
                                  return (
                                    <span className="bg-[#5A5A40] text-white px-1 py-px rounded-sm font-sans text-[8px] font-bold leading-none">
                                      <TranslatedText text="Day" /> {tripDay}
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                            </span>
                            <span className="hidden sm:inline text-[#d1d1ca]">•</span>
                            <span>
                              <TranslatedText text="Paid by" /> <span className="font-semibold text-[#2c2c24]">{exp.paidBy}</span>
                            </span>
                            <span className="text-[#d1d1ca]">•</span>
                            <span>
                              <TranslatedText text="Mode" />: <span className="capitalize font-medium text-[#2c2c24]">
                                {exp.splitMode === "equal" ? <TranslatedText text="Equally" /> : exp.splitMode === "exact" ? <TranslatedText text="Exact" /> : <TranslatedText text="Shares" />}
                              </span>
                            </span>
                          </div>

                          {/* Member participating chips */}
                          <div className="flex flex-wrap items-center gap-1 text-[10px] pt-1">
                            <span className="text-[#8a8a7e] mr-1"><TranslatedText text="Participants" /> ({exp.splitBetween.length}):</span>
                            {exp.splitBetween.map((member) => (
                              <span
                                key={member}
                                className="px-2 py-0.5 rounded-md bg-[#f5f5f0] border border-[#e5e5df] text-[#2c2c24] font-medium scale-95"
                              >
                                {member}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#f5f5f0]">
                          <div className="text-right">
                            <span className="font-serif italic font-bold text-lg text-[#2c2c24] block">
                              {exp.currency}{exp.amount.toFixed(2)}
                            </span>
                            {exp.splitMode === "equal" && (
                              <span className="text-[10px] text-[#8a8a7e] block">
                                ({exp.currency}{(exp.amount / (exp.splitBetween.length || 1)).toFixed(2)} <TranslatedText text="each" />)
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => openEditExpenseForm(exp)}
                              title="Edit Expense"
                              className="p-2 text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#f5f5f0] rounded-xl transition-colors border border-transparent hover:border-[#ecece4]"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteExpense(exp.id)}
                              title="Delete Expense"
                              className="p-2 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MEMBERS & ACCESS MANAGEMENT */}
          {activeTab === "members" && (
            <div className="space-y-6">
              {/* Feature: Trip Visibility & Public Sharing Toggle (Bridge to Community) */}
              <div className="bg-[#f5f5f0] p-3 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-3 sm:space-y-4">
                <div className="pb-2 sm:pb-3 border-b border-[#e5e5df]">
                  <h4 className="font-serif italic font-bold text-xs sm:text-sm text-[#2c2c24] flex items-center space-x-2">
                    <Globe className="w-4 h-4 text-[#5A5A40]" />
                    <span><TranslatedText text="Itinerary Visibility & Community Publishing" /></span>
                  </h4>
                  <p className="text-xs text-[#6b6b5e] hidden sm:block">
                    <TranslatedText text="Control whether this itinerary is private, passcode-protected, or published publicly to the travel community feed." />
                  </p>
                </div>

                {/* Desktop/Tablet Selector buttons */}
                <div className="hidden sm:grid grid-cols-3 gap-2.5 text-xs">
                  {/* Option 1: Private */}
                  <button
                    type="button"
                    onClick={() => handleSaveVisibility("private")}
                    disabled={isSavingVisibility}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      visibility === "private"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    } ${isSavingVisibility ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Lock className="w-3.5 h-3.5 text-rose-700" />
                      <span>🔒 <TranslatedText text="Private Trip" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Only visible to you and group members with whom you share the direct link." />
                    </p>
                  </button>

                  {/* Option 2: Passcode Protected */}
                  <button
                    type="button"
                    onClick={() => {
                      setTempPasscode(passcode || Math.random().toString(36).substring(2, 8).toUpperCase());
                      setIsEditingPasscode(true);
                      handleSaveVisibility("passcode", passcode || tempPasscode);
                    }}
                    disabled={isSavingVisibility}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      visibility === "passcode"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    } ${isSavingVisibility ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Key className="w-3.5 h-3.5 text-amber-700" />
                      <span>🔑 <TranslatedText text="Passcode Protected" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Anyone can view or join, but they must input the correct passcode first." />
                    </p>
                  </button>

                  {/* Option 3: Public Community */}
                  <button
                    type="button"
                    onClick={() => handleSaveVisibility("public")}
                    disabled={isSavingVisibility}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      visibility === "public"
                        ? "bg-white border-[#5A5A40] ring-1 ring-[#5A5A40] shadow-xs"
                        : "bg-white/60 border-[#d1d1ca] hover:bg-white"
                    } ${isSavingVisibility ? "opacity-55 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center space-x-1.5 font-serif font-bold italic text-[#2c2c24]">
                      <Globe className="w-3.5 h-3.5 text-emerald-700" />
                      <span>🌍 <TranslatedText text="Published to Community" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Published publicly on the Explore feed. Other travelers can rate, review, and clone this itinerary!" />
                    </p>
                  </button>
                </div>

                {/* Smartphone Dropdown (Smartphone only) */}
                <div className="block sm:hidden relative w-full">
                  <label htmlFor="mobile-visibility-select" className="sr-only">
                    <TranslatedText text="Select Itinerary Visibility" />
                  </label>
                  <select
                    id="mobile-visibility-select"
                    value={visibility}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "passcode") {
                        setTempPasscode(passcode || Math.random().toString(36).substring(2, 8).toUpperCase());
                        setIsEditingPasscode(true);
                        handleSaveVisibility("passcode", passcode || tempPasscode);
                      } else {
                        handleSaveVisibility(val as "private" | "passcode" | "public");
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-[#d1d1ca] text-[#2c2c24] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer appearance-none pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235A5A40' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      backgroundSize: "16px",
                    }}
                  >
                    <option value="private">🔒 Private Trip</option>
                    <option value="passcode">🔑 Passcode Protected</option>
                    <option value="public">🌍 Published to Community</option>
                  </select>
                </div>

                {/* Passcode editing sub-row if passcode mode is active */}
                {visibility === "passcode" && (
                  <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-[#d1d1ca] text-xs">
                    <span className="text-[#8a8a7e]"><TranslatedText text="Itinerary Access Passcode" />:</span>
                    {!isEditingPasscode ? (
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-[#2c2c24] bg-[#f5f5f0] px-2 py-0.5 rounded border border-[#e5e5df]">
                          {passcode || "NONE_SET"}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setTempPasscode(passcode);
                            setIsEditingPasscode(true);
                          }}
                          className="text-[#5A5A40] hover:text-[#2c2c24] hover:underline text-[11px] font-serif italic"
                        >
                          <TranslatedText text="Change Passcode" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={tempPasscode}
                          onChange={(e) => setTempPasscode(e.target.value.toUpperCase())}
                          placeholder="ENTER PASSCODE"
                          className="px-2 py-0.5 border border-[#d1d1ca] rounded bg-white text-xs font-mono font-bold focus:outline-none focus:border-[#5A5A40] uppercase w-32"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveVisibility("passcode", tempPasscode)}
                          disabled={isSavingVisibility}
                          className="px-2.5 py-0.5 bg-[#5A5A40] text-white rounded text-[11px] hover:bg-[#4a4a35]"
                        >
                          <TranslatedText text="Save" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingPasscode(false)}
                          className="text-[11px] text-stone-500 hover:underline"
                        >
                          <TranslatedText text="Cancel" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Access Settings & Invite Controls */}
              <div className="bg-[#f5f5f0] p-3 sm:p-5 rounded-2xl border border-[#e5e5df] space-y-3 sm:space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 sm:pb-3 border-b border-[#e5e5df]">
                  <div>
                    <h4 className="font-serif italic font-bold text-xs sm:text-sm text-[#2c2c24] flex items-center space-x-2">
                      <Key className="w-4 h-4 text-[#5A5A40]" />
                      <span><TranslatedText text="Group Access & Collaboration Permissions" /></span>
                    </h4>
                    <p className="text-xs text-[#6b6b5e] hidden sm:block">
                      <TranslatedText text="Control who can view or edit activity votes, luggage items, and shared expenses." />
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
                      <span><TranslatedText text="Export Summary" /></span>
                    </button>
                  </div>
                </div>

                {/* Access Level Radio Group - Desktop */}
                <div className="hidden sm:grid grid-cols-3 gap-2.5 text-xs">
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
                      <span><TranslatedText text="Open Collab" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Anyone with the trip invite link can vote, check luggage, and split costs." />
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
                      <span><TranslatedText text="Invite-Only" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Only registered group members can make edits; guests have view-only access." />
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
                      <span><TranslatedText text="Read-Only" /></span>
                    </div>
                    <p className="text-[11px] text-[#6b6b5e] mt-1">
                      <TranslatedText text="Freeze all group changes. The itinerary and hub are locked for viewing only." />
                    </p>
                  </button>
                </div>

                {/* Smartphone Dropdown (Smartphone only) */}
                <div className="block sm:hidden relative w-full">
                  <label htmlFor="mobile-access-level-select" className="sr-only">
                    <TranslatedText text="Select Collaboration Level" />
                  </label>
                  <select
                    id="mobile-access-level-select"
                    value={collabState.accessSettings?.accessLevel || "open_collab"}
                    onChange={(e) => handleUpdateAccessLevel(e.target.value as "open_collab" | "invite_only" | "view_only")}
                    className="w-full px-3 py-2 bg-white border border-[#d1d1ca] text-[#2c2c24] rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5A5A40] cursor-pointer appearance-none pr-10"
                    style={{
                      backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235A5A40' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'></polyline></svg>")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 12px center",
                      backgroundSize: "16px",
                    }}
                  >
                    <option value="open_collab">🌍 Open Collab</option>
                    <option value="invite_only">👥 Invite-Only</option>
                    <option value="view_only">🔒 Read-Only</option>
                  </select>
                </div>

                {/* Invite Code & Direct Link Row */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-2 rounded-xl border border-[#d1d1ca] flex-1">
                    <span className="text-[#8a8a7e]"><TranslatedText text="Trip Passcode" />:</span>
                    {!isChangingPassword ? (
                      <div className="flex items-center space-x-1.5">
                        <span className="font-mono font-bold text-[#2c2c24]">
                          {collabState.accessSettings?.inviteCode || `TRIP-${plan.id.slice(0, 4).toUpperCase()}`}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyInviteCode}
                          className="text-[#5A5A40] hover:text-[#2c2c24] p-1 shrink-0"
                          title="Copy Passcode"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setGroupPasswordInput(collabState.accessSettings?.inviteCode || `TRIP-${plan.id.slice(0, 4).toUpperCase()}`);
                            setIsChangingPassword(true);
                          }}
                          className="text-[10px] text-[#5A5A40] hover:underline font-serif italic ml-1 shrink-0"
                        >
                          <TranslatedText text="Change" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          value={groupPasswordInput}
                          onChange={(e) => setGroupPasswordInput(e.target.value)}
                          className="px-2 py-0.5 text-xs border border-[#d1d1ca] rounded-lg bg-white w-24 focus:outline-none focus:border-[#5A5A40] uppercase font-mono font-bold"
                          placeholder="NEW_CODE"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleChangePassword(groupPasswordInput)}
                          className="px-2 py-0.5 bg-[#5A5A40] text-white text-[10px] rounded-md hover:bg-[#4a4a35]"
                        >
                          <TranslatedText text="Save" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsChangingPassword(false)}
                          className="text-[10px] text-stone-500 hover:underline"
                        >
                          <TranslatedText text="Cancel" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic text-xs hover:bg-[#4a4a35] transition-colors shadow-2xs"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span><TranslatedText text="Copy Collab Invite Link" /></span>
                  </button>
                </div>
              </div>

              {/* Save & Load Travel Groups (Presets) */}
              <div className="bg-[#f5f5f0] p-3 sm:p-4 rounded-2xl border border-[#e5e5df] space-y-2.5 shadow-2xs">
                <h5 className="font-serif italic font-bold text-xs text-[#2c2c24] flex items-center space-x-1.5">
                  <Save className="w-4 h-4 text-[#5A5A40]" />
                  <span><TranslatedText text="Save & Load Travel Groups (Presets)" />:</span>
                </h5>
                <p className="text-[11px] text-[#6b6b5e] hidden sm:block">
                  <TranslatedText text="Save this active traveler group roster as a template to reuse across your active planner trips." />
                </p>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5 items-stretch sm:items-center text-xs">
                  {/* Save Current Group button & Input */}
                  {!isSavingGroup ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSaveGroupName(`Group - ${collabState.members.length} members`);
                        setIsSavingGroup(true);
                      }}
                      className="flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-[#d1d1ca] rounded-xl bg-white hover:bg-[#ecece4] text-[#2c2c24] font-serif italic shadow-3xs"
                    >
                      <Save className="w-3.5 h-3.5 text-[#5A5A40]" />
                      <span>
                        <span className="hidden xs:inline"><TranslatedText text="Save Active Group Setup" /></span>
                        <span className="xs:hidden"><TranslatedText text="Save Setup" /></span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2 bg-white p-1.5 rounded-xl border border-[#d1d1ca] flex-wrap gap-1">
                      <input
                        type="text"
                        value={saveGroupName}
                        onChange={(e) => setSaveGroupName(e.target.value)}
                        className="px-2.5 py-1 text-xs border border-[#d1d1ca] rounded-lg bg-[#f5f5f0] w-40 sm:w-44 focus:outline-none"
                        placeholder="Group Name (e.g., Kyoto Crew)"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveGroup(saveGroupName)}
                        className="px-2.5 py-1 bg-[#5A5A40] text-white text-[11px] rounded-lg hover:bg-[#4a4a35]"
                      >
                        <TranslatedText text="Save" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSavingGroup(false)}
                        className="text-[11px] text-stone-500 hover:underline px-1"
                      >
                        <TranslatedText text="Cancel" />
                      </button>
                    </div>
                  )}

                  {/* Load Group Selector */}
                  {savedGroups.length > 0 ? (
                    <div className="flex items-center space-x-2 bg-white px-2.5 py-1 rounded-xl border border-[#d1d1ca]">
                      <FolderOpen className="w-3.5 h-3.5 text-[#5A5A40] shrink-0" />
                      <span className="text-[#8a8a7e] hidden sm:inline font-serif italic"><TranslatedText text="Load Preset" />:</span>
                      <select
                        onChange={(e) => {
                          if (e.target.value) handleLoadGroup(e.target.value);
                          e.target.value = ""; // Reset
                        }}
                        className="bg-transparent text-xs text-[#2c2c24] focus:outline-none pr-1 py-1 cursor-pointer font-serif italic font-semibold"
                        defaultValue=""
                      >
                        <option value="" disabled>-- Load Saved Preset --</option>
                        {savedGroups.map((g) => (
                          <option key={g.name} value={g.name}>
                            📁 {g.name} ({g.members.length} members)
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="text-[10px] text-[#8a8a7e] italic flex items-center bg-white/50 px-2.5 py-1.5 rounded-xl border border-dashed border-[#d1d1ca]">
                      (<TranslatedText text="No saved presets yet" />)
                    </span>
                  )}
                </div>

                {/* Saved groups roster chips with delete buttons */}
                {savedGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {savedGroups.map((g) => (
                      <div
                        key={g.name}
                        className="flex items-center space-x-1.5 bg-white px-2.5 py-1 rounded-xl border border-[#e5e5df] text-[10px]"
                      >
                        <span className="font-semibold text-[#2c2c24]">{g.name}</span>
                        <span className="text-[#8a8a7e]">({g.members.length} <TranslatedText text="members" />)</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSavedGroup(g.name)}
                          className="text-rose-600 hover:text-rose-800 font-bold ml-1 hover:bg-rose-50 rounded-full w-4 h-4 flex items-center justify-center text-[11px]"
                          title="Delete Saved Preset"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Traveler Form */}
              <div className="bg-white p-4 rounded-2xl border border-[#d1d1ca] space-y-3 shadow-2xs">
                <h5 className="font-serif italic font-bold text-xs text-[#2c2c24] flex items-center space-x-1.5">
                  <UserPlus className="w-4 h-4 text-[#5A5A40]" />
                  <span><TranslatedText text="Add Traveler to Group" />:</span>
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
                    + <TranslatedText text="Add to Group" />
                  </button>
                </form>
              </div>

              {/* Travelers Roster List */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <span className="font-serif italic font-bold text-[#2c2c24]">
                    <TranslatedText text="Active Travelers Roster" /> ({collabState.members.length} <TranslatedText text="Members" />):
                  </span>
                  <div className="flex items-center space-x-2">
                    {userPerms.isOrganizer ? (
                      <span className="text-[11px] text-amber-900 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 font-semibold">
                        👑 <TranslatedText text="Organizer Mode: You can change roles & link/unlink accounts" />
                      </span>
                    ) : userPerms.isContributor ? (
                      <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✏️ <TranslatedText text="Contributor Mode" />
                      </span>
                    ) : (
                      <span className="text-[11px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200">
                        👁️ <TranslatedText text="Viewer Mode (Claim a member slot to edit)" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Member Direct Assignment Input Drawer */}
                {assigningAccountForMember && (
                  <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-2xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-950 flex items-center space-x-1.5">
                        <Link2 className="w-3.5 h-3.5 text-amber-700" />
                        <span><TranslatedText text="Link Google Account to" /> "{assigningAccountForMember}":</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAssigningAccountForMember(null)}
                        className="text-stone-500 hover:text-stone-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        placeholder="e.g. traveler@gmail.com"
                        value={targetAccountEmailInput}
                        onChange={(e) => setTargetAccountEmailInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 border border-amber-300 rounded-xl bg-white text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!targetAccountEmailInput.trim()) return;
                          const res = await assignMemberAccountEmail(
                            plan.id,
                            assigningAccountForMember,
                            targetAccountEmailInput.trim(),
                            activeEmail || "organizer"
                          );
                          if (res.success && res.updatedCollab) {
                            setCollabState(res.updatedCollab);
                            onShowToast?.(`Linked ${targetAccountEmailInput.trim()} to ${assigningAccountForMember}`, "success");
                            setAssigningAccountForMember(null);
                            setTargetAccountEmailInput("");
                          } else {
                            onShowToast?.(res.message || "Failed to link account", "error");
                          }
                        }}
                        className="px-3 py-1.5 bg-[#5A5A40] text-white rounded-xl font-serif italic text-xs hover:bg-[#4a4a35]"
                      >
                        <TranslatedText text="Save Link" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="border border-[#e5e5df] rounded-2xl divide-y divide-[#e5e5df] bg-white overflow-hidden shadow-2xs">
                  {(collabState.memberProfiles || []).map((profile) => {
                    const isSelf = profile.name === currentName;
                    const isEditingThis = editingMemberOriginalName === profile.name;
                    const isClaimedByMe =
                      activeEmail &&
                      profile.claimedByEmail &&
                      profile.claimedByEmail.toLowerCase() === activeEmail.toLowerCase();
                    const isClaimedByOther =
                      profile.claimedByEmail &&
                      (!activeEmail || profile.claimedByEmail.toLowerCase() !== activeEmail.toLowerCase());

                    const memberPackingCount = collabState.packingList.filter(
                      (p) => p.checkedBy && p.checkedBy.includes(profile.name)
                    ).length;
                    const memberExpensesPaid = collabState.expenses
                      .filter((e) => e.paidBy === profile.name)
                      .reduce((sum, e) => sum + e.amount, 0);

                    const isExpanded = expandedMembers[profile.name] || false;

                    return (
                      <div
                        key={profile.id || profile.name}
                        className={`flex flex-col text-xs transition-colors ${
                          isClaimedByMe ? "bg-emerald-50/40" : isSelf ? "bg-[#fbfbf9]" : "hover:bg-[#fafaf7]"
                        }`}
                      >
                        {/* Member Card Header Row */}
                        <div 
                          onClick={() => toggleExpandMember(profile.name)}
                          className="p-3 sm:p-3.5 flex items-center justify-between gap-3 cursor-pointer sm:cursor-default"
                        >
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div
                              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl sm:rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 shadow-2xs ${getAvatarColor(
                                profile.name
                              )}`}
                            >
                              {profile.name.charAt(0).toUpperCase()}
                            </div>

                            {!isEditingThis ? (
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2 flex-wrap">
                                  <span className="font-bold text-[#2c2c24] text-xs sm:text-sm truncate">
                                    {profile.name}
                                  </span>
                                  {isClaimedByMe && (
                                    <span className="text-[9px] sm:text-[10px] font-sans font-semibold px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      ✓ <TranslatedText text="You" />
                                    </span>
                                  )}

                                  {/* Role Badge or Selector */}
                                  {userPerms.isOrganizer ? (
                                    <span onClick={(e) => e.stopPropagation()} className="inline-block">
                                      <select
                                        value={profile.role}
                                        onChange={async (e) => {
                                          const newRole = e.target.value as MemberRole;
                                          const res = await updateMemberRoleInTrip(
                                            plan.id,
                                            profile.name,
                                            newRole,
                                            activeEmail || "organizer"
                                          );
                                          if (res.success && res.updatedCollab) {
                                            setCollabState(res.updatedCollab);
                                            onShowToast?.(`Updated ${profile.name}'s role to ${newRole}`, "success");
                                          }
                                        }}
                                        className="text-[9px] sm:text-[10px] border border-[#d1d1ca] rounded-lg px-1.5 py-0.5 bg-white font-sans text-[#2c2c24] cursor-pointer"
                                      >
                                        <option value="organizer">👑 Organizer</option>
                                        <option value="editor">✏️ Contributor</option>
                                        <option value="viewer">👁️ Viewer</option>
                                      </select>
                                    </span>
                                  ) : (
                                    <span
                                      className={`text-[9px] sm:text-[10px] font-sans px-1.5 sm:px-2 py-0.2 rounded-full border ${
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
                                  )}
                                </div>
                              </div>
                            ) : (
                              <form
                                onSubmit={(e) => {
                                  e.stopPropagation();
                                  handleSaveEditMember(e);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex flex-wrap items-center gap-2 flex-1"
                              >
                                <input
                                  type="text"
                                  value={editMemberNameInput}
                                  onChange={(e) => setEditMemberNameInput(e.target.value)}
                                  className="px-2 py-0.5 text-xs border border-[#d1d1ca] rounded-lg bg-white text-[#2c2c24] w-28 animate-in fade-in zoom-in-95"
                                  autoFocus
                                />
                                <select
                                  value={editMemberRoleInput}
                                  onChange={(e) =>
                                    setEditMemberRoleInput(e.target.value as MemberRole)
                                  }
                                  className="px-1.5 py-0.5 text-xs border border-[#d1d1ca] rounded-lg bg-white"
                                >
                                  <option value="editor">✏️ Contributor</option>
                                  <option value="organizer">👑 Organizer</option>
                                  <option value="viewer">👁️ Viewer</option>
                                </select>
                                <button
                                  type="submit"
                                  className="px-2 py-0.5 bg-[#5A5A40] text-white rounded-lg text-[10px] font-serif italic"
                                >
                                  <TranslatedText text="Save" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberOriginalName(null)}
                                  className="px-1.5 py-0.5 text-[#6b6b5e] hover:bg-[#ecece4] rounded-lg text-[10px]"
                                >
                                  <TranslatedText text="Cancel" />
                                </button>
                              </form>
                            )}
                          </div>

                          {/* Smartphone-only Expand/Collapse Chevron and summary counts */}
                          <div className="flex items-center space-x-1.5 sm:hidden">
                            <span className="text-[10px] text-[#8a8a7e] font-medium bg-[#f5f5f0] px-1.5 py-0.5 rounded-md">
                              🎒 {memberPackingCount} • 💰 {plan.currency || "€"}{memberExpensesPaid.toFixed(0)}
                            </span>
                            <button
                              type="button"
                              className="p-1 text-[#8a8a7e] hover:text-[#2c2c24] transition-colors"
                              aria-label={isExpanded ? "Collapse member" : "Expand member"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Content - Always on Desktop, Mobile collapsible */}
                        <div className={`px-3 pb-3 sm:px-3.5 sm:pb-3.5 sm:pt-0 sm:border-t-0 flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${isExpanded ? "flex" : "hidden sm:flex"}`}>
                          <div className="flex flex-col sm:hidden space-y-1.5 pt-1.5 border-t border-[#f5f5f0]">
                            {profile.claimedByEmail ? (
                              <span className="text-emerald-800 flex items-center space-x-1 font-mono text-[10px] bg-emerald-50/80 px-1.5 py-0.5 rounded border border-emerald-200 w-fit">
                                <Link2 className="w-3 h-3 text-emerald-600 animate-pulse" />
                                <span>{profile.claimedByEmail}</span>
                              </span>
                            ) : (
                              <span className="text-stone-400 italic text-[10px] flex items-center space-x-1">
                                <span>⚪ <TranslatedText text="Unlinked slot (Available)" /></span>
                              </span>
                            )}
                          </div>

                          <div className="hidden sm:block ml-12">
                            {/* Google Account Linked Badge */}
                            <div className="flex items-center space-x-2 text-[11px] mt-0.5 flex-wrap">
                              {profile.claimedByEmail ? (
                                <span className="text-emerald-800 flex items-center space-x-1 font-mono text-[10px] bg-emerald-50/80 px-1.5 py-0.2 rounded border border-emerald-200">
                                  <Link2 className="w-3 h-3 text-emerald-600" />
                                  <span>{profile.claimedByEmail}</span>
                                </span>
                              ) : (
                                <span className="text-stone-400 italic text-[10px] flex items-center space-x-1">
                                  <span>⚪ <TranslatedText text="Unlinked slot (Available)" /></span>
                                </span>
                              )}
                              <span className="text-[#8a8a7e]">
                                • 🎒 {memberPackingCount} <TranslatedText text="packed" /> • 💰 {plan.currency || "€"}{memberExpensesPaid.toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {/* Action buttons (always visible on desktop, or in collapsible area on mobile) */}
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="flex flex-wrap items-center gap-1.5 justify-end w-full sm:w-auto mt-2 sm:mt-0"
                          >
                            {/* Claim slot button for active user if unlinked */}
                            {!userPerms.isClaimed && !profile.claimedByEmail && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!activeEmail) {
                                    onShowToast?.("Please sign in with Google to claim identity", "info");
                                    return;
                                  }
                                  const res = await claimMemberIdentity(plan.id, profile.name, activeEmail, user?.displayName || undefined);
                                  if (res.success && res.updatedCollab) {
                                    setCollabState(res.updatedCollab);
                                    onShowToast?.(res.message || `Identified as ${profile.name}!`, "success");
                                  } else {
                                    onShowToast?.(res.message || "Failed to claim slot", "error");
                                  }
                                }}
                                className="px-2.5 py-1 rounded-xl bg-[#5A5A40] text-white font-serif italic text-xs hover:bg-[#4a4a35] transition-colors shadow-2xs"
                              >
                                <TranslatedText text="I am" /> {profile.name}
                              </button>
                            )}

                            {/* Organizer: Assign Google Account */}
                            {userPerms.isOrganizer && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssigningAccountForMember(profile.name);
                                  setTargetAccountEmailInput(profile.claimedByEmail || "");
                                }}
                                className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors border border-stone-200 bg-white sm:border-0 sm:bg-transparent"
                                title="Assign/Link Google Account Email"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Organizer: Break Link / Unclaim */}
                            {userPerms.isOrganizer && profile.claimedByEmail && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (window.confirm(`Break link for ${profile.name}? This will unlink ${profile.claimedByEmail} from this slot.`)) {
                                    const res = await unlinkMemberIdentity(plan.id, profile.name, activeEmail || "organizer");
                                    if (res.success && res.updatedCollab) {
                                      setCollabState(res.updatedCollab);
                                      onShowToast?.(`Unlinked ${profile.name}'s Google account`, "info");
                                    }
                                  }
                                }}
                                className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 bg-white sm:border-0 sm:bg-transparent"
                                title="Unlink Google Account (Break Link)"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!isSelf && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSwitchActiveProfile(profile.name);
                                }}
                                className="px-2.5 py-1 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] border border-[#d1d1ca] font-serif italic text-xs transition-colors"
                                title="Switch to act as this traveler"
                              >
                                <TranslatedText text="Act as" /> {profile.name}
                              </button>
                            )}

                            {userPerms.isOrganizer && !isEditingThis && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditMember(profile);
                                }}
                                className="p-1.5 text-[#6b6b5e] hover:text-[#2c2c24] hover:bg-[#ecece4] rounded-lg transition-colors border border-[#d1d1ca] bg-white sm:border-0 sm:bg-transparent"
                                title="Edit Member Name"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {userPerms.isOrganizer && collabState.members.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMember(profile.name);
                                }}
                                className="p-1.5 text-[#8a8a7e] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-[#d1d1ca] bg-white sm:border-0 sm:bg-transparent"
                                title="Remove Member from Group"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
            <TranslatedText text="Group Data Auto-Saved for" /> {plan.destinationOrTown}
          </span>
          {!isInline && (
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-[#5A5A40] text-white font-serif italic hover:bg-[#4a4a35] transition-colors shadow-2xs"
            >
              <TranslatedText text="Done" />
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
