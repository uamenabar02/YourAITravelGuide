import { ActivitySpot, TransitInfo } from "../types";
import { perfCache } from "./performanceCache";

/**
 * Haversine formula to compute distance in kilometers between two lat/lng points.
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const cacheKey = `dist_${lat1.toFixed(4)}_${lon1.toFixed(4)}_${lat2.toFixed(4)}_${lon2.toFixed(4)}`;
  const cachedDist = perfCache.get<number>(cacheKey);
  if (cachedDist !== null) return cachedDist;

  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const result = R * c;
  perfCache.set(cacheKey, result, 1000 * 60 * 60 * 48);
  return result;
}

export interface DynamicRouteInfo extends TransitInfo {
  googleMapsDirectionsUrl: string;
}

/**
 * Get or dynamically compute transit route information between two spots.
 */
export function getRouteInfoBetweenSpots(
  fromSpot: ActivitySpot,
  toSpot: ActivitySpot,
  destination: string
): DynamicRouteInfo {
  const cacheKey = `route_${fromSpot.id || fromSpot.name}_${toSpot.id || toSpot.name}_${destination}`;
  const cachedRoute = perfCache.get<DynamicRouteInfo>(cacheKey);
  if (cachedRoute) return cachedRoute;

  const originLat = fromSpot.coordinates?.lat;
  const originLng = fromSpot.coordinates?.lng;
  const destLat = toSpot.coordinates?.lat;
  const destLng = toSpot.coordinates?.lng;

  let originParam = "";
  if (originLat && originLng) {
    originParam = `${originLat},${originLng}`;
  } else {
    originParam = encodeURIComponent(`${fromSpot.name}, ${destination}`);
  }

  let destParam = "";
  if (destLat && destLng) {
    destParam = `${destLat},${destLng}`;
  } else {
    destParam = encodeURIComponent(`${toSpot.name}, ${destination}`);
  }

  // Pre-calculated or custom transit if available
  if (fromSpot.transitToNext) {
    const travelmode =
      fromSpot.transitToNext.mode === "walk"
        ? "walking"
        : fromSpot.transitToNext.mode === "transit"
        ? "transit"
        : "driving";

    return {
      ...fromSpot.transitToNext,
      googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${travelmode}`,
    };
  }

  // Fallback: Compute dynamic distance & travel mode
  if (originLat && originLng && destLat && destLng) {
    const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);

    let mode: "walk" | "transit" | "drive" | "taxi" = "walk";
    let durationMins = 0;
    let distanceStr = "";
    let travelmodeParam = "walking";

    if (distKm <= 1.2) {
      mode = "walk";
      travelmodeParam = "walking";
      durationMins = Math.max(3, Math.round((distKm / 4.8) * 60)); // ~4.8 km/h walking speed
      distanceStr = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
    } else if (distKm <= 5.0) {
      mode = "transit";
      travelmodeParam = "transit";
      durationMins = Math.max(8, Math.round((distKm / 18) * 60) + 4);
      distanceStr = `${distKm.toFixed(1)} km`;
    } else {
      mode = "drive";
      travelmodeParam = "driving";
      durationMins = Math.max(10, Math.round((distKm / 35) * 60) + 5);
      distanceStr = `${distKm.toFixed(1)} km`;
    }

    const durationStr =
      mode === "walk"
        ? `${durationMins} min walk`
        : mode === "transit"
        ? `${durationMins} min transit`
        : `${durationMins} min drive/taxi`;

    const result: DynamicRouteInfo = {
      mode,
      duration: durationStr,
      distance: distanceStr,
      instructions: `Direct connection from ${fromSpot.name} to ${toSpot.name}`,
      googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${travelmodeParam}`,
    };
    perfCache.set(cacheKey, result, 1000 * 60 * 60 * 48);
    return result;
  }

  // Absolute fallback if coordinates missing
  const fallbackResult: DynamicRouteInfo = {
    mode: "walk",
    duration: "10 min connection",
    distance: "Nearby",
    instructions: `Navigate from ${fromSpot.name} to ${toSpot.name}`,
    googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=walking`,
  };
  perfCache.set(cacheKey, fallbackResult, 1000 * 60 * 60 * 48);
  return fallbackResult;
}

/**
 * Generates a Google Maps directions URL linking the entire sequence of activities for a day.
 */
export function getEntireDayRouteGoogleMapsUrl(
  activities: ActivitySpot[],
  destination: string
): string {
  if (!activities || activities.length === 0) return "";
  
  if (activities.length === 1) {
    const spot = activities[0];
    const coords = spot.coordinates;
    if (coords && coords.lat && coords.lng) {
      return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${spot.name}, ${destination}`)}`;
  }

  const formatSpotParam = (spot: ActivitySpot): string => {
    if (spot.coordinates && spot.coordinates.lat && spot.coordinates.lng) {
      return `${spot.coordinates.lat},${spot.coordinates.lng}`;
    }
    return encodeURIComponent(`${spot.name}, ${destination}`);
  };

  const origin = formatSpotParam(activities[0]);
  const destinationParam = formatSpotParam(activities[activities.length - 1]);

  let waypointsParam = "";
  if (activities.length > 2) {
    // Google Maps supports up to 9 waypoints in standard query mode, which is plenty.
    const waypoints = activities.slice(1, -1).map(formatSpotParam);
    waypointsParam = `&waypoints=${waypoints.join("|")}`;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destinationParam}${waypointsParam}`;
}

