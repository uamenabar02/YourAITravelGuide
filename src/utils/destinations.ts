import { Coordinates, DestinationStop, PlaceReview, ActivitySpot, CandidateSpot, TransitInfo } from "../types";

export interface VerifiedDestination {
  id: string;
  name: string;
  aliases: string[];
  region: string;
  country: string;
  coordinates: Coordinates;
  popularSpots: string[];
  bannerImage: string;
  description: string;
}

export const VERIFIED_DESTINATIONS: VerifiedDestination[] = [
  {
    id: "azpeitia",
    name: "Azpeitia",
    aliases: ["Azpeitia", "Urola Kosta", "Loyola", "Azpeitia Gipuzkoa"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.1818, lng: -2.2644 },
    popularSpots: [
      "Santuario de Loyola & Baroque Basilica",
      "Basque Railway Museum (Burnibidearen Euskal Museoa)",
      "Izarraitz Mountain Ridge & Erlo Summit",
      "Urola River Greenway & Historic Plaza Nagusia",
      "Ekoetxea Urdaibai Environmental Center",
    ],
    bannerImage: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200&q=80",
    description: "Historic Urola valley town at the foot of Mount Izarraitz, world-famous for Saint Ignatius' Baroque Sanctuary of Loyola.",
  },
  {
    id: "azkoitia",
    name: "Azkoitia",
    aliases: ["Azkoitia", "Urola"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.1782, lng: -2.3117 },
    popularSpots: [
      "Intsausti Palace & Noble Quarter",
      "Jorge Oteiza Pelota Courts",
      "Casco Histórico & Plaza de la Verdura",
      "Balda Tower & Historic Alleyways",
    ],
    bannerImage: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80",
    description: "Noble Basque town in the Urola valley with centuries of pelota tradition and historic stone palaces.",
  },
  {
    id: "zarautz",
    name: "Zarautz",
    aliases: ["Zarauz", "Urola Kosta"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.2847, lng: -2.1698 },
    popularSpots: [
      "Zarautz Long Beach & Surf Promenade",
      "Santa Bárbara Viewpoint & Txakoli Vineyards",
      "Luzea Tower & Gothic Historic Quarter",
      "Iñurritza Dune Nature Reserve",
    ],
    bannerImage: "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=1200&q=80",
    description: "Vibrant coastal town featuring the longest beach in Gipuzkoa, legendary surf breaks, and hillside txakoli wineries.",
  },
  {
    id: "tolosa",
    name: "Tolosa",
    aliases: ["Tolosaldea"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.1367, lng: -2.0728 },
    popularSpots: [
      "El Tinglado Saturday Farmers' Market",
      "TOPIC International Puppet Art Center",
      "Traditional Asador Steakhouses (Casa Julián)",
      "Oria River Promenade & Zerkausia Market",
    ],
    bannerImage: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
    description: "Former capital of Gipuzkoa renowned for its historic Saturday producers' market, puppet arts museum, and master steak grills.",
  },
  {
    id: "zumaia",
    name: "Zumaia",
    aliases: ["Zumaya", "Flysch Geopark"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.2983, lng: -2.2572 },
    popularSpots: [
      "Itzurun Beach Flysch Cliffs (UNESCO Geopark)",
      "Hermitage of San Telmo & Cliff Overlook",
      "Zumaia Marina & Urola Estuary Promenade",
      "Algorri Interpretive Center",
    ],
    bannerImage: "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80",
    description: "Breathtaking coastal geopark renowned for dramatic million-year-old Flysch rock strata and San Telmo cliff chapel.",
  },
  {
    id: "getaria",
    name: "Getaria",
    aliases: ["Ratón de Getaria"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.3025, lng: -2.2036 },
    popularSpots: [
      "Cristóbal Balenciaga Haute Couture Museum",
      "El Ratón de Getaria (Mount San Anton)",
      "Fishing Harbor Charcoal-Grilled Turbot Restaurants",
      "Hillside Txakoli Vineyards",
    ],
    bannerImage: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
    description: "Historic walled fishing port nestled under Mount San Anton, birthplace of Balenciaga and world-famous grilled seafood.",
  },
  {
    id: "hondarribia",
    name: "Hondarribia",
    aliases: ["Fuenterrabía", "Hondarribi"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.3636, lng: -1.7911 },
    popularSpots: [
      "La Marina Neighborhood (Colorful Fishermen's Balconies)",
      "Parador de Carlos V Castle",
      "Kale Nagusia Historic Stone Ramparts",
      "Bidasoa Estuary Promenade & Pintxo Bars",
    ],
    bannerImage: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=1200&q=80",
    description: "Enchanting border town featuring colorful timber balconies, medieval stone ramparts, and award-winning pintxo taverns.",
  },
  {
    id: "pasaia",
    name: "Pasaia",
    aliases: ["Pasajes", "Pasai Donibane", "Pasai San Pedro"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.3247, lng: -1.9286 },
    popularSpots: [
      "Albaola Sea Factory of the Basques",
      "Victor Hugo Historic House Museum",
      "Pasai Donibane Waterfront Cobblestone Street",
      "Green Fjord Channel & Boat Shuttle",
    ],
    bannerImage: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80",
    description: "Dramatic natural fjord harbor with historic waterfront stone houses where Victor Hugo lived and Albaola builds 16th-century whaling ships.",
  },
  {
    id: "ordizia",
    name: "Ordizia",
    aliases: ["Goierri"],
    region: "Gipuzkoa, Basque Country",
    country: "Spain",
    coordinates: { lat: 43.0539, lng: -2.1783 },
    popularSpots: [
      "Wednesday Agricultural & Idiazabal Cheese Market (Since 1268)",
      "D'Elikatuz Food & Gastronomy Center",
      "Goierri Valley Highland Trailhead",
    ],
    bannerImage: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    description: "The culinary heart of the Goierri highland valley, home to Spain's oldest weekly farmers' and Idiazabal cheese market.",
  },
  {
    id: "pamplona",
    name: "Pamplona / Iruña",
    aliases: ["Pamplona", "Iruña", "Navarra"],
    region: "Navarre",
    country: "Spain",
    coordinates: { lat: 42.8125, lng: -1.6458 },
    popularSpots: [
      "Plaza del Castillo & Café Iruña",
      "Pamplona Star Citadel & Green Parkways",
      "Calle Estafeta Pintxo Taverns",
      "Navarre Museum & Gothic Cathedral",
    ],
    bannerImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
    description: "Historic capital of Navarre famous for its star-shaped citadel, lively tapas squares, and Hemingway heritage.",
  },
  {
    id: "vitoria-gasteiz",
    name: "Vitoria-Gasteiz",
    aliases: ["Vitoria", "Gasteiz", "Araba", "Alava"],
    region: "Álava, Basque Country",
    country: "Spain",
    coordinates: { lat: 42.8467, lng: -2.6716 },
    popularSpots: [
      "Santa María Gothic Cathedral (Open for Restoration)",
      "Casco Viejo Almond Historic Quarter",
      "Salburua Wetlands & Green Belt Parks",
      "Artium Basque Museum of Contemporary Art",
    ],
    bannerImage: "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=1200&q=80",
    description: "European Green Capital boasting an impeccably preserved medieval almond-shaped historic quarter and urban wetlands.",
  },
  {
    id: "donostia-san-sebastian",
    name: "Donostia / San Sebastián",
    aliases: ["San Sebastian", "Donostia", "San Sebastián", "Donosti", "Gipuzkoa"],
    region: "Basque Country",
    country: "Spain",
    coordinates: { lat: 43.3183, lng: -1.9812 },
    popularSpots: [
      "Playa de La Concha & Promenade",
      "Peine del Viento (Eduardo Chillida)",
      "Monte Igueldo & 1912 Funicular",
      "Parte Vieja Pintxo Crawl (Bar Nestor, La Cuchara de San Telmo, Ganbara)",
      "Zurriola Beach & Kursaal Auditorium in Gros",
      "San Telmo Museum of Basque Society",
      "Monte Urgull & Castillo de la Mota",
      "Mercado de la Bretxa",
      "Miramar Palace & Gardens",
      "Basque Culinary Center & Michelin gastronomy",
    ],
    bannerImage: "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=1200&q=80",
    description: "World-renowned culinary capital on the Bay of Biscay, framed by golden crescent beaches, Michelin stars, and Belle Époque elegance.",
  },
  {
    id: "bilbao",
    name: "Bilbao",
    aliases: ["Bilbo", "Bizkaia", "Biscay"],
    region: "Basque Country",
    country: "Spain",
    coordinates: { lat: 43.2630, lng: -2.9350 },
    popularSpots: [
      "Guggenheim Museum Bilbao (Frank Gehry)",
      "Casco Viejo & Las Siete Calles",
      "Mercado de la Ribera",
      "Funicular de Artxanda Viewpoint",
      "Zubizuri Bridge by Calatrava",
      "Plaza Nueva Pintxo Taverns",
      "Museum of Fine Arts Bilbao",
      "Azkuna Zentroa (Alhóndiga)",
    ],
    bannerImage: "https://images.unsplash.com/photo-1548625361-195fe5795df5?auto=format&fit=crop&w=1200&q=80",
    description: "Dynamic Basque metropolis blending cutting-edge titanium architecture with ancient medieval quarter gastronomy.",
  },
  {
    id: "biarritz",
    name: "Biarritz",
    aliases: ["Biarritz / French Basque Country", "Iparralde", "Côte Basque"],
    region: "Nouvelle-Aquitaine / Basque Coast",
    country: "France",
    coordinates: { lat: 43.4832, lng: -1.5586 },
    popularSpots: [
      "Rocher de la Vierge & Footbridge",
      "Plage de la Côte des Basques (Surfing birthplace)",
      "Marché Les Halles de Biarritz",
      "Port des Pêcheurs (Fishermen's cottages)",
      "Hôtel du Palais & Grande Plage",
      "Phare de Biarritz (Lighthouse views)",
    ],
    bannerImage: "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
    description: "Chic seaside resort on the Atlantic Basque coast, celebrated for Belle Époque villas, surf culture, and seafood markets.",
  },
  {
    id: "kyoto",
    name: "Kyoto",
    aliases: ["Kyoto-shi", "Kansai"],
    region: "Kansai",
    country: "Japan",
    coordinates: { lat: 35.0116, lng: 135.7681 },
    popularSpots: [
      "Arashiyama Bamboo Grove & Tenryu-ji",
      "Fushimi Inari Shrine & 10,000 Torii gates",
      "Ginkaku-ji (Silver Pavilion) & Philosopher's Path",
      "Pontocho Alley & Gion Teahouses",
      "Kiyomizu-dera Wooden Terrace",
      "Nishiki Food Market",
    ],
    bannerImage: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
    description: "The ancient imperial capital of Japan, steeped in Zen gardens, historic wooden machiya, and UNESCO temples.",
  },
  {
    id: "barcelona",
    name: "Barcelona",
    aliases: ["BCN", "Catalonia"],
    region: "Catalonia",
    country: "Spain",
    coordinates: { lat: 41.3879, lng: 2.1699 },
    popularSpots: [
      "Basílica de la Sagrada Família (Gaudí)",
      "Park Güell & Mosaic Terraces",
      "Gothic Quarter (Barri Gòtic)",
      "Mercat de la Boqueria on La Rambla",
      "Casa Batlló & Casa Milà",
      "Bunkers del Carmel Panoramic Sunset",
    ],
    bannerImage: "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=1200&q=80",
    description: "Sun-drenched Mediterranean metropolis brimming with Gaudí's modernist masterpieces and vibrant tapas bodegas.",
  },
  {
    id: "rome",
    name: "Rome",
    aliases: ["Roma", "Eternal City"],
    region: "Lazio",
    country: "Italy",
    coordinates: { lat: 41.9028, lng: 12.4964 },
    popularSpots: [
      "Colosseum & Roman Forum",
      "Pantheon & Piazza Navona",
      "Trevi Fountain & Spanish Steps",
      "Trastevere Cobblestone Trattorias",
      "Vatican Museums & St. Peter's Basilica",
      "Villa Borghese Gardens",
    ],
    bannerImage: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80",
    description: "The Eternal City, showcasing millennia of Roman architecture, Renaissance piazzas, and sublime pasta al dente.",
  },
  {
    id: "paris",
    name: "Paris",
    aliases: ["City of Light", "Paname"],
    region: "Île-de-France",
    country: "France",
    coordinates: { lat: 48.8566, lng: 2.3522 },
    popularSpots: [
      "Musée du Louvre & Tuileries Garden",
      "Eiffel Tower & Champ de Mars",
      "Montmartre & Sacré-Cœur Basilica",
      "Le Marais Boutiques & Bistros",
      "Musée d'Orsay & Seine Riverbank Promenade",
      "Sainte-Chapelle Stained Glass",
    ],
    bannerImage: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1200&q=80",
    description: "The world's cultural beacon of haute cuisine, impressionist art, romantic boulevards, and grand architecture.",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    aliases: ["Edo", "Tokyo Metropolis"],
    region: "Kanto",
    country: "Japan",
    coordinates: { lat: 35.6762, lng: 139.6503 },
    popularSpots: [
      "Senso-ji Temple & Asakusa Traditional Quarter",
      "Shinjuku Gyoen National Garden",
      "Shibuya Crossing & Nonbei Yokocho",
      "Tsukiji Outer Seafood Market",
      "Meiji Jingu Shrine & Harajuku",
      "Ginza Artisan Roasteries & Izakayas",
    ],
    bannerImage: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80",
    description: "A breathtaking collision of futuristic neon skylines, ancient Shinto shrines, and unparalleled culinary mastery.",
  },
  {
    id: "lisbon",
    name: "Lisbon",
    aliases: ["Lisboa"],
    region: "Lisbon District",
    country: "Portugal",
    coordinates: { lat: 38.7223, lng: -9.1393 },
    popularSpots: [
      "Alfama Historic Quarter & Fado Taverns",
      "Belém Tower & Pastéis de Belém",
      "Miradouro de Santa Luzia & Portas do Sol",
      "Jerónimos Monastery",
      "Tram 28 & Bairro Alto Wine Bars",
      "Time Out Market Lisboa",
    ],
    bannerImage: "https://images.unsplash.com/photo-1509840841025-9088ba78a826?auto=format&fit=crop&w=1200&q=80",
    description: "Sunlit city of seven hills paved with calcada azulejo tiles, melancholic fado music, and pastel de nata pastry shops.",
  },
  {
    id: "porto",
    name: "Porto",
    aliases: ["Oporto", "Douro"],
    region: "Norte",
    country: "Portugal",
    coordinates: { lat: 41.1579, lng: -8.6291 },
    popularSpots: [
      "Ribeira Riverfront & Dom Luís I Bridge",
      "Livraria Lello Historic Neo-Gothic Bookstore",
      "Vila Nova de Gaia Port Wine Lodges",
      "Clérigos Tower & Miradouro",
      "Bolhão Traditional Market",
      "São Bento Tile Station",
    ],
    bannerImage: "https://images.unsplash.com/photo-1555881400-74d7acaacd8b?auto=format&fit=crop&w=1200&q=80",
    description: "Atmospheric riverside city famous for aged Tawny Port, soaring iron bridges, and dramatic hillside vistas.",
  },
  {
    id: "oaxaca",
    name: "Oaxaca",
    aliases: ["Oaxaca de Juárez"],
    region: "Oaxaca",
    country: "Mexico",
    coordinates: { lat: 17.0732, lng: -96.7266 },
    popularSpots: [
      "Mercado 20 de Noviembre (Pasillo de Humo)",
      "Templo de Santo Domingo de Guzmán",
      "Monte Albán Zapotec Pyramids",
      "Ethnobotanical Garden Oaxaca",
      "Ancestral Mezcal Tastings in Jalatlaco",
      "Teotitlán del Valle Artisan Weaving",
    ],
    bannerImage: "https://images.unsplash.com/photo-1512813195386-6cf811ad3542?auto=format&fit=crop&w=1200&q=80",
    description: "Mexico's culinary and artisan heart, celebrated for rich moles, hand-woven textiles, and vibrant cobblestone colonial streets.",
  },
  {
    id: "cape-town",
    name: "Cape Town",
    aliases: ["Kaapstad", "Mother City"],
    region: "Western Cape",
    country: "South Africa",
    coordinates: { lat: -33.9249, lng: 18.4241 },
    popularSpots: [
      "Table Mountain Cableway & Plateau Walk",
      "Kirstenbosch National Botanical Garden",
      "Bo-Kaap Colorful Heritage Quarter",
      "V&A Waterfront & Zeitz MOCAA",
      "Cape Point & Boulders Beach Penguins",
      "Camps Bay Sunset Tidal Pool",
    ],
    bannerImage: "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1200&q=80",
    description: "Dramatic coastal playground where rugged granite mountains meet two oceans, world-class wine valleys, and colorful culture.",
  },
  {
    id: "vancouver",
    name: "Vancouver",
    aliases: ["YVR", "Metro Vancouver"],
    region: "British Columbia",
    country: "Canada",
    coordinates: { lat: 49.2827, lng: -123.1207 },
    popularSpots: [
      "Stanley Park Seawall & Totem Poles",
      "Granville Island Public Market",
      "Gastown Historic Cobblestones & Steam Clock",
      "Capilano Suspension Bridge & Rainforest",
      "Kitsilano Beach & Mountain Backdrop",
      "Richmond Night Market Asian Street Food",
    ],
    bannerImage: "https://images.unsplash.com/photo-1559511260-66a65e09b2ee?auto=format&fit=crop&w=1200&q=80",
    description: "Pacific Northwest metropolis nestled between soaring snowcapped coastal peaks and glittering ocean inlets.",
  },
];

