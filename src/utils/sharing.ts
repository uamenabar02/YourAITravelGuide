import { ItineraryPlan } from "../types";
import { parseTimeToHours } from "./time";

export function generateShareableUrl(plan: ItineraryPlan): string {
  try {
    const jsonStr = JSON.stringify(plan);
    const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    const url = new URL(window.location.href);
    url.searchParams.set("trip", encoded);
    return url.toString();
  } catch (err) {
    console.error("Failed to generate shareable URL:", err);
    return window.location.href;
  }
}

export function parseShareableUrl(): ItineraryPlan | null {
  try {
    const url = new URL(window.location.href);
    const param = url.searchParams.get("trip");
    if (!param) return null;
    const decoded = decodeURIComponent(escape(atob(decodeURIComponent(param))));
    const parsed = JSON.parse(decoded);

    // Shape validation: a corrupted / truncated payload must never crash the app
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.days) || parsed.days.length === 0) return null;
    if (!parsed.mode || !parsed.destinationOrTown) return null;
    parsed.days.forEach((day: any) => {
      if (!Array.isArray(day.activities)) day.activities = [];
    });
    if (!parsed.mapCenter || typeof parsed.mapCenter.lat !== "number") {
      parsed.mapCenter = { lat: 43.3183, lng: -1.9812 };
      parsed.mapZoom = parsed.mapZoom || 13;
    }
    return parsed as ItineraryPlan;
  } catch (err) {
    console.error("Failed to parse trip from URL:", err);
    return null;
  }
}

export function generateMarkdownItinerary(plan: ItineraryPlan): string {
  let md = `# 🧭 ${plan.title}\n\n`;
  md += `**Destination / Area:** ${plan.destinationOrTown}\n`;
  md += `**Mode:** ${plan.mode === 'vacation' ? 'Vacation Itinerary' : 'Hometown Local Guide'}\n`;
  md += `**Summary:** ${plan.summary}\n\n`;

  if (plan.highlights && plan.highlights.length > 0) {
    md += `### ✨ Highlights\n`;
    plan.highlights.forEach((h) => {
      md += `- ${h}\n`;
    });
    md += `\n`;
  }

  plan.days.forEach((day) => {
    md += `## 📅 ${day.dayTitle}\n`;
    md += `*Theme: ${day.theme}*\n`;
    md += `*${day.summary}*\n`;
    if (day.estimatedTotalBudget) {
      md += `*Estimated Daily Budget: ${day.estimatedTotalBudget}*\n\n`;
    } else {
      md += `\n`;
    }

    day.activities.forEach((act, idx) => {
      md += `### ${idx + 1}. ${act.name} (${act.time})\n`;
      md += `- **Category:** ${act.category.toUpperCase()}\n`;
      md += `- **Approx Cost:** ${act.approxCost}\n`;
      md += `- **Description:** ${act.description}\n`;
      md += `- **💡 Insider Tip:** ${act.insiderTip}\n`;
      if (act.address) {
        md += `- **Location:** ${act.address}\n`;
      }
      md += `\n`;
    });
  });

  md += `---\n*Generated with LocalExplorer AI*`;
  return md;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- RFC 5545 (iCalendar) helpers -----------------------------------------

/** Escape TEXT values per RFC 5545 (backslash, semicolon, comma, newlines). */
function escapeIcsText(text: string): string {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Format a Date as a local "floating" iCalendar date-time (no UTC shift). */
function formatIcsLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/** UTC date-time (required for DTSTAMP). */
function formatIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/** Fold content lines to max 75 octets as required by RFC 5545. */
function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  let first = true;
  while (rest.length > 0) {
    const take = first ? 75 : 74; // continuation lines start with a space
    parts.push(first ? rest.slice(0, take) : " " + rest.slice(0, take));
    rest = rest.slice(take);
    first = false;
  }
  return parts.join("\r\n");
}

export function exportToICS(plan: ItineraryPlan): void {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocalExplorer AI//Trip Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(plan.title)}`,
  ];

  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow default

  plan.days.forEach((day, dayIndex) => {
    const currentDayDate = new Date(startDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);

    day.activities.forEach((act) => {
      // Use the actual scheduled start time instead of a synthetic 3h grid.
      const startHours = parseTimeToHours(act.time);
      const dtStart = new Date(currentDayDate);
      dtStart.setHours(Math.floor(startHours), Math.round((startHours % 1) * 60), 0, 0);

      const durationMin = act.durationMinutes && act.durationMinutes > 0 ? act.durationMinutes : 90;
      const dtEnd = new Date(dtStart.getTime() + durationMin * 60 * 1000);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:act-${day.dayNumber}-${act.id}-${Date.now()}@localexplorer.ai`);
      lines.push(`DTSTAMP:${formatIcsUtc(now)}`);
      lines.push(`DTSTART:${formatIcsLocal(dtStart)}`);
      lines.push(`DTEND:${formatIcsLocal(dtEnd)}`);
      lines.push(`SUMMARY:${escapeIcsText(`${act.name} (${plan.destinationOrTown})`)}`);
      lines.push(
        `DESCRIPTION:${escapeIcsText(
          `${act.description}\n\nTip: ${act.insiderTip}\nCost: ${act.approxCost}`
        )}`
      );
      lines.push(`LOCATION:${escapeIcsText(act.address || plan.destinationOrTown)}`);
      lines.push("STATUS:CONFIRMED");
      lines.push("END:VEVENT");
    });
  });

  lines.push("END:VCALENDAR");

  // CRLF line endings + 75-octet folding per RFC 5545
  const ics = lines.map(foldIcsLine).join("\r\n");
  const cleanTitle = plan.destinationOrTown.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  downloadFile(ics, `${cleanTitle}_itinerary.ics`, "text/calendar;charset=utf-8");
}
