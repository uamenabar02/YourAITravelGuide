import { DailyPlan, ActivitySpot, ScheduleShiftResult, ScheduleShiftOptions } from "../types";
import { parseTimeToHours, formatHoursTo12 } from "./time";

/**
 * Shifts a single time slot by a given number of minutes.
 * Handles ranges ("09:30 AM - 11:00 AM") and single times ("14:00").
 */
export function shiftTimeSlotString(timeStr: string, minutesToShift: number): string {
  if (!timeStr || minutesToShift === 0) return timeStr;

  const parts = timeStr.split(/\s+[-–—]\s+|\s+to\s+/i);
  const shiftInHours = minutesToShift / 60;

  if (parts.length >= 2) {
    const startH = parseTimeToHours(parts[0]);
    const endH = parseTimeToHours(parts[1]);

    const newStartH = Math.max(6, Math.min(23.75, startH + shiftInHours));
    const duration = Math.max(0.5, endH - startH);
    const newEndH = Math.max(newStartH + 0.25, Math.min(23.9, newStartH + duration));

    return `${formatHoursTo12(newStartH)} - ${formatHoursTo12(newEndH)}`;
  }

  // Single time token or keyword
  const singleH = parseTimeToHours(timeStr);
  const newH = Math.max(6, Math.min(23.75, singleH + shiftInHours));
  return formatHoursTo12(newH);
}

/**
 * Shifts activities in a DailyPlan by a delta in minutes, optionally starting from a chosen activity.
 * Activities prior to the start activity remain at their original scheduled times.
 */
export function shiftDaySchedule(
  day: DailyPlan,
  delayMinutes: number,
  options: ScheduleShiftOptions = {}
): ScheduleShiftResult {
  const originalDay = JSON.parse(JSON.stringify(day)) as DailyPlan;

  // Determine which activity index to start applying the delay from
  let startIndex = 0;
  if (typeof options.startActivityIndex === "number" && options.startActivityIndex >= 0) {
    startIndex = options.startActivityIndex;
  } else if (options.startActivityId) {
    const foundIdx = day.activities.findIndex((a) => a.id === options.startActivityId);
    if (foundIdx !== -1) {
      startIndex = foundIdx;
    }
  }

  if (delayMinutes === 0) {
    return {
      updatedDay: originalDay,
      originalDay,
      delayMinutes: 0,
      startActivityIndex: startIndex,
      warnings: [],
      shiftedActivitiesCount: 0,
    };
  }

  const warnings: string[] = [];
  let cumulativeShift = delayMinutes;
  let shiftedCount = 0;

  const updatedActivities: ActivitySpot[] = day.activities.map((act, idx) => {
    // If before the delay starting point, keep exact original time
    if (idx < startIndex) {
      return { ...act };
    }

    shiftedCount++;

    // If compress mode is on and we are behind schedule, reduce subsequent durations slightly
    if (options.compressDurations && delayMinutes > 0 && idx > startIndex) {
      cumulativeShift = Math.max(15, cumulativeShift - 10);
    }

    const newTime = shiftTimeSlotString(act.time, cumulativeShift);
    const startH = parseTimeToHours(newTime);
    const cat = act.category;
    const nameLower = act.name.toLowerCase();

    // 1. Sunset / Scenic viewpoint warning
    if (
      (nameLower.includes("sunset") ||
        nameLower.includes("viewpoint") ||
        nameLower.includes("lookout") ||
        nameLower.includes("mirador") ||
        nameLower.includes("mount") ||
        nameLower.includes("urgull") ||
        nameLower.includes("concha")) &&
      startH > 20.75
    ) {
      warnings.push(`🌅 "${act.name}" is now shifted past dusk (~${formatHoursTo12(startH)}). Views might be dark.`);
    }

    // 2. Cultural / Museum closing hours warning (typically 19:00 - 20:00)
    if (
      (cat === "culture" || nameLower.includes("museum") || nameLower.includes("gallery") || nameLower.includes("castle")) &&
      startH >= 19.5
    ) {
      warnings.push(`🏛️ "${act.name}" may close before or during your visit (~${formatHoursTo12(startH)}). Check closing hours.`);
    }

    // 3. Lunch hours in Spain / Southern Europe (typically closes by 15:30 - 16:00)
    if (
      cat === "food" &&
      (nameLower.includes("lunch") || nameLower.includes("comida") || nameLower.includes("menu del dia")) &&
      startH > 16.0
    ) {
      warnings.push(`🥘 Spanish lunch kitchens often close by 16:00. "${act.name}" may only serve pintxos/snacks.`);
    }

    // 4. Late night transport warning
    if (startH >= 23.5) {
      warnings.push(`🌙 "${act.name}" ends near midnight. Double check public transit schedules or pre-order a taxi.`);
    }

    return {
      ...act,
      time: newTime,
    };
  });

  const updatedDay: DailyPlan = {
    ...day,
    activities: updatedActivities,
  };

  return {
    updatedDay,
    originalDay,
    delayMinutes,
    startActivityIndex: startIndex,
    warnings: Array.from(new Set(warnings)),
    shiftedActivitiesCount: shiftedCount,
  };
}