// Helper: match query against verified database
export function findVerifiedDestination(query: string): VerifiedDestination | null {
  if (!query || typeof query !== "string") return null;
  const clean = query.trim().toLowerCase();
  
  for (const dest of VERIFIED_DESTINATIONS) {
    if (dest.name.toLowerCase() === clean) return dest;
    if (dest.aliases.some(alias => alias.toLowerCase() === clean)) return dest;
    if (clean.includes(dest.name.toLowerCase()) || dest.name.toLowerCase().includes(clean)) return dest;
    if (dest.aliases.some(alias => clean.includes(alias.toLowerCase()))) return dest;
  }
  return null;
}

// Helper: search advisor suggestions
export function searchDestinationSuggestions(query: string): VerifiedDestination[] {
  if (!query || query.trim().length === 0) {
    return VERIFIED_DESTINATIONS.slice(0, 8);
  }
  const clean = query.trim().toLowerCase();
  return VERIFIED_DESTINATIONS.filter(dest => {
    if (dest.name.toLowerCase().includes(clean)) return true;
    if (dest.country.toLowerCase().includes(clean)) return true;
    if (dest.region.toLowerCase().includes(clean)) return true;
    if (dest.aliases.some(a => a.toLowerCase().includes(clean))) return true;
    return false;
  });
}

