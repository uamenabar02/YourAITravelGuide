import { ItineraryPlan, WeatherForecastData } from "../types";

export interface PackingItem {
  id: string;
  category: "essentials" | "weather" | "activities" | "electronics" | "health" | "custom";
  item: string;
  reason?: string;
  isPacked: boolean;
  isCustom?: boolean;
}

export interface PackingCategoryGroup {
  id: "essentials" | "weather" | "activities" | "electronics" | "health" | "custom";
  title: string;
  icon: string;
  items: PackingItem[];
}

const STORAGE_PREFIX = "localexplorer_packing_v1_";

export function getStoredPackingList(planId: string): PackingItem[] | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${planId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load packing list:", err);
    return null;
  }
}

export function savePackingList(planId: string, items: PackingItem[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${planId}`, JSON.stringify(items));
  } catch (err) {
    console.error("Failed to save packing list:", err);
  }
}

export function generateSmartPackingList(plan: ItineraryPlan): PackingItem[] {
  const existing = getStoredPackingList(plan.id);
  if (existing && existing.length > 0) {
    return existing;
  }

  const items: PackingItem[] = [];
  let itemCounter = 1;
  const addItem = (
    category: PackingItem["category"],
    item: string,
    reason?: string
  ) => {
    items.push({
      id: `pack-${itemCounter++}`,
      category,
      item,
      reason,
      isPacked: false,
    });
  };

  // 1. Essentials & Core Documents
  addItem("essentials", "Passport / Photo National ID", "Required for travel & hotel check-in");
  addItem("essentials", "Boarding passes & Travel vouchers", "Available in your Travel Wallet hub");
  addItem("essentials", "Credit/Debit Cards & Local Cash", "For local transportation & tipping");
  addItem("essentials", "Travel & Health Insurance Card", "Proof of coverage for emergency care");
  if (plan.accommodation) {
    addItem("essentials", `Hotel Confirmation (${plan.accommodation.name})`, "Check-in pin & address details");
  }

  // 2. Weather-Aware Clothing & Apparel
  const forecast: WeatherForecastData | undefined = plan.weatherForecast;
  const avgHigh = forecast?.avgHighC ?? 20;
  const avgLow = forecast?.avgLowC ?? 12;
  const maxPrecip = forecast?.dailyForecast
    ? Math.max(...forecast.dailyForecast.map((d) => d.precipitationChance))
    : 10;
  const maxUv = forecast?.dailyForecast
    ? Math.max(...forecast.dailyForecast.map((d) => d.uvIndex || 4))
    : 5;

  // Temperature logic
  if (avgLow < 10) {
    addItem("weather", "Heavy Winter Coat / Insulated Parka", `Low temp around ${avgLow}°C`);
    addItem("weather", "Warm Thermal Layers & Sweaters", "Layering for cold mornings & evenings");
    addItem("weather", "Wool Beanie, Gloves & Scarf", "Cold weather protection");
  } else if (avgLow < 18) {
    addItem("weather", "Light Jacket / Windbreaker / Cardigan", `Cooler evenings around ${avgLow}°C`);
    addItem("weather", "Long Trousers & Jeans", "Comfortable temperature balance");
  } else {
    addItem("weather", "Lightweight Linen Shirts & Shorts", `Warm climate with highs around ${avgHigh}°C`);
    addItem("weather", "Breathable Short-Sleeve Tops", "Hot weather comfort");
  }

  // Rain logic
  if (maxPrecip >= 25) {
    addItem("weather", "Compact Travel Umbrella", `${maxPrecip}% chance of rain forecasted`);
    addItem("weather", "Waterproof Rain Jacket / Poncho", "Protection during outdoor walking");
  }

  // Sun & UV logic
  if (maxUv >= 5 || avgHigh >= 22) {
    addItem("weather", "UV-Blocking Sunglasses", `High UV index (${maxUv}/10)`);
    addItem("weather", "Sun Hat or Visor", "Sun protection during daytime tours");
  }

  // General apparel rule based on total days
  const days = plan.totalDays || 3;
  addItem("weather", `${Math.min(days + 1, 7)}x Underwear & Socks`, `Base gear for ${days}-day trip`);

  // 3. Activity-Specific Gear
  const categoriesInTrip = new Set<string>();
  plan.days?.forEach((d) => {
    d.activities?.forEach((a) => {
      if (a.category) categoriesInTrip.add(a.category.toLowerCase());
      if (a.tags) a.tags.forEach((t) => categoriesInTrip.add(t.toLowerCase()));
    });
  });

  addItem("activities", "Comfortable Walking Sneakers", "Essential for daily city exploration");

  if (categoriesInTrip.has("nature") || categoriesInTrip.has("hiking") || categoriesInTrip.has("outdoor")) {
    addItem("activities", "Trail Hiking Boots / Grip Shoes", "Outdoor nature trails & uneven terrain");
    addItem("activities", "Daypack Backpack (15-20L)", "Carrying water & extra layers on trails");
  }

  if (categoriesInTrip.has("food") || categoriesInTrip.has("nightlife") || categoriesInTrip.has("culture")) {
    addItem("activities", "Smart Casual / Dinner Evening Outfit", "Refined dining & cultural venues");
  }

  if (categoriesInTrip.has("relaxation") || categoriesInTrip.has("beach") || categoriesInTrip.has("coastal")) {
    addItem("activities", "Swimsuit & Quick-Dry Towel", "Spa, thermal bath or beach relaxation");
    addItem("activities", "Flip-Flops / Sand Shoes", "Poolside or beach footwear");
  }

  addItem("activities", "Refillable Insulated Water Bottle", "Eco-friendly hydration on the go");

  // 4. Electronics & Tech Accessories
  addItem("electronics", "Smartphone & Universal Charger", "Navigation, companion guide & camera");
  addItem("electronics", "Portable Power Bank (10,000+ mAh)", "All-day phone battery backup");
  addItem("electronics", "International Power Adapter", "Plug compatibility at accommodation");
  addItem("electronics", "Noise-Canceling Earbuds / Headphones", "Transit & relaxing background audio");

  // 5. Health, Toiletries & Sun Protection
  if (maxUv >= 4 || avgHigh >= 20) {
    addItem("health", "High SPF Sunscreen (SPF 30+)", "Skin protection for outdoor walking");
  }
  addItem("health", "Prescription Medications & Vitamins", "Personal health routine");
  addItem("health", "Mini First-Aid Kit & Blister Plasters", "For long walking days");
  addItem("health", "Toiletry Kit (Toothbrush, Deodorant, Skincare)", "Daily personal hygiene");
  if (categoriesInTrip.has("nature")) {
    addItem("health", "Insect / Mosquito Repellent Spray", "Protection on nature walks & riversides");
  }

  savePackingList(plan.id, items);
  return items;
}
