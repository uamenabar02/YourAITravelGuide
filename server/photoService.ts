/**
 * Real-Place Photo Resolution Service
 * Fetches authentic real-world photos for any landmark, sanctuary, park, or town worldwide
 * using Wikipedia / Wikimedia Commons open API and geosearch.
 */

interface PhotoResult {
  url: string;
  source: "wikimedia" | "wikipedia" | "curated";
  title?: string;
  attribution?: string;
}

const photoCache = new Map<string, string[]>();

/**
 * Clean place name for Wikipedia/Wikimedia search
 */
function sanitizeSearchQuery(name: string, destination?: string): string {
  let clean = (name || "")
    .replace(/[\(（].*?[\)）]/g, "") // remove parenthetical remarks
    .replace(/\s*[-–—:]\s*.*$/, "") // remove subtitle after colon or dash
    .trim();

  // If name is very generic, attach destination
  if (destination && !clean.toLowerCase().includes(destination.toLowerCase())) {
    return `${clean} ${destination}`;
  }
  return clean;
}

/**
 * Query Wikipedia for high-res lead image & gallery images
 */
async function fetchFromWikipedia(searchTerm: string): Promise<string[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
      searchTerm
    )}&gsrlimit=3&prop=pageimages|extracts&piprop=original|thumbnail&pithumbsize=1200`;

    const res = await fetch(url, {
      headers: { "User-Agent": "SmartTravelPlanner/2.0 (travel@smartplanner.app)" },
    });

    if (!res.ok) return [];
    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    const photos: string[] = [];
    for (const pageId of Object.keys(pages)) {
      const p = pages[pageId];
      if (p.original?.source) {
        photos.push(p.original.source);
      } else if (p.thumbnail?.source) {
        photos.push(p.thumbnail.source);
      }
    }
    return photos;
  } catch (err) {
    console.warn("Wikipedia photo search error:", err);
    return [];
  }
}

/**
 * Query Wikimedia Commons for authentic landmark photography
 */
async function fetchFromWikimediaCommons(searchTerm: string): Promise<string[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(
      searchTerm
    )}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size|mime`;

    const res = await fetch(url, {
      headers: { "User-Agent": "SmartTravelPlanner/2.0 (travel@smartplanner.app)" },
    });

    if (!res.ok) return [];
    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    const photos: string[] = [];
    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (info && info.url) {
        const mime = (info.mime || "").toLowerCase();
        // Only accept clean jpeg/png/webp
        if (mime.includes("image/jpeg") || mime.includes("image/png") || mime.includes("image/webp")) {
          // Avoid tiny icons, flags, or logos
          if ((info.width && info.width > 400) || !info.width) {
            photos.push(info.url);
          }
        }
      }
    }
    return photos;
  } catch (err) {
    console.warn("Wikimedia Commons photo search error:", err);
    return [];
  }
}

/**
 * Query Wikipedia geosearch for places matching exact coordinates
 */
async function fetchFromGeosearch(lat: number, lng: number): Promise<string[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lng}&ggsradius=1500&ggslimit=4&prop=pageimages&piprop=original|thumbnail&pithumbsize=1200`;

    const res = await fetch(url, {
      headers: { "User-Agent": "SmartTravelPlanner/2.0 (travel@smartplanner.app)" },
    });

    if (!res.ok) return [];
    const data: any = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return [];

    const photos: string[] = [];
    for (const pageId of Object.keys(pages)) {
      const p = pages[pageId];
      if (p.original?.source) {
        photos.push(p.original.source);
      } else if (p.thumbnail?.source) {
        photos.push(p.thumbnail.source);
      }
    }
    return photos;
  } catch (err) {
    console.warn("Geosearch photo error:", err);
    return [];
  }
}

/**
 * Main function to resolve authentic real-world photos for any spot worldwide.
 */
export async function getRealPhotosForSpot(
  spotName: string,
  destination: string,
  category?: string,
  coordinates?: { lat: number; lng: number }
): Promise<string[]> {
  const cacheKey = `${spotName.toLowerCase()}_${destination.toLowerCase()}`;
  if (photoCache.has(cacheKey)) {
    return photoCache.get(cacheKey)!;
  }

  const results: string[] = [];
  const cleanName = sanitizeSearchQuery(spotName, destination);

  // 1. Search Wikipedia for spot name directly
  const wikiPhotos = await fetchFromWikipedia(spotName);
  results.push(...wikiPhotos);

  // 2. Search Wikipedia with clean name + destination if few results
  if (results.length < 2) {
    const comboPhotos = await fetchFromWikipedia(cleanName);
    for (const p of comboPhotos) {
      if (!results.includes(p)) results.push(p);
    }
  }

  // 3. Search Wikimedia Commons for rich photography
  if (results.length < 3) {
    const commonsPhotos = await fetchFromWikimediaCommons(`${spotName} ${destination}`);
    for (const p of commonsPhotos) {
      if (!results.includes(p)) results.push(p);
    }
  }

  // 4. Coordinates Geosearch fallback
  if (results.length === 0 && coordinates?.lat && coordinates?.lng) {
    const geoPhotos = await fetchFromGeosearch(coordinates.lat, coordinates.lng);
    for (const p of geoPhotos) {
      if (!results.includes(p)) results.push(p);
    }
  }

  // Deduplicate and filter out SVG/PDF or broken URLs
  const validPhotos = Array.from(new Set(results)).filter((url) => {
    const lower = url.toLowerCase();
    return !lower.endsWith(".svg") && !lower.endsWith(".pdf") && !lower.includes("placeholder");
  });

  if (validPhotos.length > 0) {
    photoCache.set(cacheKey, validPhotos);
    return validPhotos;
  }

  return [];
}