// Live geocoder fallback using OpenStreetMap Nominatim
const geocodeCache = new Map<string, Coordinates>();

export async function resolveDestinationCoordinates(query: string): Promise<{ name: string; coordinates: Coordinates; region?: string; country?: string }> {
  // 1. Check local verified database
  const verified = findVerifiedDestination(query);
  if (verified) {
    return {
      name: verified.name,
      coordinates: verified.coordinates,
      region: verified.region,
      country: verified.country,
    };
  }

  // 2. Check cache
  const cacheKey = query.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return {
      name: query,
      coordinates: geocodeCache.get(cacheKey)!,
    };
  }

  // 3. Fallback to OpenStreetMap Nominatim
  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`, {
      headers: { "Accept": "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        const coords = {
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        };
        geocodeCache.set(cacheKey, coords);
        return {
          name: item.display_name?.split(",").slice(0, 2).join(",") || query,
          coordinates: coords,
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim search failed:", err);
  }

  // 4. Default safe fallback
  return {
    name: query,
    coordinates: { lat: 43.3183, lng: -1.9812 }, // Donostia baseline if unresolved
  };
}

// Curated Landmark and Place-Specific Photos (Authentic, context-accurate images)
export const LANDMARK_PHOTOS: Record<string, string[]> = {
  // Donostia / San Sebastián
  "peine del viento": [
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80", // Rugged coastal rocks & Atlantic waves
    "https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?auto=format&fit=crop&w=800&q=80", // Dramatic steel & stone seascape
    "https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80", // Crashing ocean swell on cliffs
  ],
  "chillida": [
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=80",
  ],
  "monte igueldo": [
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80", // Mountain panorama & coastline
    "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=800&q=80", // Bay lookout & coastal headland
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80", // Vintage wooden transport & funicular
  ],
  "funicular": [
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80",
  ],
  "la concha": [
    "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=800&q=80", // European seaside promenade & bay
    "https://images.unsplash.com/photo-1512353087810-25dfcd100962?auto=format&fit=crop&w=800&q=80", // Coastal city & royal gardens
    "https://images.unsplash.com/photo-1549144511-f099e773c147?auto=format&fit=crop&w=800&q=80", // Classic coastal promenade architecture
  ],
  "miramar": [
    "https://images.unsplash.com/photo-1512353087810-25dfcd100962?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=800&q=80",
  ],
  "ondarreta": [
    "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
  ],
  "bar nestor": [
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80", // Ribeye steak & sizzling grill
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80", // Spanish tapas & wine bar
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
  ],
  "txuleta": [
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  ],
  "la cuchara": [
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  ],
  "ganbara": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
  ],
  "pintxo": [
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
  ],
  "parte vieja": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80",
  ],
  "zurriola": [
    "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80", // Atlantic surfing & urban beach
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80", // Modern architectural Kursaal cubes
  ],
  "kursaal": [
    "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80",
  ],
  "san telmo": [
    "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=80", // Historic cloister & monastery museum
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80", // Classical stone architecture
  ],
  "urgull": [
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80", // Mountain fort & stone bastions
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80",
  ],
  "bretxa": [
    "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80", // European food market
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  ],
  "la viña": [
    "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80", // Artisanal cheesecake & pastry
    "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
  ],
  "cheesecake": [
    "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=800&q=80",
  ],
  "santa clara": [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80", // Coastal boat & island
    "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=800&q=80",
  ],
  "ciderhouse": [
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80", // Rustic barrel room & drinks
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80", // Wood-fired steak
  ],
  "sagardotegi": [
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
  ],

  // Bilbao
  "guggenheim": [
    "https://images.unsplash.com/photo-1548625361-195fe5795df5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=800&q=80",
  ],
  "artxanda": [
    "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80",
  ],
  "casco viejo": [
    "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  ],

  // Biarritz
  "rocher de la vierge": [
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
  ],
  "côte des basques": [
    "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
  ],

  // Kyoto & Japan
  "arashiyama": [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
  ],
  "fushimi inari": [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  ],
  "kiyomizu": [
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
  ],

  // Barcelona
  "sagrada familia": [
    "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
  ],
  "park guell": [
    "https://images.unsplash.com/photo-1583422409516-2895a77efded?auto=format&fit=crop&w=800&q=80",
  ],

  // Rome
  "colosseum": [
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
  ],
  "pantheon": [
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=800&q=80",
  ],

  // Paris
  "louvre": [
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
  ],
  "eiffel": [
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=80",
  ],
};

// Context-Accurate Category Photos (European & Architectural defaults)
export const CATEGORY_PHOTOS: Record<string, string[]> = {
  food: [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
  ],
  nature: [
    "https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512353087810-25dfcd100962?auto=format&fit=crop&w=800&q=80",
  ],
  culture: [
    "https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80",
  ],
  sightseeing: [
    "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1579282240050-352db0a14c21?auto=format&fit=crop&w=800&q=80",
  ],
  "hidden-gem": [
    "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
  ],
  cafe: [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
  ],
  nightlife: [
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
  ],
  relaxation: [
    "https://images.unsplash.com/photo-1512353087810-25dfcd100962?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
  ],
  shopping: [
    "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80",
  ],
};

export function getCuratedPhotosForSpot(category: string, name: string, destination?: string): string[] {
  const cleanName = (name || "").toLowerCase().trim();

  // 1. Direct landmark matching
  for (const [key, photos] of Object.entries(LANDMARK_PHOTOS)) {
    if (cleanName.includes(key) || key.includes(cleanName)) {
      return photos;
    }
  }

  // 2. Keyword heuristic matching
  if (cleanName.includes("peine") || cleanName.includes("wind") || cleanName.includes("sculptur") || cleanName.includes("chillida")) {
    return LANDMARK_PHOTOS["peine del viento"];
  }
  if (cleanName.includes("igueldo") || cleanName.includes("funicular") || cleanName.includes("cable car") || cleanName.includes("lookout") || cleanName.includes("viewpoint") || cleanName.includes("mirador")) {
    return LANDMARK_PHOTOS["monte igueldo"];
  }
  if (cleanName.includes("concha") || cleanName.includes("bay") || cleanName.includes("crescent beach") || cleanName.includes("promenade")) {
    return LANDMARK_PHOTOS["la concha"];
  }
  if (cleanName.includes("nestor") || cleanName.includes("txuleta") || cleanName.includes("steak") || cleanName.includes("ribeye") || cleanName.includes("grill")) {
    return LANDMARK_PHOTOS["bar nestor"];
  }
  if (cleanName.includes("pintxo") || cleanName.includes("tapa") || cleanName.includes("bodega") || cleanName.includes("tavern") || cleanName.includes("cuchara") || cleanName.includes("ganbara")) {
    return LANDMARK_PHOTOS["pintxo"];
  }
  if (cleanName.includes("surf") || cleanName.includes("zurriola") || cleanName.includes("wave")) {
    return LANDMARK_PHOTOS["zurriola"];
  }
  if (cleanName.includes("cheesecake") || cleanName.includes("viña") || cleanName.includes("vina") || cleanName.includes("cake") || cleanName.includes("pastry")) {
    return LANDMARK_PHOTOS["la viña"];
  }
  if (cleanName.includes("museum") || cleanName.includes("telmo") || cleanName.includes("convent") || cleanName.includes("exhibit")) {
    return LANDMARK_PHOTOS["san telmo"];
  }
  if (cleanName.includes("urgull") || cleanName.includes("fortress") || cleanName.includes("castle") || cleanName.includes("mota")) {
    return LANDMARK_PHOTOS["urgull"];
  }
  if (cleanName.includes("market") || cleanName.includes("mercado") || cleanName.includes("bretxa") || cleanName.includes("hall")) {
    return LANDMARK_PHOTOS["bretxa"];
  }
  if (cleanName.includes("cider") || cleanName.includes("sagardo") || cleanName.includes("txotx") || cleanName.includes("barrel")) {
    return LANDMARK_PHOTOS["ciderhouse"];
  }

  // 3. Fallback to refined category photos
  const cat = (category || "sightseeing").toLowerCase();
  const pool = CATEGORY_PHOTOS[cat] || CATEGORY_PHOTOS.sightseeing;
  return pool;
}

export function generateGoogleMapsSearchUrl(spotName: string, destination: string): string {
  const q = encodeURIComponent(`${spotName}, ${destination}`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

export function generateSampleReviews(spotName: string, rating: number = 4.8): PlaceReview[] {
  const templates = [
    {
      author: "Elena M. (Local Guide)",
      rating: 5,
      timeAgo: "2 weeks ago",
      text: `An absolute must-visit in ${spotName}. The atmosphere is authentic, not overrun, and the quality exceeds expectations.`,
    },
    {
      author: "Mikel Z. (Resident)",
      rating: 4.8,
      timeAgo: "a month ago",
      text: "One of my favorite places to bring visiting friends. Incredible views and memorable local flavors.",
    },
    {
      author: "Sarah T. (Traveler)",
      rating: 5,
      timeAgo: "3 months ago",
      text: "Unbeatable experience. Be sure to arrive a bit early to enjoy it at a relaxed pace without any rush.",
    },
  ];
  return templates;
}

export function getTicketOrBookingUrl(
  activityName: string,
  destination: string,
  approxCost?: string,
  customUrl?: string
): string | undefined {
  if (customUrl && customUrl.trim()) return customUrl.trim();

  const cleanName = activityName.toLowerCase();
  const cleanCost = (approxCost || "").toLowerCase();

  // If cost indicates free, do not generate ticket purchase link
  const isFree = cleanCost.includes("free") || cleanCost === "€0" || cleanCost === "$0" || cleanCost === "0€";

  // 1. Direct official links for famous ticketed spots
  if (cleanName.includes("santa clara") || cleanName.includes("motoras") || cleanName.includes("boat shuttle") || cleanName.includes("isla santa clara")) {
    return "https://www.motorasdelaisla.com/en/";
  }
  if (cleanName.includes("monte igueldo") || cleanName.includes("funicular de igueldo") || cleanName.includes("funicular igueldo")) {
    return "https://monteigueldo.es/en/";
  }
  if (cleanName.includes("san telmo") || cleanName.includes("museo san telmo")) {
    return "https://www.santelmomuseoa.eus/en/visit/";
  }
  if (cleanName.includes("aquarium") && (cleanName.includes("san sebastian") || cleanName.includes("donostia") || destination.toLowerCase().includes("sebastian") || destination.toLowerCase().includes("donostia"))) {
    return "https://aquariumss.com/en/tickets/";
  }
  if (cleanName.includes("guggenheim")) {
    return "https://www.guggenheim-bilbao.eus/en/buy-tickets";
  }
  if (cleanName.includes("artxanda") && cleanName.includes("funicular")) {
    return "https://funicularartxanda.bilbao.eus/";
  }
  if (cleanName.includes("sagrada fam")) {
    return "https://sagradafamilia.org/en/tickets";
  }
  if (cleanName.includes("park g") || cleanName.includes("guell")) {
    return "https://parkguell.barcelona/en/buy-tickets";
  }
  if (cleanName.includes("colosseum") || cleanName.includes("colosseo")) {
    return "https://colosseo.it/en/tickets/";
  }
  if (cleanName.includes("louvre")) {
    return "https://www.louvre.fr/en/visit/tickets";
  }
  if (cleanName.includes("vatican")) {
    return "https://tickets.museivaticani.va/";
  }
  if (cleanName.includes("kiyomizu") || cleanName.includes("tenryu-ji") || cleanName.includes("ginkaku-ji")) {
    return `https://www.google.com/search?q=buy+tickets+${encodeURIComponent(activityName + " " + destination)}`;
  }

  // 2. Keyword detection for paid attractions needing tickets
  const ticketKeywords = [
    "boat", "ferry", "shuttle", "ticket", "museum", "funicular", "cable car",
    "castle", "cathedral", "cruise", "exhibition", "admission", "kayak rental",
    "paddleboard", "tasting tour", "cooking class", "observatory", "theater", "palace"
  ];
  const hasTicketKeyword = ticketKeywords.some((k) => cleanName.includes(k));

  if (!isFree && (cleanCost.includes("€") || cleanCost.includes("$") || cleanCost.includes("£") || cleanCost.includes("¥") || hasTicketKeyword)) {
    return `https://www.google.com/search?q=buy+tickets+${encodeURIComponent(activityName + " " + destination)}`;
  }

  return undefined;
}

