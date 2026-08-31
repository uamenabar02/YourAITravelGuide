import React, { useState, useEffect } from "react";
import {
  X,
  Plane,
  Train,
  Hotel,
  Ticket,
  Car,
  Shield,
  FileText,
  Calendar,
  Clock,
  MapPin,
  QrCode,
  DollarSign,
  Paperclip,
  Upload,
  Trash2,
  Download,
  CheckCircle2,
  Key,
  Wifi,
  Phone,
  Search,
  Loader2,
  ChevronUp,
} from "lucide-react";
import {
  TravelBookingPass,
  BookingCategory,
  BookingStatus,
  BookingAttachment,
  ItineraryPlan,
  Coordinates,
} from "../types";
import { useLanguage } from "../context/LanguageContext";
import { TranslatedText } from "./TranslatedText";
import { AccommodationMapPickerModal } from "./AccommodationMapPickerModal";

interface BookingPassFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pass: TravelBookingPass) => void;
  initialPass?: TravelBookingPass | null;
  tripPlan: ItineraryPlan;
  groupMembers?: string[];
  isInline?: boolean;
}

export const BookingPassForm: React.FC<BookingPassFormProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPass,
  tripPlan,
  groupMembers = [],
  isInline = true,
}) => {
  const { t } = useLanguage();

  const [category, setCategory] = useState<BookingCategory>("flight");
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [secondaryCode, setSecondaryCode] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [address, setAddress] = useState("");
  const [gate, setGate] = useState("");
  const [terminal, setTerminal] = useState("");
  const [seat, setSeat] = useState("");
  const [platform, setPlatform] = useState("");
  const [coach, setCoach] = useState("");
  const [roomType, setRoomType] = useState("");
  const [accessPinOrKeycode, setAccessPinOrKeycode] = useState("");
  const [wifiDetails, setWifiDetails] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [coverageSummary, setCoverageSummary] = useState("");
  const [cost, setCost] = useState<string>("");
  const [currency, setCurrency] = useState(tripPlan.currency || "EUR");
  const [paidBy, setPaidBy] = useState("");
  const [status, setStatus] = useState<BookingStatus>("confirmed");
  const [notes, setNotes] = useState("");
  const [qrCodeData, setQrCodeData] = useState("");
  const [attachments, setAttachments] = useState<BookingAttachment[]>([]);

  // Map Picker & Address Verification states
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapTargetField, setMapTargetField] = useState<"address" | "pickup" | "dropoff">("address");
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<{ displayName: string; coords: Coordinates }[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialPass) {
        setCategory(initialPass.category);
        setTitle(initialPass.title || "");
        setProvider(initialPass.provider || "");
        setConfirmationCode(initialPass.confirmationCode || "");
        setSecondaryCode(initialPass.secondaryCode || "");
        setPassengerName(initialPass.passengerName || "");
        setStartDate(initialPass.startDate || "");
        setStartTime(initialPass.startTime || "");
        setEndDate(initialPass.endDate || "");
        setEndTime(initialPass.endTime || "");
        setOrigin(initialPass.origin || "");
        setDestination(initialPass.destination || "");
        setAddress(initialPass.address || "");
        setGate(initialPass.gate || "");
        setTerminal(initialPass.terminal || "");
        setSeat(initialPass.seat || "");
        setPlatform(initialPass.platform || "");
        setCoach(initialPass.coach || "");
        setRoomType(initialPass.roomType || "");
        setAccessPinOrKeycode(initialPass.accessPinOrKeycode || "");
        setWifiDetails(initialPass.wifiDetails || "");
        setVehicleModel(initialPass.vehicleModel || "");
        setPickupLocation(initialPass.pickupLocation || "");
        setDropoffLocation(initialPass.dropoffLocation || "");
        setEmergencyPhone(initialPass.emergencyPhone || "");
        setCoverageSummary(initialPass.coverageSummary || "");
        setCost(initialPass.cost ? String(initialPass.cost) : "");
        setCurrency(initialPass.currency || tripPlan.currency || "EUR");
        setPaidBy(initialPass.paidBy || "");
        setStatus(initialPass.status || "confirmed");
        setNotes(initialPass.notes || "");
        setQrCodeData(initialPass.qrCodeData || "");
        setAttachments(initialPass.attachments || []);
        setValidationError(null);
      } else {
        const baseDate = tripPlan.startDate || new Date().toISOString().split("T")[0];
        setCategory("flight");
        setTitle("");
        setProvider("");
        setConfirmationCode("");
        setSecondaryCode("");
        setPassengerName("");
        setStartDate(baseDate);
        setStartTime("09:00 AM");
        setEndDate(baseDate);
        setEndTime("11:30 AM");
        setOrigin("");
        setDestination(tripPlan.destinationOrTown || "");
        setAddress("");
        setGate("");
        setTerminal("");
        setSeat("");
        setPlatform("");
        setCoach("");
        setRoomType("");
        setAccessPinOrKeycode("");
        setWifiDetails("");
        setVehicleModel("");
        setPickupLocation("");
        setDropoffLocation("");
        setEmergencyPhone("");
        setCoverageSummary("");
        setCost("");
        setCurrency(tripPlan.currency || "EUR");
        setPaidBy(groupMembers[0] || "");
        setStatus("confirmed");
        setNotes("");
        setQrCodeData("");
        setAttachments([]);
        setValidationError(null);
      }
    }
  }, [isOpen, initialPass?.id]);

  if (!isOpen) return null;

  const handleVerifyAddress = async (queryAddress: string, field: "address" | "pickup" | "dropoff") => {
    if (!queryAddress.trim()) return;
    setIsVerifyingAddress(true);
    try {
      const townContext = tripPlan.destinationOrTown || "";
      const query = townContext && !queryAddress.toLowerCase().includes(townContext.toLowerCase())
        ? `${queryAddress}, ${townContext}`
        : queryAddress;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3`,
        { headers: { "Accept-Language": "en" } }
      );

      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items) && items.length > 0) {
          const formatted = items.map((i: any) => ({
            displayName: i.display_name,
            coords: { lat: parseFloat(i.lat), lng: parseFloat(i.lon) },
          }));
          setAddressSuggestions(formatted);
          if (field === "address") setAddress(formatted[0].displayName);
          else if (field === "pickup") setPickupLocation(formatted[0].displayName);
          else if (field === "dropoff") setDropoffLocation(formatted[0].displayName);
        } else {
          setAddressSuggestions([]);
        }
      }
    } catch (err) {
      console.warn("Address verification error:", err);
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      if (file.size > 8 * 1024 * 1024) {
        alert(`File "${file.name}" exceeds 8MB. Please attach smaller files.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newAtt: BookingAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          type: file.type || "application/octet-stream",
          dataUrl,
          size: file.size,
          uploadedAt: Date.now(),
        };
        setAttachments((prev) => [...prev, newAtt]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !confirmationCode.trim()) {
      setValidationError("Please provide at least a Booking Title and Confirmation Code.");
      return;
    }

    const passPayload: TravelBookingPass = {
      id: initialPass?.id || `pass-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      tripId: tripPlan.id,
      category,
      title: title.trim(),
      provider: provider.trim() || title.trim(),
      confirmationCode: confirmationCode.trim().toUpperCase(),
      secondaryCode: secondaryCode.trim() || undefined,
      passengerName: passengerName.trim() || undefined,
      startDate: startDate || new Date().toISOString().split("T")[0],
      startTime: startTime.trim() || undefined,
      endDate: endDate || undefined,
      endTime: endTime.trim() || undefined,
      origin: origin.trim() || undefined,
      destination: destination.trim() || undefined,
      address: address.trim() || undefined,
      gate: gate.trim() || undefined,
      terminal: terminal.trim() || undefined,
      seat: seat.trim() || undefined,
      platform: platform.trim() || undefined,
      coach: coach.trim() || undefined,
      roomType: roomType.trim() || undefined,
      accessPinOrKeycode: accessPinOrKeycode.trim() || undefined,
      wifiDetails: wifiDetails.trim() || undefined,
      vehicleModel: vehicleModel.trim() || undefined,
      pickupLocation: pickupLocation.trim() || undefined,
      dropoffLocation: dropoffLocation.trim() || undefined,
      emergencyPhone: emergencyPhone.trim() || undefined,
      coverageSummary: coverageSummary.trim() || undefined,
      cost: cost ? parseFloat(cost) : undefined,
      currency: currency || "EUR",
      paidBy: paidBy.trim() || undefined,
      status,
      notes: notes.trim() || undefined,
      qrCodeData: qrCodeData.trim() || `PASS-${confirmationCode.toUpperCase()}-${tripPlan.id.slice(0, 6)}`,
      barcodeType: category === "flight" ? "pdf417" : "qr",
      attachments,
      createdAt: initialPass?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSave(passPayload);
    onClose();
  };

  const categories: { id: BookingCategory; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "flight", label: "Flight", icon: <Plane className="w-4 h-4" />, color: "text-sky-700 bg-sky-50 border-sky-200" },
    { id: "train", label: "Train / Rail", icon: <Train className="w-4 h-4" />, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { id: "hotel", label: "Stay / Hotel", icon: <Hotel className="w-4 h-4" />, color: "text-amber-700 bg-amber-50 border-amber-200" },
    { id: "activity", label: "Activity / Pass", icon: <Ticket className="w-4 h-4" />, color: "text-purple-700 bg-purple-50 border-purple-200" },
    { id: "car_rental", label: "Car Rental", icon: <Car className="w-4 h-4" />, color: "text-blue-700 bg-blue-50 border-blue-200" },
    { id: "insurance", label: "Insurance", icon: <Shield className="w-4 h-4" />, color: "text-rose-700 bg-rose-50 border-rose-200" },
    { id: "document", label: "Other Doc", icon: <FileText className="w-4 h-4" />, color: "text-stone-700 bg-stone-50 border-stone-200" },
  ];

  const content = (
    <div className="bg-white w-full rounded-3xl shadow-md flex flex-col overflow-hidden border border-[#d1d1ca]">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-[#f5f5f0] border-b border-[#e5e5df] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-[#5A5A40] flex items-center justify-center text-white font-serif italic text-lg shadow-xs shrink-0">
            🎟️
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-[#2c2c24] flex items-center gap-2">
              <TranslatedText text={initialPass ? "Edit Travel Booking Pass" : "Create Travel Booking Pass"} />
            </h3>
            <p className="text-xs text-[#8a8a7e]">
              <TranslatedText text="Boarding passes, hotel reservations, museum tickets & policy vouchers" />
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Collapse Form"
          className="p-2 rounded-full text-[#8a8a7e] hover:text-[#2c2c24] hover:bg-[#ecece4] transition-colors cursor-pointer flex items-center gap-1 text-xs font-semibold"
        >
          <span className="hidden sm:inline"><TranslatedText text="Close" /></span>
          <ChevronUp className="w-5 h-5" />
        </button>
      </div>

      {/* Outer Form Container */}
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
        {validationError && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium flex items-center justify-between">
            <TranslatedText text={validationError} />
            <button type="button" onClick={() => setValidationError(null)} className="text-rose-400 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable / Responsive Form Body */}
        <div className="p-4 sm:p-6 space-y-5 bg-[#fdfbf7]">
          {/* Category Selector */}
          <div>
            <label className="block text-xs font-bold text-[#2c2c24] uppercase tracking-wider mb-2">
              <TranslatedText text="Pass Category" />
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    category === c.id
                      ? "bg-[#5A5A40] text-white border-[#5A5A40] shadow-xs font-bold"
                      : "bg-white text-stone-700 border-stone-200 hover:border-stone-400 hover:bg-stone-50"
                  }`}
                >
                  <span>{c.icon}</span>
                  <span className="truncate">
                    <TranslatedText text={c.label} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                <TranslatedText text="Booking Title / Route" /> <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={
                  category === "flight"
                    ? "e.g. Flight MAD → EAS (Iberia 3482)"
                    : category === "hotel"
                    ? "e.g. Hotel Maria Cristina Stay"
                    : category === "train"
                    ? "e.g. Renfe AVE Madrid - Donostia"
                    : category === "car_rental"
                    ? "e.g. Hertz Car Rental - Airport Desk"
                    : category === "insurance"
                    ? "e.g. Allianz Global Medical Insurance"
                    : "e.g. Guggenheim Museum Tour"
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:border-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                <TranslatedText text="Company / Provider Name" />
              </label>
              <input
                type="text"
                placeholder="e.g. Iberia, Renfe, Marriott, Hertz, Museum"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:border-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                <TranslatedText text="Confirmation Code / PNR" /> <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. IB79XQ, RES-98412, H-4928"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 bg-white border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-mono font-bold tracking-wider uppercase focus:outline-none focus:border-[#5A5A40]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">
                <TranslatedText text="Passenger / Guest Name" />
              </label>
              <input
                type="text"
                placeholder="e.g. Alex Martinez"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:border-[#5A5A40]"
              />
            </div>
          </div>

          {/* Dates & Times */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
            <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#5A5A40]" />
              <TranslatedText text="Dates & Schedule" />
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="Start / Check-in" />
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="Start Time" />
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="End / Check-out" />
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="End Time" />
                </label>
                <input
                  type="text"
                  placeholder="e.g. 11:30 AM"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Category-Specific Sections */}
          {(category === "flight" || category === "train") && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                {category === "flight" ? <Plane className="w-3.5 h-3.5 text-[#5A5A40]" /> : <Train className="w-3.5 h-3.5 text-[#5A5A40]" />}
                <TranslatedText text={category === "flight" ? "Flight Transit & Boarding Details" : "Train & Rail Route Details"} />
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Origin / Departure City or Station" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Madrid Barajas (MAD) / Atocha"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Destination / Arrival City or Station" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. San Sebastián (EAS) / Donostia"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text={category === "flight" ? "Terminal" : "Platform / Track"} />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. T4 / Platform 3"
                    value={terminal || platform}
                    onChange={(e) => {
                      if (category === "flight") setTerminal(e.target.value);
                      else setPlatform(e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text={category === "flight" ? "Gate" : "Coach / Car"} />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. K72 / Coach 04"
                    value={gate || coach}
                    onChange={(e) => {
                      if (category === "flight") setGate(e.target.value);
                      else setCoach(e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Seat Number" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 14A (Window) / Seat 08B"
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {category === "hotel" && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Hotel className="w-3.5 h-3.5 text-[#5A5A40]" />
                <TranslatedText text="Lodging, Address & Access Codes" />
              </h4>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Full Hotel / Accommodation Address" />
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Paseo República Argentina 4, San Sebastián"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none focus:border-[#5A5A40]"
                    />
                    <button
                      type="button"
                      onClick={() => handleVerifyAddress(address, "address")}
                      disabled={isVerifyingAddress || !address.trim()}
                      className="px-2.5 py-1.5 bg-[#ecece4] hover:bg-[#d1d1ca] text-[#2c2c24] text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shrink-0 disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifyingAddress ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#5A5A40]" />
                      ) : (
                        <Search className="w-3.5 h-3.5 text-[#5A5A40]" />
                      )}
                      <span className="text-[11px]"><TranslatedText text="Verify" /></span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMapTargetField("address");
                        setIsMapPickerOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      <span className="text-[11px]"><TranslatedText text="Pin Map" /></span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      <TranslatedText text="Room / Suite Type" />
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Deluxe River View"
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      <TranslatedText text="Door / Key Lock PIN" />
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. #4829"
                      value={accessPinOrKeycode}
                      onChange={(e) => setAccessPinOrKeycode(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                      <TranslatedText text="Wi-Fi Network / Pass" />
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Net: Guest / Pass: 1234"
                      value={wifiDetails}
                      onChange={(e) => setWifiDetails(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {category === "insurance" && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#5A5A40]" />
                <TranslatedText text="Emergency Hotline & Policy Protection" />
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="24/7 Global Medical Assistance Phone" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. +34 91 748 67 00 / +1 800 555 0199"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Coverage Scope" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. €150,000 Medical, Trip Cancellation, Luggage"
                    value={coverageSummary}
                    onChange={(e) => setCoverageSummary(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {category === "car_rental" && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Car className="w-3.5 h-3.5 text-[#5A5A40]" />
                <TranslatedText text="Vehicle & Rental Terms" />
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Vehicle Model / Class" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Audi A3 / Compact SUV"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Pickup Location" />
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="e.g. Airport T4 Car Desk"
                      value={pickupLocation}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMapTargetField("pickup");
                        setIsMapPickerOpen(true);
                      }}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                      title="Pin Pickup Location"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Drop-off Location" />
                  </label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      placeholder="e.g. City Central Station"
                      value={dropoffLocation}
                      onChange={(e) => setDropoffLocation(e.target.value)}
                      className="w-full px-2 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMapTargetField("dropoff");
                        setIsMapPickerOpen(true);
                      }}
                      className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                      title="Pin Dropoff Location"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {category === "activity" && (
            <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-[#5A5A40]" />
                <TranslatedText text="Venue Location & Meeting Point" />
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Venue / Meeting Address" />
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      placeholder="e.g. Abandoibarra Etorb., 2, Bilbao"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setMapTargetField("address");
                        setIsMapPickerOpen(true);
                      }}
                      className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold rounded-lg flex items-center gap-1 shrink-0 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5 text-amber-700" />
                      <span className="text-[11px]"><TranslatedText text="Pin Map" /></span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    <TranslatedText text="Seat / Section / Tour Guide" />
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Section A, English Guided Tour"
                    value={seat}
                    onChange={(e) => setSeat(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Financials & Status */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
            <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#5A5A40]" />
              <TranslatedText text="Cost & Payment Info" />
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="Total Cost (Optional)" />
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-stone-400 font-mono">€</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="120.00"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full pl-7 pr-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="Paid By (Group Member)" />
                </label>
                <input
                  type="text"
                  placeholder="e.g. Alex, Maria, Organizer"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  <TranslatedText text="Pass Status" />
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as BookingStatus)}
                  className="w-full px-3 py-1.5 bg-[#f5f5f0] border border-[#d1d1ca] rounded-lg text-xs font-sans focus:outline-none cursor-pointer"
                >
                  <option value="confirmed">{t("wallet.statusConfirmed", "Confirmed ✓")}</option>
                  <option value="pending">{t("wallet.statusPending", "Pending Reservation ⏳")}</option>
                  <option value="completed">{t("wallet.statusCompleted", "Completed / Boarded")}</option>
                  <option value="cancelled">{t("wallet.statusCancelled", "Cancelled")}</option>
                </select>
              </div>
            </div>
          </div>

          {/* File Attachments / Confirmation Documents & Emails */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#e5e5df] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs uppercase font-bold text-[#8a8a7e] flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[#5A5A40]" />
                <span>
                  <TranslatedText text="Confirmation Documents & Mail Attachments" />
                </span>
              </h4>
              <span className="text-[10px] text-stone-500 font-mono">
                {attachments.length} <TranslatedText text="attached" />
              </span>
            </div>

            {/* Existing Attachments List */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 bg-[#f5f5f0] rounded-xl border border-[#d1d1ca] text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                      <FileText className="w-4 h-4 text-[#5A5A40] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 truncate">{file.name}</p>
                        <p className="text-[10px] text-stone-500">
                          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Document"} • {new Date(file.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      {file.dataUrl && (
                        <a
                          href={file.dataUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={file.name}
                          className="px-2 py-1 bg-white hover:bg-stone-100 text-stone-700 text-[10px] font-bold rounded-lg border border-stone-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <TranslatedText text="View" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAttachment(file.id)}
                        className="p-1 hover:bg-rose-100 text-stone-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Drop Zone */}
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-[#d1d1ca] hover:border-[#5A5A40] bg-[#fdfbf7] hover:bg-[#f5f5f0] rounded-xl cursor-pointer transition-colors group">
              <Upload className="w-5 h-5 text-[#8a8a7e] group-hover:text-[#5A5A40] mb-1 transition-colors" />
              <span className="text-xs font-semibold text-stone-700 group-hover:text-[#2c2c24]">
                <TranslatedText text="Attach Confirmation Email, PDF or Ticket Doc" />
              </span>
              <span className="text-[10px] text-stone-500 mt-0.5">
                <TranslatedText text="PDF, Images, EML, DOCX, TXT or ICS (Max 8MB)" />
              </span>
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt,.eml,.msg,.ics"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {/* Notes & Extra Instructions */}
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">
              <TranslatedText text="Notes, Instructions & Reminders" />
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Baggage allowance, breakfast hours, fast-track boarding instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-[#d1d1ca] rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:border-[#5A5A40]"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#f5f5f0] border-t border-[#e5e5df] flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <TranslatedText text="Cancel" />
          </button>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-[#5A5A40] hover:bg-[#4a4a35] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              <TranslatedText text={initialPass ? "Save Changes" : "Create Booking Pass"} />
            </span>
          </button>
        </div>
      </form>

      {/* Map Picker Modal for Location Verification & Pinning */}
      <AccommodationMapPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onSelect={(displayName, coordinates) => {
          if (mapTargetField === "address") setAddress(displayName);
          else if (mapTargetField === "pickup") setPickupLocation(displayName);
          else if (mapTargetField === "dropoff") setDropoffLocation(displayName);
          setIsMapPickerOpen(false);
        }}
        cityContext={tripPlan.destinationOrTown || ""}
        initialLocationName={mapTargetField === "address" ? address : mapTargetField === "pickup" ? pickupLocation : dropoffLocation}
      />
    </div>
  );

  if (!isInline) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div className="w-full max-w-2xl max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
};
