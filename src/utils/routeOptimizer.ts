import { ActivitySpot, TransportMode, TransitInfo } from "../types";
import { calculateDistanceKm } from "./transit";

export interface OptimizedRouteResult {
  orderedActivities: ActivitySpot[];
  originalDistanceKm: number;
  optimizedDistanceKm: number;
  originalTravelTimeMinutes: number;
  optimizedTravelTimeMinutes: number;
  distanceSavedKm: number;
  timeSavedMinutes: number;
  isImproved: boolean;
  legs: {
    from: string;
    to: string;
    distanceKm: number;
    travelMinutes: number;
    mode: 'walk' | 'transit' | 'drive' | 'bicycle';
    isExcursionLeg: boolean;
  }[];
}

export interface RouteOptimizationOptions {
  transportMode: TransportMode | 'walking' | 'auto';
  lockStartSpot?: boolean;
  lockEndSpot?: boolean;
  lockedActivityIds?: string[];
  preserveMealTimes?: boolean;
}

/**
 * Returns travel minutes between two coordinates based on transport mode and distance.
 */
export function estimateLegTimeMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: TransportMode | 'walking' | 'auto'
): { travelMinutes: number; legMode: 'walk' | 'transit' | 'drive' | 'bicycle'; distanceKm: number } {
  const distKm = calculateDistanceKm(lat1, lng1, lat2, lng2);

  if (distKm <= 0.05) {
    return { travelMinutes: 2, legMode: 'walk', distanceKm: distKm };
  }

  // Determine effective mode and compare walk vs vehicle for urban practicality
  let effectiveMode: 'walk' | 'transit' | 'drive' | 'bicycle' = 'walk';
  if (mode === 'car' || mode === 'taxi') {
    // In urban centers, driving for short distances (< 1.0 km) is often slower due to parking, one-way streets, and traffic buffers (6-8 mins)
    // A 400m walk is ~6 min, whereas driving is ~6 min parking buffer + ~2 min drive.
    effectiveMode = distKm <= 0.9 ? 'walk' : 'drive';
  } else if (mode === 'bicycle') {
    // For very short trips (< 250m), walking directly is faster than unlocking/locking a bike
    effectiveMode = distKm <= 0.25 ? 'walk' : 'bicycle';
  } else if (mode === 'public_transit') {
    effectiveMode = distKm <= 1.0 ? 'walk' : 'transit';
  } else if (mode === 'walking') {
    effectiveMode = 'walk';
  } else {
    // Auto mode
    if (distKm <= 1.2) effectiveMode = 'walk';
    else if (distKm <= 8) effectiveMode = 'transit';
    else effectiveMode = 'drive';
  }

  let travelMinutes = 0;
  switch (effectiveMode) {
    case 'walk':
      // Average walking speed 4.5 km/h + 2 min buffer
      travelMinutes = Math.round((distKm / 4.5) * 60) + 2;
      break;
    case 'bicycle':
      // Average cycling speed 15 km/h + 3 min buffer
      travelMinutes = Math.round((distKm / 15) * 60) + 3;
      break;
    case 'transit':
      // Urban transit with 6 min waiting/transfer overhead
      travelMinutes = Math.round((distKm / 28) * 60) + 8;
      break;
    case 'drive':
      // Driving speed (urban/highway mix) + 4 min parking/traffic buffer
      if (distKm <= 5) {
        travelMinutes = Math.round((distKm / 25) * 60) + 6;
      } else {
        travelMinutes = Math.round((distKm / 55) * 60) + 8;
      }
      break;
  }

  return { travelMinutes: Math.max(3, travelMinutes), legMode: effectiveMode, distanceKm: distKm };
}

/**
 * Calculates total route metrics for a given sequence of activities.
 */