export function getKnownSpotsForDestination(
  destinationQuery: string,
  vibes: string[] = [],
  budgetTier?: string
): CandidateSpot[] {
  const verified = findVerifiedDestination(destinationQuery);
  const baseCoords = verified?.coordinates || { lat: 43.3183, lng: -1.9812 };
  const destName = verified?.name || destinationQuery;

  const spotNames = verified?.popularSpots && verified.popularSpots.length > 0
    ? verified.popularSpots
    : [
        `Historic Old Quarter & Local Food Trail`,
        `Panoramic Scenic Viewpoint & Promenade`,
        `Artisan Market & Cultural Center`,
        `Authentic Neighborhood Eatery & Cafe`,
        `Coastal Path or Botanical Walk`,
      ];

  const categories: ("food" | "sightseeing" | "culture" | "nature" | "hidden-gem")[] = [
    "sightseeing",
    "nature",
    "sightseeing",
    "food",
    "sightseeing",
    "culture",
    "sightseeing",
    "food",
    "culture",
    "food",
  ];

  const candidateList = spotNames.map((name, i) => {
    const cat = categories[i % categories.length];
    const photos = getCuratedPhotosForSpot(cat, name);
    let approxCost = cat === "food" ? "€15 - €30" : (i % 3 === 0 ? "€5 - €10" : "Free");
    if (budgetTier === "budget" && cat === "food") approxCost = "€8 - €15";
    if (budgetTier === "luxury") approxCost = cat === "food" ? "€80 - €180" : "€25 - €50";

    const ticketUrl = getTicketOrBookingUrl(name, destName, approxCost);

    return {
      id: `cand-${verified?.id || "dest"}-${i + 1}`,
      name,
      time: i % 2 === 0 ? "Morning / Afternoon" : "Evening Experience",
      category: cat,
      description: `Tailored highlight in ${destName} matching your travel style. Renowned for its authentic atmosphere, local character, and distinct heritage.`,
      insiderTip: "Arrive slightly before sunset or early morning to experience the best natural light and avoid crowds.",
      approxCost,
      ticketUrl,
      rating: +(4.7 + (i % 3) * 0.1).toFixed(1),
      coordinates: {
        lat: baseCoords.lat + (Math.sin(i * 1.3) * 0.008),
        lng: baseCoords.lng + (Math.cos(i * 1.3) * 0.008),
      },
      photos,
      googleMapsUrl: generateGoogleMapsSearchUrl(name, destName),
      reviews: generateSampleReviews(name, 4.8),
    };
  });

  // Score candidate items based on user vibes
  if (vibes && vibes.length > 0) {
    const lowerVibes = vibes.map((v) => v.toLowerCase());
    candidateList.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      const nameA = a.name.toLowerCase();
      const catA = a.category.toLowerCase();
      const nameB = b.name.toLowerCase();
      const catB = b.category.toLowerCase();

      for (const v of lowerVibes) {
        if (v.includes("food") || v.includes("gastronomy") || v.includes("nightlife")) {
          if (catA === "food" || nameA.includes("pintxo") || nameA.includes("bar") || nameA.includes("market")) scoreA += 4;
          if (catB === "food" || nameB.includes("pintxo") || nameB.includes("bar") || nameB.includes("market")) scoreB += 4;
        }
        if (v.includes("scenic") || v.includes("outdoor") || v.includes("nature")) {
          if (catA === "nature" || catA === "sightseeing" || nameA.includes("beach") || nameA.includes("promenade") || nameA.includes("viewpoint")) scoreA += 4;
          if (catB === "nature" || catB === "sightseeing" || nameB.includes("beach") || nameB.includes("promenade") || nameB.includes("viewpoint")) scoreB += 4;
        }
        if (v.includes("culture") || v.includes("history") || v.includes("architecture")) {
          if (catA === "culture" || nameA.includes("museum") || nameA.includes("palace")) scoreA += 4;
          if (catB === "culture" || nameB.includes("museum") || nameB.includes("palace")) scoreB += 4;
        }
      }

      return scoreB - scoreA;
    });
  }

  return candidateList;
}

