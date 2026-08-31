import { TravelBookingPass, ItineraryPlan, BookingCategory } from "../types";
import { notifyLocalDataChanged } from "./storage";

const WALLET_STORAGE_PREFIX = "localexplorer_wallet_passes_v1_";

/**
 * Get all booking passes for a specific trip
 */
export function getTripWalletPasses(tripId: string): TravelBookingPass[] {
  if (!tripId) return [];
  try {
    const raw = localStorage.getItem(`${WALLET_STORAGE_PREFIX}${tripId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read wallet passes from localStorage:", err);
    return [];
  }
}

/**
 * Save all booking passes for a trip
 */
export function saveTripWalletPasses(tripId: string, passes: TravelBookingPass[]): void {
  if (!tripId) return;
  try {
    localStorage.setItem(`${WALLET_STORAGE_PREFIX}${tripId}`, JSON.stringify(passes));
    notifyWalletChanged(tripId);
  } catch (err) {
    console.error("Failed to save wallet passes to localStorage:", err);
  }
}

/**
 * Add or update a single booking pass
 */
export function saveWalletPass(pass: TravelBookingPass): TravelBookingPass[] {
  const current = getTripWalletPasses(pass.tripId);
  const index = current.findIndex((p) => p.id === pass.id);
  let updated: TravelBookingPass[];

  const now = Date.now();
  const normalizedPass: TravelBookingPass = {
    ...pass,
    updatedAt: now,
    createdAt: pass.createdAt || now,
  };

  if (index >= 0) {
    updated = [...current];
    updated[index] = normalizedPass;
  } else {
    updated = [normalizedPass, ...current];
  }

  saveTripWalletPasses(pass.tripId, updated);
  return updated;
}

/**
 * Delete a booking pass
 */
export function deleteWalletPass(tripId: string, passId: string): TravelBookingPass[] {
  const current = getTripWalletPasses(tripId);
  const updated = current.filter((p) => p.id !== passId);
  saveTripWalletPasses(tripId, updated);
  return updated;
}

/**
 * Dispatch event to sync wallet changes across tabs and components
 */
export function notifyWalletChanged(tripId?: string): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("localexplorer_wallet_updated", { detail: { tripId } }));
    notifyLocalDataChanged();
  }
}

/**
 * Generate simulated Aztec / QR / Barcode data strings for visual realism
 */
export function generateBarcodePayload(pass: Partial<TravelBookingPass>): string {
  const code = pass.confirmationCode || "RES-98412";
  const pax = (pass.passengerName || "TRAVELER").toUpperCase().replace(/\s+/g, "/");
  const orig = (pass.origin || "MAD").substring(0, 3).toUpperCase();
  const dest = (pass.destination || "EAS").substring(0, 3).toUpperCase();
  return `M1${pax} E${code} ${orig}${dest} 03482 ${pass.seat || "14A"} 001`;
}

/**
 * Auto-import accommodations and ticketed spots from the Itinerary Plan into the Wallet
 */
export function importBookingsFromItinerary(plan: ItineraryPlan): TravelBookingPass[] {
  const existing = getTripWalletPasses(plan.id);
  const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));
  const newPasses: TravelBookingPass[] = [];

  const baseDate = plan.startDate || new Date().toISOString().split("T")[0];

  // 1. Import Accommodations
  const accommodations = plan.accommodations && plan.accommodations.length > 0
    ? plan.accommodations
    : plan.accommodation
    ? [plan.accommodation]
    : [];

  accommodations.forEach((acc, idx) => {
    const title = acc.name || `Accommodation in ${plan.destinationOrTown}`;
    if (!existingTitles.has(title.toLowerCase())) {
      const checkInOffset = (acc.checkInDay ? acc.checkInDay - 1 : 0);
      const checkOutOffset = (acc.checkOutDay ? acc.checkOutDay - 1 : plan.totalDays || 1);

      const inDateObj = new Date(baseDate);
      inDateObj.setDate(inDateObj.getDate() + checkInOffset);
      const outDateObj = new Date(baseDate);
      outDateObj.setDate(outDateObj.getDate() + checkOutOffset);

      const pass: TravelBookingPass = {
        id: `acc-${Date.now()}-${idx}`,
        tripId: plan.id,
        category: "hotel",
        title: acc.name,
        provider: acc.name,
        confirmationCode: `HTL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        startDate: inDateObj.toISOString().split("T")[0],
        startTime: acc.checkInHour || "15:00",
        endDate: outDateObj.toISOString().split("T")[0],
        endTime: acc.checkOutHour || "11:00",
        address: acc.address || acc.location || plan.destinationOrTown,
        roomType: "Reserved Double / Standard Room",
        accessPinOrKeycode: "Key available at front desk (24h)",
        wifiDetails: "Available upon check-in",
        status: "confirmed",
        cost: plan.budgetType === "exact" && plan.exactBudgetPerDay ? plan.exactBudgetPerDay * 1.5 : 180,
        currency: plan.currency || "EUR",
        notes: acc.description || acc.notes || `Accommodation for ${plan.destinationOrTown} stay.`,
        qrCodeData: `HTL-CONF-${acc.name.replace(/\s+/g, "-")}-${inDateObj.toISOString().split("T")[0]}`,
        barcodeType: "qr",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      newPasses.push(pass);
    }
  });

  // 2. Import activities with tickets or cultural landmarks
  plan.days.forEach((day) => {
    day.activities.forEach((act, actIdx) => {
      const isTicketed =
        act.ticketUrl ||
        act.category === "culture" ||
        act.category === "entertainment" ||
        (act.approxCost && act.approxCost !== "Free" && act.approxCost !== "€0");

      if (isTicketed && !existingTitles.has(act.name.toLowerCase())) {
        const dayOffset = day.dayNumber - 1;
        const actDate = new Date(baseDate);
        actDate.setDate(actDate.getDate() + dayOffset);

        const timeParts = act.time.split("-");
        const startTime = timeParts[0]?.trim() || "10:00 AM";
        const endTime = timeParts[1]?.trim() || "12:00 PM";

        const pass: TravelBookingPass = {
          id: `act-${Date.now()}-${day.dayNumber}-${actIdx}`,
          tripId: plan.id,
          category: "activity",
          title: act.name,
          provider: act.name,
          confirmationCode: `TKT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          startDate: actDate.toISOString().split("T")[0],
          startTime,
          endDate: actDate.toISOString().split("T")[0],
          endTime,
          address: act.address || `${act.name}, ${plan.destinationOrTown}`,
          status: "confirmed",
          cost: act.approxCost && act.approxCost.includes("€") ? parseFloat(act.approxCost.replace(/[^0-9.]/g, "")) || 22 : 25,
          currency: plan.currency || "EUR",
          bookingUrl: act.ticketUrl,
          notes: `${act.description} Tip: ${act.insiderTip}`,
          qrCodeData: `PASS-${act.id}-${act.name.substring(0, 10).toUpperCase()}`,
          barcodeType: "qr",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        newPasses.push(pass);
      }
    });
  });

  const merged = [...newPasses, ...existing];
  saveTripWalletPasses(plan.id, merged);
  return merged;
}

/**
 * Generate realistic sample passes for a trip
 */
export function generateSampleWalletPasses(plan: ItineraryPlan): TravelBookingPass[] {
  const baseDate = plan.startDate || new Date().toISOString().split("T")[0];
  const dest = plan.destinationOrTown;
  const now = Date.now();

  const depDateObj = new Date(baseDate);
  const retDateObj = new Date(baseDate);
  retDateObj.setDate(retDateObj.getDate() + (plan.totalDays || 3));

  const depDateStr = depDateObj.toISOString().split("T")[0];
  const retDateStr = retDateObj.toISOString().split("T")[0];

  const samplePasses: TravelBookingPass[] = [
    {
      id: `sample-flt-1-${now}`,
      tripId: plan.id,
      category: "flight",
      title: `Outbound Flight: Madrid (MAD) → ${dest}`,
      provider: "Iberia Express",
      confirmationCode: "IB79XQ",
      secondaryCode: "075-2481928401",
      passengerName: "Alex Martinez",
      startDate: depDateStr,
      startTime: plan.arrivalHour || "08:45 AM",
      endDate: depDateStr,
      endTime: "10:15 AM",
      origin: "MAD (Madrid Barajas T4)",
      destination: `${dest.toUpperCase().slice(0, 3)} (${dest} Airport)`,
      terminal: "T4",
      gate: "K72",
      seat: "12F (Window)",
      status: "confirmed",
      cost: 112.50,
      currency: "EUR",
      qrCodeData: `M1MARTINEZ/ALEX EIB79XQ MAD${dest.slice(0, 3).toUpperCase()}IB3482 12F`,
      barcodeType: "pdf417",
      notes: "Carry-on 10kg included. Fast track security barcode active.",
      createdAt: now - 3000,
      updatedAt: now,
    },
    {
      id: `sample-htl-1-${now}`,
      tripId: plan.id,
      category: "hotel",
      title: `${dest} Boutique Heritage Hotel`,
      provider: `${dest} Suites & Residences`,
      confirmationCode: "HTL-94812",
      secondaryCode: "PIN: #4829",
      passengerName: "Alex Martinez",
      startDate: depDateStr,
      startTime: "15:00",
      endDate: retDateStr,
      endTime: "11:00",
      address: `Calle Mayor 14, Historic Center, ${dest}`,
      roomType: "Superior King with Balcony & City View",
      accessPinOrKeycode: "Smart Lock PIN: #4829",
      wifiDetails: "SSID: Hotel_Guest / Pass: Explorer2026",
      status: "confirmed",
      cost: 380.00,
      currency: "EUR",
      qrCodeData: `CONF-HTL94812-${dest.toUpperCase()}`,
      barcodeType: "qr",
      notes: "Late check-in requested. Artisan breakfast included every morning from 08:00 to 11:00.",
      createdAt: now - 2000,
      updatedAt: now,
    },
    {
      id: `sample-trn-1-${now}`,
      tripId: plan.id,
      category: "train",
      title: `High-Speed Express Rail: ${dest} Station`,
      provider: "Renfe AVE",
      confirmationCode: "RNF-3819A",
      passengerName: "Alex Martinez",
      startDate: retDateStr,
      startTime: plan.departureHour || "17:30",
      endDate: retDateStr,
      endTime: "20:45",
      origin: `${dest} Central Station`,
      destination: "Madrid Atocha",
      platform: "Platform 3",
      coach: "Coach 4",
      seat: "Seat 08B",
      status: "confirmed",
      cost: 65.00,
      currency: "EUR",
      qrCodeData: `RENFE-AVE-3819A-COACH4-SEAT08B`,
      barcodeType: "qr",
      notes: "Silent carriage reservation. Power outlets and high-speed Wi-Fi available at seat.",
      createdAt: now - 1000,
      updatedAt: now,
    },
    {
      id: `sample-ins-1-${now}`,
      tripId: plan.id,
      category: "insurance",
      title: "Global Travel & Health Protection",
      provider: "Allianz Global Assistance",
      confirmationCode: "PL-88391024",
      secondaryCode: "24/7 Hotline: +34 91 748 67 00",
      passengerName: "Alex Martinez",
      startDate: depDateStr,
      endDate: retDateStr,
      emergencyPhone: "+34 91 748 67 00",
      coverageSummary: "€150,000 Medical Emergency, Trip Delay & Baggage Loss",
      status: "confirmed",
      cost: 34.00,
      currency: "EUR",
      notes: "Policy active worldwide. Keep policy number ready when contacting the medical coordinator.",
      createdAt: now,
      updatedAt: now,
    },
  ];

  saveTripWalletPasses(plan.id, samplePasses);
  return samplePasses;
}

/**
 * Export passes to standard iCalendar (.ics) format compatible with Apple, Google, and Outlook Calendar
 */
export function exportWalletToICS(passes: TravelBookingPass[], tripTitle: string): void {
  if (!passes || passes.length === 0) return;

  const formatDateToICS = (dateStr: string, timeStr?: string): string => {
    const cleanDate = dateStr.replace(/-/g, "");
    if (!timeStr) return `${cleanDate}T090000Z`;

    // Parse time
    let hours = 9;
    let mins = 0;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      hours = parseInt(match[1], 10);
      mins = parseInt(match[2], 10);
      const meridiem = match[3]?.toUpperCase();
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
    } else {
      const match24 = timeStr.match(/(\d+):(\d+)/);
      if (match24) {
        hours = parseInt(match24[1], 10);
        mins = parseInt(match24[2], 10);
      }
    }

    const hh = String(hours).padStart(2, "0");
    const mm = String(mins).padStart(2, "0");
    return `${cleanDate}T${hh}${mm}00Z`;
  };

  const nowStamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  let icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocalExplorer AI//Travel Wallet & Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${tripTitle} - Travel Wallet Bookings`,
  ];

  passes.forEach((p) => {
    const dtStart = formatDateToICS(p.startDate, p.startTime);
    const dtEnd = p.endDate ? formatDateToICS(p.endDate, p.endTime || p.startTime) : dtStart;

    const descParts = [
      `Confirmation Code: ${p.confirmationCode}`,
      p.secondaryCode ? `Secondary Ref: ${p.secondaryCode}` : "",
      p.seat ? `Seat / Room: ${p.seat}` : "",
      p.gate ? `Gate / Terminal: ${p.terminal || ""} ${p.gate}` : "",
      p.accessPinOrKeycode ? `Access Keycode: ${p.accessPinOrKeycode}` : "",
      p.wifiDetails ? `Wi-Fi: ${p.wifiDetails}` : "",
      p.notes ? `Notes: ${p.notes}` : "",
      "Generated by LocalExplorer AI Travel Wallet",
    ].filter(Boolean).join("\\n");

    icsContent.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@localexplorer.ai`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:[${p.category.toUpperCase()}] ${p.title} (${p.confirmationCode})`,
      `DESCRIPTION:${descParts}`,
      p.address ? `LOCATION:${p.address.replace(/,/g, "\\,")}` : p.origin ? `LOCATION:${p.origin.replace(/,/g, "\\,")}` : "",
      "STATUS:CONFIRMED",
      "END:VEVENT"
    );
  });

  icsContent.push("END:VCALENDAR");

  const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `Travel_Wallet_${tripTitle.replace(/[^a-zA-Z0-9]/g, "_")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export wallet passes to backup JSON
 */
export function exportWalletToJSON(passes: TravelBookingPass[], tripTitle: string): void {
  const exportPayload = {
    app: "LocalExplorer AI Travel Wallet",
    exportedAt: new Date().toISOString(),
    tripTitle,
    passesCount: passes.length,
    passes,
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `travel_wallet_backup_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
