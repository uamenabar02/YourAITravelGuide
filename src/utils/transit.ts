import { ActivitySpot, TransitInfo, TransportMode } from "../types";
import { perfCache } from "./performanceCache";

/**
 * Formats an ActivitySpot into a clean, precise location query parameter for Google Maps.
 * Cleans titles (removing "(Option A)", subtitle extensions, etc.), includes full street address & city,
 * so Google Maps opens the exact POI / venue listing rather than a raw or snapped off-center GPS coordinate.
 */
export function formatSpotForGoogleMaps(
  spot: ActivitySpot | { name?: string; address?: string; coordinates?: { lat: number; lng: number } },
  destination: string
): string {
  if (!spot) return encodeURIComponent(destination || "");

  const rawName = spot.name || "";
  const address = spot.address || "";

  // Clean title: remove parentheticals like "(Option A)", "(Famous for...)"
  // and subtitle extensions after " - " or " : "
  const cleanName = rawName
    .replace(/[\(（].*?[\)）]/g, "")
    .replace(/\s*[-–—:]\s*.*$/, "")
    .trim();

  // Check if name is generic (e.g. "Custom Pin", "Selected Spot", "Map Point")
  const isGenericName =
    !cleanName ||
    /^(custom|selected|pinned|map|location|point|gps|marker)\b/i.test(cleanName);

  // If generic name and coordinates exist, use lat,lng
  if (isGenericName && spot.coordinates?.lat && spot.coordinates?.lng) {
    return `${spot.coordinates.lat},${spot.coordinates.lng}`;
  }

  const parts: string[] = [];
  if (cleanName) {
    parts.push(cleanName);
  }

  if (address && address.trim()) {
    const cleanAddr = address.trim();
    if (!cleanName.toLowerCase().includes(cleanAddr.toLowerCase())) {
      parts.push(cleanAddr);
    }
  }

  if (destination && destination.trim()) {
    const cleanDest = destination.trim();
    const fullTextSoFar = parts.join(" ").toLowerCase();
    if (!fullTextSoFar.includes(cleanDest.toLowerCase())) {
      parts.push(cleanDest);
    }
  }

  const queryText = parts.join(", ");
  return encodeURIComponent(queryText);
}

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
  destination: string,
  allowedModes?: TransportMode[]
): DynamicRouteInfo {
  const modesList = Array.isArray(allowedModes) && allowedModes.length > 0
    ? allowedModes
    : ["public_transit", "walking"];
  const isWalkingOnly = modesList.length === 1 && modesList[0] === "walking";
  const allowsTransit = modesList.includes("public_transit");
  const allowsCar = modesList.includes("car");
  const allowsBicycle = modesList.includes("bicycle");

  const cacheKey = `route_${fromSpot.id || fromSpot.name}_${toSpot.id || toSpot.name}_${destination}_${modesList.join("_")}`;
  const cachedRoute = perfCache.get<DynamicRouteInfo>(cacheKey);
  if (cachedRoute) return cachedRoute;

  const originParam = formatSpotForGoogleMaps(fromSpot, destination);
  const destParam = formatSpotForGoogleMaps(toSpot, destination);

  const originLat = fromSpot.coordinates?.lat;
  const originLng = fromSpot.coordinates?.lng;
  const destLat = toSpot.coordinates?.lat;
  const destLng = toSpot.coordinates?.lng;

  // Pre-calculated or custom transit if available
  if (fromSpot.transitToNext) {
    if (isWalkingOnly && (fromSpot.transitToNext.mode === "transit" || fromSpot.transitToNext.mode === "drive")) {
      // Ignore motorized transit for walking-only
    } else {
      const travelmode =
        fromSpot.transitToNext.mode === "walk"
          ? "walking"
          : fromSpot.transitToNext.mode === "transit"
          ? "transit"
          : fromSpot.transitToNext.mode === "bicycle"
          ? "bicycling"
          : "driving";

      return {
        ...fromSpot.transitToNext,
        googleMapsDirectionsUrl: `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${travelmode}`,
      };
    }
  }

  // Fallback: Compute dynamic distance & travel mode
  if (originLat && originLng && destLat && destLng) {
    const distKm = calculateDistanceKm(originLat, originLng, destLat, destLng);

    let mode: "walk" | "transit" | "drive" | "bicycle" = "walk";
    let durationMins = 0;
    let distanceStr = "";
    let travelmodeParam = "walking";

    if (distKm <= 1.4) {
      mode = "walk";
      travelmodeParam = "walking";
      durationMins = Math.max(4, Math.round((distKm / 4.1) * 60)); // ~4.1 km/h walking speed
      distanceStr = distKm < 1 ? `${Math.round(distKm * 1000)}m` : `${distKm.toFixed(1)} km`;
    } else if (isWalkingOnly || (!allowsTransit && !allowsCar && !allowsBicycle)) {
      mode = "walk";
      travelmodeParam = "walking";
      durationMins = Math.max(15, Math.round((distKm / 4.0) * 60));
      distanceStr = `${distKm.toFixed(1)} km`;
    } else if (allowsBicycle && !allowsTransit && !allowsCar) {
      mode = "bicycle";
      travelmodeParam = "bicycling";
      durationMins = Math.max(4, Math.round((distKm / 15) * 60) + 2);
      distanceStr = `${distKm.toFixed(1)} km`;
    } else if (distKm <= 5.0 && allowsTransit) {
      mode = "transit";
      travelmodeParam = "transit";
      durationMins = Math.max(8, Math.round((distKm / 18) * 60) + 4);
      distanceStr = `${distKm.toFixed(1)} km`;
    } else if (allowsCar && !allowsTransit) {
      mode = "drive";
      travelmodeParam = "driving";
      durationMins = Math.max(8, Math.round((distKm / 35) * 60) + 4);
      distanceStr = `${distKm.toFixed(1)} km`;
    } else {
      mode = allowsTransit ? "transit" : "drive";
      travelmodeParam = allowsTransit ? "transit" : "driving";
      durationMins = Math.max(10, Math.round((distKm / (allowsTransit ? 20 : 35)) * 60) + 5);
      distanceStr = `${distKm.toFixed(1)} km`;
    }

    const durationStr =
      mode === "walk"
        ? `${durationMins} min walk`
        : mode === "bicycle"
        ? `${durationMins} min bike ride`
        : mode === "transit"
        ? `${durationMins} min transit`
        : `${durationMins} min drive`;

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
    const spotParam = formatSpotForGoogleMaps(spot, destination);
    return `https://www.google.com/maps/search/?api=1&query=${spotParam}`;
  }

  const origin = formatSpotForGoogleMaps(activities[0], destination);
  const destinationParam = formatSpotForGoogleMaps(activities[activities.length - 1], destination);

  let waypointsParam = "";
  if (activities.length > 2) {
    const waypoints = activities.slice(1, -1).map((spot) => formatSpotForGoogleMaps(spot, destination));
    waypointsParam = `&waypoints=${waypoints.join("|")}`;
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destinationParam}${waypointsParam}`;
}