/**
 * Calculates real-world transit logistics between two consecutive itinerary spots.
 * Computes walking/transit time, distance in meters/km, and contextual navigation advice.
 */
export function calculateTransitLogistics(
  fromSpot: ActivitySpot,
  toSpot: ActivitySpot,
  destination: string = ""
): TransitInfo {
  // If the spot already has high quality custom transit instructions, use it
  if (fromSpot.transitToNext && fromSpot.transitToNext.instructions) {
    return fromSpot.transitToNext;
  }

  const fromName = (fromSpot.name || "").toLowerCase();
  const toName = (toSpot.name || "").toLowerCase();

  // 1. Contextual route pairings for San Sebastián
  if (
    (fromName.includes("concha") && (toName.includes("peine") || toName.includes("ondarreta") || toName.includes("miramar") || toName.includes("igueldo"))) ||
    (fromName.includes("miramar") && (toName.includes("peine") || toName.includes("ondarreta") || toName.includes("igueldo"))) ||
    (fromName.includes("ondarreta") && (toName.includes("peine") || toName.includes("igueldo")))
  ) {
    if (toName.includes("igueldo") || toName.includes("funicular")) {
      return {
        mode: "funicular",
        duration: "4 min ride",
        distance: "300m",
        instructions: "Step across to the 1912 wooden Funicular base station and ride the vintage cars up Monte Igueldo",
      };
    }
    return {
      mode: "walk",
      duration: "8-12 min stroll",
      distance: "750m",
      instructions: "Continue along the scenic Ondarreta beach promenade directly towards the rocky headland of Peine del Viento",
    };
  }

  if (
    (fromName.includes("peine") && (toName.includes("igueldo") || toName.includes("funicular")))
  ) {
    return {
      mode: "funicular",
      duration: "3 min ride",
      distance: "250m",
      instructions: "Walk 2 minutes from the sculptures to the vintage funicular lower station to ascend Monte Igueldo",
    };
  }

  if (
    (fromName.includes("bretxa") || fromName.includes("telmo") || fromName.includes("urgull") || fromName.includes("parte vieja")) &&
    (toName.includes("pintxo") || toName.includes("nestor") || toName.includes("cuchara") || toName.includes("ganbara") || toName.includes("viña") || toName.includes("parte vieja"))
  ) {
    return {
      mode: "walk",
      duration: "3-5 min walk",
      distance: "250m",
      instructions: "Stroll through the cobblestone pedestrian alleys of Parte Vieja towards Calle 31 de Agosto",
    };
  }

  if (
    (fromName.includes("zurriola") || fromName.includes("kursaal")) &&
    (toName.includes("sagüés") || toName.includes("sagues") || toName.includes("gros") || toName.includes("sea wall"))
  ) {
    return {
      mode: "walk",
      duration: "6-8 min walk",
      distance: "500m",
      instructions: "Walk along the Zurriola beach boardwalk towards the Sagüés sea wall overlooking the surf break",
    };
  }

  if (
    toName.includes("cider") || toName.includes("sagardo") || toName.includes("astigarraga") ||
    fromName.includes("cider") || fromName.includes("sagardo") || fromName.includes("astigarraga")
  ) {
    return {
      mode: "transit",
      duration: "15 min bus / cider shuttle",
      distance: "6.5 km",
      instructions: "Catch the local A1/BU12 bus line or short taxi to the Astigarraga ciderhouse orchard valley",
    };
  }

  if (
    toName.includes("santa clara") || fromName.includes("santa clara") ||
    toName.includes("motoras") || fromName.includes("motoras")
  ) {
    return {
      mode: "boat",
      duration: "8 min shuttle boat",
      distance: "1.2 km",
      instructions: "Board the red-and-white Las Motoras ferry boat at San Sebastián fishing port to cross the bay",
    };
  }

  // 2. Compute Haversine distance from coordinates
  const lat1 = fromSpot.coordinates?.lat;
  const lon1 = fromSpot.coordinates?.lng;
  const lat2 = toSpot.coordinates?.lat;
  const lon2 = toSpot.coordinates?.lng;

  if (lat1 && lon1 && lat2 && lon2) {
    const R = 6371e3; // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = Math.round(R * c);

    if (distanceMeters <= 400) {
      return {
        mode: "walk",
        duration: "3-5 min walk",
        distance: `${distanceMeters}m`,
        instructions: `Short scenic stroll (${distanceMeters}m) directly to ${toSpot.name}`,
      };
    } else if (distanceMeters <= 1400) {
      const walkMins = Math.max(5, Math.round(distanceMeters / 75));
      return {
        mode: "walk",
        duration: `${walkMins} min walk`,
        distance: `${distanceMeters}m`,
        instructions: `Pleasant walk (${distanceMeters}m) through the neighborhood towards ${toSpot.name}`,
      };
    } else {
      const km = (distanceMeters / 1000).toFixed(1);
      const transitMins = Math.max(8, Math.round(8 + distanceMeters / 350));
      return {
        mode: "transit",
        duration: `${transitMins} min transit / taxi`,
        distance: `${km} km`,
        instructions: `Short bus ride or quick taxi (${km} km) to ${toSpot.name}`,
      };
    }
  }

  // Fallback
  return {
    mode: "walk",
    duration: "6 min walk",
    distance: "400m",
    instructions: `Direct walk to ${toSpot.name}`,
  };
}