export function calculateRouteMetrics(
  activities: ActivitySpot[],
  mode: TransportMode | 'walking' | 'auto'
): { totalDistanceKm: number; totalMinutes: number; legs: OptimizedRouteResult['legs'] } {
  let totalDistanceKm = 0;
  let totalMinutes = 0;
  const legs: OptimizedRouteResult['legs'] = [];

  for (let i = 0; i < activities.length - 1; i++) {
    const a = activities[i];
    const b = activities[i + 1];

    const lat1 = a.coordinates?.lat ?? 0;
    const lng1 = a.coordinates?.lng ?? 0;
    const lat2 = b.coordinates?.lat ?? 0;
    const lng2 = b.coordinates?.lng ?? 0;

    if (lat1 !== 0 && lng1 !== 0 && lat2 !== 0 && lng2 !== 0) {
      const legEst = estimateLegTimeMinutes(lat1, lng1, lat2, lng2, mode);
      totalDistanceKm += legEst.distanceKm;
      totalMinutes += legEst.travelMinutes;

      // Detect if this is an out-of-town excursion leg (> 10 km)
      const isExcursionLeg = legEst.distanceKm >= 10;

      legs.push({
        from: a.name,
        to: b.name,
        distanceKm: Number(legEst.distanceKm.toFixed(2)),
        travelMinutes: legEst.travelMinutes,
        mode: legEst.legMode,
        isExcursionLeg,
      });
    }
  }

  return {
    totalDistanceKm: Number(totalDistanceKm.toFixed(2)),
    totalMinutes,
    legs,
  };
}

/**
 * Checks if an activity is category-anchored to a specific time of day (meals/nightlife).
 */
function isMealOrNightAnchor(activity: ActivitySpot): boolean {
  const cat = (activity.category || '').toLowerCase();
  const name = (activity.name || '').toLowerCase();
  const desc = (activity.description || '').toLowerCase();

  return (
    cat === 'food' ||
    cat === 'nightlife' ||
    name.includes('breakfast') ||
    name.includes('lunch') ||
    name.includes('dinner') ||
    name.includes('desayuno') ||
    name.includes('almuerzo') ||
    name.includes('comida') ||
    name.includes('cena') ||
    desc.includes('dinner') ||
    desc.includes('lunch')
  );
}

/**
 * Multi-Modal Route Optimizer Engine with Excursion & Anchor Awareness.
 */
