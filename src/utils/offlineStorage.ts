import { ItineraryPlan, OfflineSavedPlan } from "../types";
import { notifyLocalDataChanged } from "./storage";
import { generateSmartPackingList } from "./packingGenerator";

const OFFLINE_PLANS_KEY = "localexplorer_offline_plans_v1";

export function getOfflinePlans(): OfflineSavedPlan[] {
  try {
    const raw = localStorage.getItem(OFFLINE_PLANS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read offline plans from localStorage:", err);
    return [];
  }
}

export function isPlanSavedOffline(planId: string): boolean {
  const plans = getOfflinePlans();
  return plans.some((p) => p.planId === planId);
}

export function getOfflinePlanById(planId: string): OfflineSavedPlan | null {
  const plans = getOfflinePlans();
  return plans.find((p) => p.planId === planId) || null;
}

export function savePlanForOffline(plan: ItineraryPlan, notes?: string): OfflineSavedPlan {
  const plans = getOfflinePlans();
  const existing = plans.find((p) => p.planId === plan.id);

  const entry: OfflineSavedPlan = {
    planId: plan.id,
    savedAt: Date.now(),
    title: plan.title,
    destination: plan.destinationOrTown,
    totalDays: plan.totalDays,
    planData: plan,
    offlineNotes: notes || existing?.offlineNotes || "",
    completedActivityIds: existing?.completedActivityIds || [],
  };

  const updated = [entry, ...plans.filter((p) => p.planId !== plan.id)];
  localStorage.setItem(OFFLINE_PLANS_KEY, JSON.stringify(updated));
  notifyLocalDataChanged();
  return entry;
}

export function removeOfflinePlan(planId: string): void {
  const plans = getOfflinePlans();
  const updated = plans.filter((p) => p.planId !== planId);
  localStorage.setItem(OFFLINE_PLANS_KEY, JSON.stringify(updated));
  notifyLocalDataChanged();
}

export function toggleOfflineActivityCompleted(planId: string, activityId: string): boolean {
  const plans = getOfflinePlans();
  const idx = plans.findIndex((p) => p.planId === planId);
  if (idx === -1) return false;

  const current = plans[idx];
  const exists = current.completedActivityIds.includes(activityId);
  const updatedCompleted = exists
    ? current.completedActivityIds.filter((id) => id !== activityId)
    : [...current.completedActivityIds, activityId];

  plans[idx] = {
    ...current,
    completedActivityIds: updatedCompleted,
  };

  localStorage.setItem(OFFLINE_PLANS_KEY, JSON.stringify(plans));
  notifyLocalDataChanged();
  return !exists;
}

export function updateOfflineNotes(planId: string, notes: string): void {
  const plans = getOfflinePlans();
  const idx = plans.findIndex((p) => p.planId === planId);
  if (idx === -1) return;

  plans[idx] = {
    ...plans[idx],
    offlineNotes: notes,
  };

  localStorage.setItem(OFFLINE_PLANS_KEY, JSON.stringify(plans));
  notifyLocalDataChanged();
}

/**
 * Generates a self-contained, standalone offline HTML file with zero external network
 * dependencies that can be opened in any browser (even in airplane mode).
 */
export function generateOfflineHtml(plan: ItineraryPlan, offlineNotes?: string): string {
  const totalActivities = plan.days.reduce((acc, d) => acc + d.activities.length, 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>📴 ${escapeHtml(plan.title)} - Offline Pocket Companion</title>
  <style>
    :root {
      --bg: #f8f8f5;
      --card-bg: #ffffff;
      --text-main: #1f1f1b;
      --text-muted: #6b6b5e;
      --accent: #5A5A40;
      --accent-light: #ecece4;
      --border: #dcdcd6;
      --success: #2e7d32;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      padding-bottom: 80px;
      line-height: 1.5;
    }
    .header {
      background-color: #2c2c24;
      color: #ffffff;
      padding: 20px 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .badge {
      display: inline-block;
      background-color: rgba(255,255,255,0.15);
      color: #a8d5ba;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 12px;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
      font-family: Georgia, serif;
      font-style: italic;
    }
    .header p {
      font-size: 12px;
      color: #d1d1ca;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      padding: 16px;
    }
    .quick-stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .stat-box {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px;
      text-align: center;
    }
    .stat-val { font-size: 16px; font-weight: 700; color: var(--accent); }
    .stat-lbl { font-size: 10px; color: var(--text-muted); text-transform: uppercase; }
    
    .search-box {
      margin-bottom: 16px;
    }
    .search-input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid var(--border);
      font-size: 14px;
      background: #ffffff;
      outline: none;
    }
    .day-block {
      margin-bottom: 24px;
    }
    .day-header {
      background: var(--accent);
      color: #ffffff;
      padding: 10px 14px;
      border-radius: 12px 12px 0 0;
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-content {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-top: none;
      border-radius: 0 0 12px 12px;
      padding: 12px;
    }
    .day-summary {
      font-size: 13px;
      color: var(--text-muted);
      font-style: italic;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px dashed var(--border);
    }
    .activity-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 10px;
      background: #ffffff;
      transition: all 0.2s;
    }
    .activity-card.checked {
      background: #f0f7f0;
      border-color: #a5d6a7;
      opacity: 0.75;
    }
    .act-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .act-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text-main);
    }
    .act-time {
      font-size: 11px;
      background: var(--accent-light);
      padding: 2px 6px;
      border-radius: 6px;
      font-weight: 600;
      color: var(--accent);
      white-space: nowrap;
    }
    .act-desc {
      font-size: 13px;
      color: #333;
      margin-bottom: 8px;
    }
    .act-tip {
      background: var(--accent-light);
      border-left: 3px solid var(--accent);
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
    }
    .act-tip strong { color: var(--accent); }
    .act-addr {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }
    .check-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #f8f8f5;
      cursor: pointer;
      color: var(--text-main);
    }
    .check-btn.done {
      background: #e8f5e9;
      color: var(--success);
      border-color: #81c784;
    }
    .emergency-box {
      background: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 12px;
      padding: 14px;
      margin-top: 24px;
      font-size: 13px;
    }
    .emergency-box h3 {
      font-size: 14px;
      color: #f57f17;
      margin-bottom: 6px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="badge">📴 Offline Pocket Companion • 100% Offline</div>
    <h1>${escapeHtml(plan.title)}</h1>
    <p>${escapeHtml(plan.destinationOrTown)} • ${plan.totalDays} Days • ${totalActivities} Stops</p>
  </div>

  <div class="container">
    <div class="quick-stats">
      <div class="stat-box">
        <div class="stat-val">${plan.totalDays}</div>
        <div class="stat-lbl">Days</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">${totalActivities}</div>
        <div class="stat-lbl">Activities</div>
      </div>
      <div class="stat-box">
        <div class="stat-val" id="completed-count">0</div>
        <div class="stat-lbl">Visited</div>
      </div>
    </div>

    <div class="search-box">
      <input type="text" id="search-input" class="search-input" placeholder="🔍 Search offline places, tips, categories..." oninput="filterActivities()">
    </div>

    ${plan.accommodation ? `
    <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
      <h3 style="font-size: 13px; color: var(--accent); margin-bottom: 4px;">🏨 Accommodation</h3>
      <p style="font-weight: 700; font-size: 14px;">${escapeHtml(plan.accommodation.name)}</p>
      <p style="font-size: 12px; color: var(--text-muted);">${escapeHtml(plan.accommodation.location)}</p>
    </div>` : ""}

    ${offlineNotes ? `
    <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
      <h3 style="font-size: 13px; color: var(--accent); margin-bottom: 4px;">📝 Traveler Notes</h3>
      <p style="font-size: 13px; white-space: pre-wrap;">${escapeHtml(offlineNotes)}</p>
    </div>` : ""}

    <div id="days-container">
      ${plan.days.map((day) => `
        <div class="day-block" data-day="${day.dayNumber}">
          <div class="day-header">
            <span>${escapeHtml(day.dayTitle)}</span>
            <span style="font-size: 12px; font-weight: normal; opacity: 0.9;">Day ${day.dayNumber}</span>
          </div>
          <div class="day-content">
            ${day.summary ? `<div class="day-summary">"${escapeHtml(day.summary)}"</div>` : ""}
            <div class="activities-list">
              ${day.activities.map((act, actIdx) => `
                <div class="activity-card" id="act-${day.dayNumber}-${actIdx}" data-search="${escapeHtml(act.name + ' ' + act.description + ' ' + act.insiderTip + ' ' + (act.address || ''))}">
                  <div class="act-top">
                    <div class="act-title">${actIdx + 1}. ${escapeHtml(act.name)}</div>
                    <span class="act-time">${escapeHtml(act.time)}</span>
                  </div>
                  <p class="act-desc">${escapeHtml(act.description)}</p>
                  ${act.insiderTip ? `
                    <div class="act-tip">
                      <strong>💡 Tip:</strong> ${escapeHtml(act.insiderTip)}
                    </div>
                  ` : ""}
                  ${act.address ? `<div class="act-addr">📍 ${escapeHtml(act.address)}</div>` : ""}
                  ${act.approxCost ? `<div style="font-size: 11px; font-weight: 600; color: #5A5A40; margin-bottom: 8px;">💰 Cost: ${escapeHtml(act.approxCost)}</div>` : ""}
                  
                  <button class="check-btn" onclick="toggleVisit(this, '${act.id || day.dayNumber + '-' + actIdx}')">
                    <span>⚪</span> Mark as Visited
                  </button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `).join("")}
    </div>

    </div>

    <!-- Smart Packing Checklist Section -->
    <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 12px; padding: 14px; margin-top: 24px; margin-bottom: 20px;">
      <h3 style="font-size: 15px; font-family: Georgia, serif; font-style: italic; color: var(--accent); margin-bottom: 8px;">🧳 Weather-Aware Smart Packing Checklist</h3>
      <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">Tailored gear checklist based on weather & itinerary stops:</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 8px;">
        ${generateSmartPackingList(plan).map((pItem) => `
          <div style="padding: 8px 10px; border: 1px solid #e5e5df; border-radius: 8px; font-size: 12px; background: #fafaf7; display: flex; items-center; justify-content: space-between;">
            <div>
              <strong style="color: #2c2c24;">${escapeHtml(pItem.item)}</strong>
              ${pItem.reason ? `<div style="font-size: 10px; color: #8a8a7e;">${escapeHtml(pItem.reason)}</div>` : ""}
            </div>
            <span style="font-size: 10px; padding: 2px 6px; background: #ecece4; border-radius: 4px; color: #5A5A40; height: fit-content; text-transform: uppercase; font-weight: bold;">${pItem.category}</span>
          </div>
        `).join("")}
      </div>
    </div>

    <!-- Local Essentials & Emergency Cheat-Sheet Section -->
    <div class="emergency-box" style="margin-top: 20px;">
      <h3 style="font-family: Georgia, serif; font-style: italic;">🚨 Local Essentials & Emergency Cheat-Sheet</h3>
      <div style="margin-top: 8px; font-size: 13px; line-height: 1.6;">
        <p>• <strong>General Emergency (EU / Spain):</strong> 112</p>
        <p>• <strong>Medical / Ambulance:</strong> 061</p>
        <p>• <strong>Local Police (Policía Local):</strong> 092</p>
        <p>• <strong>National Police / Guardia Civil:</strong> 091</p>
      </div>

      <div style="margin-top: 14px; pt: 10px; border-top: 1px border #ffe082;">
        <h4 style="font-size: 13px; font-weight: 700; color: #d76d00; margin-bottom: 6px;">🍽️ Local Etiquette & Tipping</h4>
        <p style="font-size: 12px; color: #333;"><strong>Tipping:</strong> Optional. Round up or 5–10% for exceptional service. Service charge (IVA) is included.</p>
        <p style="font-size: 12px; color: #333; margin-top: 4px;"><strong>Mealtimes:</strong> Lunch: 1:30 PM – 4:00 PM. Dinner: 8:30 PM – 11:00 PM.</p>
        <p style="font-size: 12px; color: #333; margin-top: 4px;"><strong>Tap Water:</strong> Tap water ("agua del grifo") is 100% safe to drink.</p>
      </div>

      <div style="margin-top: 14px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #d76d00; margin-bottom: 6px;">⚡ Power Plugs & Utilities</h4>
        <p style="font-size: 12px; color: #333;"><strong>Voltage:</strong> 230V / 50Hz • <strong>Plugs:</strong> Type C & Type F Europlug standard.</p>
      </div>

      <div style="margin-top: 14px;">
        <h4 style="font-size: 13px; font-weight: 700; color: #d76d00; margin-bottom: 6px;">🗣️ Essential Survival Phrases</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; font-size: 12px; margin-top: 6px;">
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>¡Ayuda!</strong> (Help!)</div>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>Hola / Kaixo</strong> (Hello)</div>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>Muchas gracias</strong> (Thank you)</div>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>La cuenta, por favor</strong> (The bill, please)</div>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>¿Dónde está...?</strong> (Where is...?)</div>
          <div style="background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #ffe082;"><strong>¿Habla inglés?</strong> (Do you speak English?)</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const completedSet = new Set(JSON.parse(localStorage.getItem('offline_visited_${plan.id}') || '[]'));
    
    function updateCounter() {
      document.getElementById('completed-count').textContent = completedSet.size;
    }

    function initVisited() {
      completedSet.forEach(id => {
        const btn = document.querySelector('[onclick*="' + id + '"]');
        if (btn) {
          btn.classList.add('done');
          btn.innerHTML = '<span>✅</span> Visited';
          btn.closest('.activity-card')?.classList.add('checked');
        }
      });
      updateCounter();
    }

    function toggleVisit(btn, id) {
      if (completedSet.has(id)) {
        completedSet.delete(id);
        btn.classList.remove('done');
        btn.innerHTML = '<span>⚪</span> Mark as Visited';
        btn.closest('.activity-card')?.classList.remove('checked');
      } else {
        completedSet.add(id);
        btn.classList.add('done');
        btn.innerHTML = '<span>✅</span> Visited';
        btn.closest('.activity-card')?.classList.add('checked');
      }
      localStorage.setItem('offline_visited_${plan.id}', JSON.stringify(Array.from(completedSet)));
      updateCounter();
    }

    function filterActivities() {
      const q = document.getElementById('search-input').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.activity-card');
      cards.forEach(card => {
        const text = (card.getAttribute('data-search') || '').toLowerCase();
        if (!q || text.includes(q)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    }

    document.addEventListener('DOMContentLoaded', initVisited);
    if (document.readyState !== 'loading') initVisited();
  </script>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function downloadOfflinePackage(plan: ItineraryPlan, notes?: string): void {
  const html = generateOfflineHtml(plan, notes);
  const cleanTitle = plan.destinationOrTown.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  const filename = `${cleanTitle}_offline_pocket_guide.html`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
