import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plane,
  Train,
  Hotel,
  Ticket,
  Car,
  Shield,
  FileText,
  Plus,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  Copy,
  Check,
  Search,
  ExternalLink,
  Download,
  Share2,
  Trash2,
  Edit2,
  Key,
  Wifi,
  Phone,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Users,
  Paperclip,
} from "lucide-react";
import { TravelBookingPass, BookingCategory, ItineraryPlan } from "../types";
import {
  getTripWalletPasses,
  saveTripWalletPasses,
  saveWalletPass,
  deleteWalletPass,
  importBookingsFromItinerary,
  generateSampleWalletPasses,
  exportWalletToICS,
  exportWalletToJSON,
} from "../utils/travelWallet";
import { getCollaborationState, saveCollaborationState } from "../utils/collaboration";
import { publishSharedTripUpdate } from "../utils/sharedTripService";
import { BookingPassForm } from "./BookingPassForm";
import { TranslatedText } from "./TranslatedText";
import { useLanguage } from "../context/LanguageContext";

interface TravelWalletHubProps {
  plan: ItineraryPlan;
  onShowToast?: (message: string) => void;
  onSwitchTab?: (tab: "itinerary" | "group" | "offline" | "wallet") => void;
}

export const TravelWalletHub: React.FC<TravelWalletHubProps> = ({
  plan,
  onShowToast,
  onSwitchTab,
}) => {
  const { t, formatCurrency } = useLanguage();
  const [passes, setPasses] = useState<TravelBookingPass[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPass, setEditingPass] = useState<TravelBookingPass | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [fullScreenQrPass, setFullScreenQrPass] = useState<TravelBookingPass | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const formContainerRef = useRef<HTMLDivElement | null>(null);

  // Group members from collaboration state for cost assignment
  const groupMembers = useMemo(() => {
    const collab = getCollaborationState(plan.id);
    return Array.isArray(collab.members) ? collab.members : [];
  }, [plan.id]);

  useEffect(() => {
    if (isAddModalOpen && formContainerRef.current) {
      formContainerRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isAddModalOpen, editingPass?.id]);

  // Load passes
  const loadPasses = () => {
    let loaded = getTripWalletPasses(plan.id);
    if ((!loaded || loaded.length === 0) && plan.walletPasses && plan.walletPasses.length > 0) {
      loaded = plan.walletPasses;
      saveTripWalletPasses(plan.id, loaded);
    }
    setPasses(loaded);
  };

  useEffect(() => {
    loadPasses();
    const handleWalletUpdated = (e: any) => {
      if (!e.detail?.tripId || e.detail.tripId === plan.id) {
        loadPasses();
      }
    };
    window.addEventListener("localexplorer_wallet_updated", handleWalletUpdated);
    return () => {
      window.removeEventListener("localexplorer_wallet_updated", handleWalletUpdated);
    };
  }, [plan.id]);

  // Copy code helper
  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    onShowToast?.(`Copied confirmation code: ${code}`);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  // Auto-import from Plan
  const handleAutoImport = () => {
    const updated = importBookingsFromItinerary(plan);
    plan.walletPasses = updated;
    setPasses(updated);
    publishSharedTripUpdate(plan, undefined, undefined, undefined, undefined, updated);
    onShowToast?.(`Imported accommodations and passes from ${plan.destinationOrTown} itinerary!`);
  };

  // Load Sample Passes
  const handleLoadSamples = () => {
    const samples = generateSampleWalletPasses(plan);
    plan.walletPasses = samples;
    setPasses(samples);
    publishSharedTripUpdate(plan, undefined, undefined, undefined, undefined, samples);
    onShowToast?.("Loaded sample boarding pass, hotel voucher & insurance policy!");
  };

  // Delete Pass
  const handleDeletePass = (id: string) => {
    const updated = deleteWalletPass(plan.id, id);
    plan.walletPasses = updated;
    setPasses(updated);
    setConfirmDeleteId(null);
    publishSharedTripUpdate(plan, undefined, undefined, undefined, undefined, updated);
    onShowToast?.("Pass removed from Travel Wallet.");
  };

  // Link / Add to Group Expenses
  const handleSplitInGroup = (pass: TravelBookingPass) => {
    if (!pass.cost || pass.cost <= 0) {
      onShowToast?.("Please add a cost to this pass before splitting.");
      return;
    }

    try {
      const collab = getCollaborationState(plan.id);
      const members = collab.members.length > 0 ? collab.members : ["Organizer", "Traveler"];
      const newExpense = {
        id: `exp-wallet-${pass.id}`,
        title: `[Booking] ${pass.title} (${pass.provider})`,
        amount: pass.cost,
        paidBy: pass.paidBy || collab.currentUser || members[0],
        currency: pass.currency || "EUR",
        category: (pass.category === "flight" || pass.category === "train" || pass.category === "car_rental"
          ? "transport"
          : pass.category === "hotel"
          ? "accommodation"
          : "activities") as any,
        date: pass.startDate || new Date().toISOString().split("T")[0],
        splitMode: "equal" as const,
        splitBetween: members,
        notes: `Auto-linked from Travel Wallet booking #${pass.confirmationCode}`,
        createdAt: Date.now(),
      };

      const updatedExpenses = [newExpense, ...collab.expenses.filter((e) => e.id !== newExpense.id)];
      saveCollaborationState({
        ...collab,
        expenses: updatedExpenses,
      });

      onShowToast?.(`Added €${pass.cost} to Group Hub Expense Split!`);
    } catch (err) {
      console.error(err);
      onShowToast?.("Failed to link expense to group.");
    }
  };

  // Filtered passes
  const filteredPasses = useMemo(() => {
    return passes.filter((p) => {
      const matchesCategory =
        selectedCategory === "all" ||
        (selectedCategory === "transit" && (p.category === "flight" || p.category === "train" || p.category === "transit")) ||
        (selectedCategory === "stays" && p.category === "hotel") ||
        (selectedCategory === "activities" && p.category === "activity") ||
        (selectedCategory === "car" && p.category === "car_rental") ||
        (selectedCategory === "docs" && (p.category === "insurance" || p.category === "document"));

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        p.confirmationCode.toLowerCase().includes(q) ||
        (p.passengerName && p.passengerName.toLowerCase().includes(q)) ||
        (p.origin && p.origin.toLowerCase().includes(q)) ||
        (p.destination && p.destination.toLowerCase().includes(q)) ||
        (p.address && p.address.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [passes, selectedCategory, searchQuery]);

  // Financial statistics
  const stats = useMemo(() => {
    const totalCost = passes.reduce((acc, p) => acc + (p.cost || 0), 0);
    const confirmedCount = passes.filter((p) => p.status === "confirmed").length;
    return {
      total: passes.length,
      confirmed: confirmedCount,
      totalCost,
    };
  }, [passes]);

  return (
    <div className="space-y-6 animate-in fade-in-20 duration-200">
      {/* Top Banner Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e5e5df] shadow-sm relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-[#e5e5df]">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#5A5A40] flex items-center justify-center text-white shadow-sm text-2xl font-serif">
              🎟️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-2xl sm:text-3xl font-normal italic text-[#2c2c24] leading-tight tracking-tight">
                  {t("wallet.title", "Travel Wallet & Bookings Hub")}
                </h2>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
                  {t("wallet.offlineReady", "Offline Ready")}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#6b6b5e] font-sans mt-0.5">
                {t("wallet.subtitle", "Boarding passes, confirmation codes, hotel keycodes & reservation vouchers in one secure hub")}
              </p>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto">
            <button
              onClick={() => {
                setEditingPass(null);
                setIsAddModalOpen(true);
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1 sm:space-x-1.5 px-3 sm:px-4 h-10 rounded-xl bg-[#5A5A40] text-white hover:bg-[#4a4a35] font-serif italic text-[11px] xs:text-xs sm:text-sm transition-all shadow-xs cursor-pointer whitespace-nowrap min-w-0"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="truncate">
                <span className="hidden xs:inline">{t("wallet.addPass", "Add Booking Pass")}</span>
                <span className="xs:hidden">{t("wallet.addPassShort", "Add Pass")}</span>
              </span>
            </button>

            <button
              onClick={handleAutoImport}
              title="Automatically import hotels & tickets from the daily itinerary"
              className="flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3.5 h-10 rounded-xl bg-[#f5f5f0] text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca] font-sans text-xs font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#5A5A40]" />
              <span className="hidden sm:inline">{t("wallet.autoImport", "Auto-Import Itinerary")}</span>
              <span className="sm:hidden">{t("wallet.autoImportShort", "Import")}</span>
            </button>

            <button
              onClick={() => exportWalletToICS(passes, plan.title)}
              disabled={passes.length === 0}
              title="Export all passes to Apple Calendar / Google Calendar (.ics)"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#f5f5f0] text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca] transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Calendar className="w-4 h-4 text-[#5A5A40]" />
            </button>

            <button
              onClick={() => exportWalletToJSON(passes, plan.title)}
              disabled={passes.length === 0}
              title="Download Wallet Backup JSON"
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#f5f5f0] text-[#2c2c24] hover:bg-[#ecece4] border border-[#d1d1ca] transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            >
              <Download className="w-4 h-4 text-[#5A5A40]" />
            </button>
          </div>
        </div>

        {/* Metric Highlights Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#f5f5f0] p-4 rounded-2xl border border-[#e5e5df]">
          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
              {t("wallet.totalPasses", "Total Stored Passes")}
            </span>
            <span className="font-serif italic font-bold text-lg sm:text-xl text-[#2c2c24]">
              {stats.total} {stats.total === 1 ? t("wallet.reservation", "Reservation") : t("wallet.reservations", "Reservations")}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
              {t("wallet.verifiedConfirmed", "Verified & Confirmed")}
            </span>
            <span className="font-serif italic font-bold text-lg sm:text-xl text-emerald-700">
              {stats.confirmed} / {stats.total}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
              {t("wallet.totalValue", "Total Booked Value")}
            </span>
            <span className="font-serif italic font-bold text-lg sm:text-xl text-[#5A5A40]">
              {formatCurrency(stats.totalCost, "€")}
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
              {t("wallet.destination", "Trip Destination")}
            </span>
            <span className="font-serif italic font-bold text-lg sm:text-xl text-[#2c2c24] truncate block">
              <TranslatedText text={plan.destinationOrTown} />
            </span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 bg-white p-3.5 rounded-2xl border border-[#e5e5df] shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#8a8a7e]" />
            <input
              type="text"
              placeholder={t("wallet.searchPlaceholder", "Search reference, airline, hotel...")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-xl text-xs font-sans focus:outline-none focus:border-[#5A5A40]"
            />
          </div>
        </div>

        {/* Category Pills (Equal 6-column grid on mobile, flex on desktop for 100% immediate access) */}
        <div className="grid grid-cols-6 gap-0.5 sm:flex sm:items-center sm:gap-1.5 w-full">
          {[
            { id: "all", label: t("wallet.allPasses", "All Passes"), shortLabel: "All", icon: null, count: passes.length },
            {
              id: "transit",
              label: t("wallet.flightsRail", "Flights & Rail"),
              shortLabel: "Transit",
              icon: <Plane className="w-3.5 h-3.5 shrink-0" />,
              count: passes.filter((p) => p.category === "flight" || p.category === "train" || p.category === "transit").length,
            },
            {
              id: "stays",
              label: t("wallet.hotelsStays", "Hotels & Stays"),
              shortLabel: "Stays",
              icon: <Hotel className="w-3.5 h-3.5 shrink-0" />,
              count: passes.filter((p) => p.category === "hotel").length,
            },
            {
              id: "activities",
              label: t("wallet.ticketsPasses", "Tickets & Passes"),
              shortLabel: "Tickets",
              icon: <Ticket className="w-3.5 h-3.5 shrink-0" />,
              count: passes.filter((p) => p.category === "activity").length,
            },
            {
              id: "car",
              label: t("wallet.carRentals", "Car Rentals"),
              shortLabel: "Cars",
              icon: <Car className="w-3.5 h-3.5 shrink-0" />,
              count: passes.filter((p) => p.category === "car_rental").length,
            },
            {
              id: "docs",
              label: t("wallet.insuranceDocs", "Insurance & Docs"),
              shortLabel: "Docs",
              icon: <Shield className="w-3.5 h-3.5 shrink-0" />,
              count: passes.filter((p) => p.category === "insurance" || p.category === "document").length,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`py-1.5 px-0.5 sm:px-3 rounded-xl text-[10px] sm:text-xs font-serif italic transition-all flex flex-col sm:flex-row items-center justify-center space-y-0.5 sm:space-y-0 sm:space-x-1.5 cursor-pointer w-full min-w-0 text-center ${
                selectedCategory === cat.id
                  ? "bg-[#5A5A40] text-white font-medium shadow-2xs"
                  : "bg-[#f5f5f0] text-[#2c2c24] hover:bg-[#ecece4] border border-[#e5e5df]"
              }`}
            >
              {cat.icon}
              <span className="hidden sm:inline">{cat.label}</span>
              <span className="sm:hidden truncate max-w-full"><TranslatedText text={cat.shortLabel} /></span>
              <span
                className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.2 rounded-full hidden sm:inline-block ${
                  selectedCategory === cat.id ? "bg-white/20 text-white" : "bg-black/5 text-[#6b6b5e]"
                }`}
              >
                {cat.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* EXPANDABLE CREATE / EDIT BOOKING PASS FORM */}
      {isAddModalOpen && (
        <div ref={formContainerRef} className="mb-6 animate-in fade-in slide-in-from-top-4 duration-300">
          <BookingPassForm
            isOpen={isAddModalOpen}
            onClose={() => {
              setIsAddModalOpen(false);
              setEditingPass(null);
            }}
            onSave={(pass) => {
              const updated = saveWalletPass(pass);
              setPasses(updated);
              publishSharedTripUpdate(plan, undefined, undefined, undefined, undefined, updated);
              onShowToast?.(`Saved booking: ${pass.title}`);
              setIsAddModalOpen(false);
              setEditingPass(null);
            }}
            initialPass={editingPass}
            tripPlan={plan}
            groupMembers={groupMembers}
            isInline={true}
          />
        </div>
      )}

      {/* Empty State / Welcome Guide */}
      {filteredPasses.length === 0 && (
        <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#e5e5df] text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-[#5A5A40]/10 text-[#5A5A40] flex items-center justify-center mx-auto text-3xl">
            🎫
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="font-serif text-xl font-bold text-[#2c2c24]">
              {passes.length === 0 ? t("wallet.emptyTitle", "Your Travel Wallet is Empty") : t("wallet.noMatchTitle", "No Bookings Match Your Filter")}
            </h3>
            <p className="text-xs sm:text-sm text-[#6b6b5e] leading-relaxed font-sans">
              {t("wallet.emptyDesc", "Keep your boarding passes, hotel reservations, train tickets, gate numbers and access PINs safe and accessible even with zero internet connectivity.")}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setEditingPass(null);
                setIsAddModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#5A5A40] text-white hover:bg-[#4a4a35] text-xs font-bold font-serif italic flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t("wallet.createFirst", "Create First Booking Pass")}</span>
            </button>

            <button
              onClick={handleLoadSamples}
              className="px-5 py-2.5 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] text-[#2c2c24] text-xs font-semibold border border-[#d1d1ca] flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#5A5A40]" />
              <span>{t("wallet.loadSamples", "Load Sample Flight & Hotel Passes")}</span>
            </button>
          </div>
        </div>
      )}

      {/* PASSES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {filteredPasses.map((pass) => {
          const isFlightOrTrain = pass.category === "flight" || pass.category === "train";
          const isHotel = pass.category === "hotel";
          const isInsurance = pass.category === "insurance";

          return (
            <div
              key={pass.id}
              className="bg-white rounded-3xl border border-[#d1d1ca] shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col relative group"
            >
              {/* Top Accent Ribbon */}
              <div
                className={`px-5 py-3 flex items-center justify-between border-b ${
                  pass.category === "flight"
                    ? "bg-sky-900 text-white border-sky-950"
                    : pass.category === "train"
                    ? "bg-emerald-900 text-white border-emerald-950"
                    : pass.category === "hotel"
                    ? "bg-[#5A5A40] text-white border-[#4a4a35]"
                    : pass.category === "insurance"
                    ? "bg-rose-900 text-white border-rose-950"
                    : pass.category === "car_rental"
                    ? "bg-blue-900 text-white border-blue-950"
                    : "bg-stone-800 text-white border-stone-900"
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <div className="p-1 rounded-lg bg-white/15">
                    {pass.category === "flight" ? (
                      <Plane className="w-4 h-4" />
                    ) : pass.category === "train" ? (
                      <Train className="w-4 h-4" />
                    ) : pass.category === "hotel" ? (
                      <Hotel className="w-4 h-4" />
                    ) : pass.category === "insurance" ? (
                      <Shield className="w-4 h-4" />
                    ) : pass.category === "car_rental" ? (
                      <Car className="w-4 h-4" />
                    ) : (
                      <Ticket className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-mono opacity-80 block leading-none">
                      <TranslatedText text={pass.provider || pass.category.toUpperCase()} />
                    </span>
                    <span className="text-xs font-bold font-sans truncate block max-w-[200px] sm:max-w-[260px]">
                      <TranslatedText text={pass.title} />
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-white/20 text-white font-bold">
                    {pass.status}
                  </span>
                </div>
              </div>

              {/* Card Main Body */}
              <div className="p-5 sm:p-6 space-y-4 flex-1">
                {/* Route Header for Flights/Trains */}
                {isFlightOrTrain && (pass.origin || pass.destination) && (
                  <div className="flex items-center justify-between pb-3 border-b border-[#e5e5df]">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8a8a7e] block">{t("wallet.departure", "Departure")}</span>
                      <span className="font-serif italic font-bold text-base sm:text-lg text-[#2c2c24]">
                        <TranslatedText text={pass.origin || "Origin"} />
                      </span>
                    </div>
                    <div className="px-3 flex flex-col items-center">
                      <span className="text-xs text-[#5A5A40] font-mono">✈️</span>
                      <div className="w-12 h-0.5 bg-[#d1d1ca] my-0.5" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-[#8a8a7e] block">{t("wallet.arrival", "Arrival")}</span>
                      <span className="font-serif italic font-bold text-base sm:text-lg text-[#2c2c24]">
                        <TranslatedText text={pass.destination || plan.destinationOrTown} />
                      </span>
                    </div>
                  </div>
                )}

                {/* Primary Reference & Passenger Block */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#fdfbf7] p-3.5 rounded-2xl border border-[#e5e5df]">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
                      {t("wallet.confirmationPNR", "Confirmation PNR")}
                    </span>
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span className="font-mono font-bold text-sm text-[#2c2c24] tracking-wider">
                        {pass.confirmationCode}
                      </span>
                      <button
                        onClick={() => handleCopyCode(pass.id, pass.confirmationCode)}
                        title="Copy confirmation code"
                        className="p-1 rounded text-[#8a8a7e] hover:text-[#5A5A40] transition-colors cursor-pointer"
                      >
                        {copiedCodeId === pass.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {pass.passengerName && (
                    <div>
                      <span className="text-[9px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
                        {t("wallet.passengerGuest", "Passenger / Guest")}
                      </span>
                      <span className="text-xs font-bold text-[#2c2c24] font-sans truncate block mt-0.5">
                        <TranslatedText text={pass.passengerName} />
                      </span>
                    </div>
                  )}

                  <div>
                    <span className="text-[9px] uppercase font-bold text-[#8a8a7e] tracking-wider block">
                      {t("wallet.dateSchedule", "Date & Schedule")}
                    </span>
                    <span className="text-xs font-semibold text-[#5A5A40] font-mono block mt-0.5">
                      {pass.startDate} {pass.startTime ? `• ${pass.startTime}` : ""}
                    </span>
                  </div>
                </div>

                {/* Specific Grid for Transit (Seat, Terminal, Gate, Platform) */}
                {isFlightOrTrain && (pass.seat || pass.gate || pass.terminal || pass.platform || pass.coach) && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {pass.seat && (
                      <div className="bg-[#f5f5f0] p-2 rounded-xl border border-[#e5e5df]">
                        <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">{t("wallet.seat", "Seat")}</span>
                        <span className="font-mono font-bold text-[#2c2c24]">{pass.seat}</span>
                      </div>
                    )}
                    {(pass.gate || pass.platform) && (
                      <div className="bg-[#f5f5f0] p-2 rounded-xl border border-[#e5e5df]">
                        <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">
                          {pass.category === "flight" ? t("wallet.gate", "Gate") : t("wallet.platform", "Platform")}
                        </span>
                        <span className="font-mono font-bold text-[#2c2c24]">
                          {pass.gate || pass.platform}
                        </span>
                      </div>
                    )}
                    {(pass.terminal || pass.coach) && (
                      <div className="bg-[#f5f5f0] p-2 rounded-xl border border-[#e5e5df]">
                        <span className="text-[9px] uppercase font-bold text-[#8a8a7e] block">
                          {pass.category === "flight" ? t("wallet.terminal", "Terminal") : t("wallet.coach", "Coach")}
                        </span>
                        <span className="font-mono font-bold text-[#2c2c24]">
                          {pass.terminal || pass.coach}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Specific Details for Hotels */}
                {isHotel && (
                  <div className="space-y-2.5">
                    {pass.address && (
                      <div className="flex items-start space-x-2 text-xs text-[#2c2c24]">
                        <MapPin className="w-3.5 h-3.5 text-[#5A5A40] shrink-0 mt-0.5" />
                        <span className="font-sans leading-snug">
                          <TranslatedText text={pass.address} />
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pass.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#5A5A40] hover:underline font-semibold shrink-0 ml-1"
                        >
                          Maps ↗
                        </a>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      {pass.accessPinOrKeycode && (
                        <div className="bg-amber-50 p-2 rounded-xl border border-amber-200">
                          <span className="text-[9px] uppercase font-bold text-amber-800 flex items-center gap-1">
                            <Key className="w-3 h-3" /> {t("wallet.doorKeycode", "Door / Key Code")}
                          </span>
                          <span className="font-mono font-bold text-xs text-amber-950 block mt-0.5">
                            {pass.accessPinOrKeycode}
                          </span>
                        </div>
                      )}

                      {pass.wifiDetails && (
                        <div className="bg-sky-50 p-2 rounded-xl border border-sky-200">
                          <span className="text-[9px] uppercase font-bold text-sky-800 flex items-center gap-1">
                            <Wifi className="w-3 h-3" /> {t("wallet.wifiInfo", "Wi-Fi Info")}
                          </span>
                          <span className="font-mono font-medium text-[11px] text-sky-950 block mt-0.5 truncate">
                            {pass.wifiDetails}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Specific Details for Insurance */}
                {isInsurance && (
                  <div className="space-y-2 bg-rose-50/50 p-3 rounded-2xl border border-rose-200 text-xs">
                    {pass.emergencyPhone && (
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-900 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-rose-700" />
                          {t("wallet.emergencyHotline", "24/7 Emergency Assistance Hotline")}:
                        </span>
                        <a
                          href={`tel:${pass.emergencyPhone}`}
                          className="font-mono font-bold text-rose-700 bg-white px-2 py-0.5 rounded-lg border border-rose-300 hover:bg-rose-100 transition-colors"
                        >
                          {pass.emergencyPhone}
                        </a>
                      </div>
                    )}
                    {pass.coverageSummary && (
                      <p className="text-[11px] text-stone-700 leading-snug">
                        <strong>{t("wallet.coverage", "Coverage")}:</strong> <TranslatedText text={pass.coverageSummary} />
                      </p>
                    )}
                  </div>
                )}

                {/* Notes if present */}
                {pass.notes && (
                  <p className="text-[11px] text-[#6b6b5e] font-sans italic bg-[#f5f5f0] p-2.5 rounded-xl border border-[#e5e5df]">
                    <TranslatedText text={pass.notes} />
                  </p>
                )}

                {/* Attached Documents & Confirmation Mails */}
                {pass.attachments && pass.attachments.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#8a8a7e] flex items-center gap-1">
                      <Paperclip className="w-3 h-3 text-[#5A5A40]" />
                      <span>{t("wallet.confirmationDocs", "Confirmation Docs & Mails")} ({pass.attachments.length})</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {pass.attachments.map((att) => (
                        <a
                          key={att.id}
                          href={att.dataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={att.name}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#f5f5f0] hover:bg-[#ecece4] border border-[#d1d1ca] text-[11px] font-semibold text-stone-800 transition-all cursor-pointer shadow-2xs hover:border-[#5A5A40]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#5A5A40]" />
                          <span className="truncate max-w-[150px] sm:max-w-[180px]">{att.name}</span>
                          <Download className="w-3 h-3 text-stone-400 hover:text-stone-700 ml-0.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Perforated Boarding Pass Divider Notch */}
              <div className="relative py-2 px-4 flex items-center bg-[#fdfbf7] border-t border-dashed border-[#d1d1ca]">
                <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#f5f5f0] border-r border-[#d1d1ca]" />
                <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#f5f5f0] border-l border-[#d1d1ca]" />

                {/* Barcode & Interactive Buttons */}
                <div className="w-full flex items-center justify-between gap-2">
                  <button
                    onClick={() => setFullScreenQrPass(pass)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#d1d1ca] hover:border-[#5A5A40] text-xs font-mono text-[#2c2c24] hover:shadow-xs transition-all cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-[#5A5A40]" />
                    <span className="font-bold text-[11px]">{t("wallet.showBarcode", "Show Barcode / Gate QR")}</span>
                  </button>

                  {pass.cost && pass.cost > 0 && (
                    <button
                      onClick={() => handleSplitInGroup(pass)}
                      title="Split or assign this booking cost in Group Hub"
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-[#5A5A40]/10 hover:bg-[#5A5A40]/20 text-[#5A5A40] text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{formatCurrency(pass.cost, "€")} • {t("wallet.split", "Split")}</span>
                    </button>
                  )}

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setEditingPass(pass);
                        setIsAddModalOpen(true);
                      }}
                      title="Edit pass details"
                      className="p-1.5 rounded-lg text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-black/5 transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteId === pass.id ? (
                      <div className="flex items-center space-x-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-xl">
                        <button
                          onClick={() => handleDeletePass(pass.id)}
                          className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          <TranslatedText text="Confirm Delete" />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-0.5 text-stone-600 hover:text-stone-900 text-[10px] font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(pass.id)}
                        title="Delete pass"
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-Screen Gate QR Scanner Modal */}
      {fullScreenQrPass && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setFullScreenQrPass(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl border border-stone-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <span className="font-mono text-xs uppercase font-bold text-stone-500">
                <TranslatedText text="Gate & Scanner Display" />
              </span>
              <button
                onClick={() => setFullScreenQrPass(null)}
                className="text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <h4 className="font-serif italic font-bold text-lg text-stone-900">
                <TranslatedText text={fullScreenQrPass.title} />
              </h4>
              <p className="font-mono font-bold text-sm text-[#5A5A40]">
                PNR: {fullScreenQrPass.confirmationCode}
              </p>
            </div>

            {/* High-Contrast Visual QR Simulation for Turnstiles & Gates */}
            <div className="bg-white p-6 rounded-2xl border-4 border-stone-900 inline-block shadow-md">
              <div className="w-48 h-48 bg-stone-900 flex flex-col items-center justify-center p-3 rounded-lg relative overflow-hidden">
                {/* Simulated QR block layout */}
                <div className="w-full h-full bg-white p-2 grid grid-cols-6 gap-1 rounded">
                  {Array.from({ length: 36 }).map((_, i) => (
                    <div
                      key={i}
                      className={`rounded-xs ${
                        i % 2 === 0 || i % 5 === 0 || i === 0 || i === 5 || i === 30 || i === 35
                          ? "bg-black"
                          : "bg-white"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="font-mono text-[9px] text-stone-600 mt-2 tracking-widest uppercase">
                {fullScreenQrPass.qrCodeData || fullScreenQrPass.confirmationCode}
              </p>
            </div>

            <div className="bg-[#f5f5f0] p-3 rounded-xl border border-[#e5e5df] text-[11px] text-stone-600">
              💡 <strong><TranslatedText text="Scanner Tip:" /></strong> <TranslatedText text="Maximize screen brightness and hold 10-15cm away from the airport or station turnstile reader." />
            </div>

            <button
              onClick={() => setFullScreenQrPass(null)}
              className="w-full py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"
            >
              <TranslatedText text="Done / Close" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