export function optimizeDayRoute(
  activities: ActivitySpot[],
  options: RouteOptimizationOptions
): OptimizedRouteResult {
  if (activities.length <= 2) {
    const metrics = calculateRouteMetrics(activities, options.transportMode);
    return {
      orderedActivities: activities,
      originalDistanceKm: metrics.totalDistanceKm,
      optimizedDistanceKm: metrics.totalDistanceKm,
      originalTravelTimeMinutes: metrics.totalMinutes,
      optimizedTravelTimeMinutes: metrics.totalMinutes,
      distanceSavedKm: 0,
      timeSavedMinutes: 0,
      isImproved: false,
      legs: metrics.legs,
    };
  }

  const originalMetrics = calculateRouteMetrics(activities, options.transportMode);
  const lockedIds = new Set(options.lockedActivityIds || []);

  if (options.lockStartSpot && activities[0]) {
    lockedIds.add(activities[0].id);
  }
  if (options.lockEndSpot && activities[activities.length - 1]) {
    lockedIds.add(activities[activities.length - 1].id);
  }

  // Step 1: Detect Clusters (Base Urban Area vs Outlying Excursion)
  const coordsList = activities
    .map((a) => a.coordinates)
    .filter((c): c is { lat: number; lng: number } => !!c && c.lat !== 0 && c.lng !== 0);

  let centerLat = 0;
  let centerLng = 0;
  if (coordsList.length > 0) {
    centerLat = coordsList.reduce((sum, c) => sum + c.lat, 0) / coordsList.length;
    centerLng = coordsList.reduce((sum, c) => sum + c.lng, 0) / coordsList.length;
  }

  // Classify each activity as base or excursion
  interface TaggedActivity {
    activity: ActivitySpot;
    isExcursion: boolean;
    isLocked: boolean;
    isAnchor: boolean;
    originalIndex: number;
  }

  const tagged: TaggedActivity[] = activities.map((act, idx) => {
    const lat = act.coordinates?.lat || centerLat;
    const lng = act.coordinates?.lng || centerLng;
    const distFromCenter = calculateDistanceKm(lat, lng, centerLat, centerLng);

    return {
      activity: act,
      isExcursion: distFromCenter > 12, // More than 12 km from centroid -> Excursion cluster
      isLocked: lockedIds.has(act.id) || (idx === 0 && options.lockStartSpot) || (idx === activities.length - 1 && options.lockEndSpot),
      isAnchor: options.preserveMealTimes ? isMealOrNightAnchor(act) : false,
      originalIndex: idx,
    };
  });

  // Step 2: 2-Opt TSP Algorithm with constraints
  let currentOrder = [...activities];
  let bestOrder = [...activities];
  let bestMetrics = originalMetrics;

  const maxPermutations = Math.min(120, activities.length * 20);

  for (let iteration = 0; iteration < maxPermutations; iteration++) {
    for (let i = 0; i < activities.length - 1; i++) {
      for (let k = i + 1; k < activities.length; k++) {
        // Skip if locked
        if (options.lockStartSpot && i === 0) continue;
        if (options.lockEndSpot && k === activities.length - 1) continue;

        const actA = currentOrder[i];
        const actB = currentOrder[k];

        if (lockedIds.has(actA.id) || lockedIds.has(actB.id)) {
          continue;
        }

        // Do not move meal anchors across extreme temporal boundaries (e.g. morning vs evening)
        if (options.preserveMealTimes) {
          const taggedA = tagged.find((t) => t.activity.id === actA.id);
          const taggedB = tagged.find((t) => t.activity.id === actB.id);
          if (taggedA?.isAnchor && Math.abs(i - taggedA.originalIndex) > 1) continue;
          if (taggedB?.isAnchor && Math.abs(k - taggedB.originalIndex) > 1) continue;
        }

        // Apply 2-opt swap
        const candidate = [
          ...currentOrder.slice(0, i),
          ...currentOrder.slice(i, k + 1).reverse(),
          ...currentOrder.slice(k + 1),
        ];

        const candidateMetrics = calculateRouteMetrics(candidate, options.transportMode);

        if (
          candidateMetrics.totalMinutes < bestMetrics.totalMinutes ||
          (candidateMetrics.totalMinutes === bestMetrics.totalMinutes &&
            candidateMetrics.totalDistanceKm < bestMetrics.totalDistanceKm)
        ) {
          bestMetrics = candidateMetrics;
          bestOrder = candidate;
          currentOrder = candidate;
        }
      }
    }
  }

  // Step 3: Resequence Timestamps smoothly
  const resequencedActivities = bestOrder.map((act, idx) => {
    // Preserve the original timeslots smoothly
    const originalTime = activities[idx]?.time || act.time;
    return {
      ...act,
      time: originalTime,
    };
  });

  const distanceSaved = Number(Math.max(0, originalMetrics.totalDistanceKm - bestMetrics.totalDistanceKm).toFixed(2));
  const timeSaved = Math.max(0, originalMetrics.totalMinutes - bestMetrics.totalMinutes);

  return {
    orderedActivities: resequencedActivities,
    originalDistanceKm: originalMetrics.totalDistanceKm,
    optimizedDistanceKm: bestMetrics.totalDistanceKm,
    originalTravelTimeMinutes: originalMetrics.totalMinutes,
    optimizedTravelTimeMinutes: bestMetrics.totalMinutes,
    distanceSavedKm: distanceSaved,
    timeSavedMinutes: timeSaved,
    isImproved: distanceSaved >= 0.2 || timeSaved >= 5,
    legs: bestMetrics.legs,
  };
}

