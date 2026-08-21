import { ItineraryPlan } from "../types";

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
    return JSON.parse(decoded);
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

export function exportToICS(plan: ItineraryPlan): void {
  let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//LocalExplorer AI//Trip Planner//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";

  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow default

  plan.days.forEach((day, dayIndex) => {
    const currentDayDate = new Date(startDate.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    
    day.activities.forEach((act, actIndex) => {
      const startHour = 9 + actIndex * 3;
      const dtStart = new Date(currentDayDate);
      dtStart.setHours(startHour, 0, 0, 0);

      const dtEnd = new Date(currentDayDate);
      dtEnd.setHours(startHour + 2, 0, 0, 0);

      const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      ics += "BEGIN:VEVENT\n";
      ics += `UID:act-${day.dayNumber}-${act.id}-${Date.now()}@localexplorer.ai\n`;
      ics += `DTSTAMP:${formatDate(now)}\n`;
      ics += `DTSTART:${formatDate(dtStart)}\n`;
      ics += `DTEND:${formatDate(dtEnd)}\n`;
      ics += `SUMMARY:${act.name} (${plan.destinationOrTown})\n`;
      ics += `DESCRIPTION:${act.description.replace(/\n/g, " ")} \\n\\nTip: ${act.insiderTip.replace(/\n/g, " ")}\\nCost: ${act.approxCost}\n`;
      ics += `LOCATION:${act.address || plan.destinationOrTown}\n`;
      ics += "STATUS:CONFIRMED\n";
      ics += "END:VEVENT\n";
    });
  });

  ics += "END:VCALENDAR";
  const cleanTitle = plan.destinationOrTown.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  downloadFile(ics, `${cleanTitle}_itinerary.ics`, "text/calendar;charset=utf-8");
}
