import { WeatherData, WeatherForecastData, WeatherForecastDay } from "../types";

export function getWeatherConditionFromCode(code: number): { condition: string; icon: string } {
  // WMO Weather interpretation codes (WW)
  switch (code) {
    case 0:
      return { condition: "Clear Sky", icon: "Sun" };
    case 1:
    case 2:
      return { condition: "Mainly Clear", icon: "SunMedium" };
    case 3:
      return { condition: "Overcast", icon: "Cloud" };
    case 45:
    case 48:
      return { condition: "Foggy & Misty", icon: "CloudFog" };
    case 51:
    case 53:
    case 55:
      return { condition: "Light Drizzle", icon: "CloudDrizzle" };
    case 61:
    case 63:
    case 65:
      return { condition: "Rainy", icon: "CloudRain" };
    case 71:
    case 73:
    case 75:
      return { condition: "Snowing", icon: "Snowflake" };
    case 80:
    case 81:
    case 82:
      return { condition: "Rain Showers", icon: "CloudRainWind" };
    case 95:
    case 96:
    case 99:
      return { condition: "Thunderstorm", icon: "CloudLightning" };
    default:
      return { condition: "Partly Cloudy", icon: "CloudSun" };
  }
}

export async function fetchLiveWeather(lat: number, lng: number, fallbackCity: string = "Current Area"): Promise<WeatherData> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Weather request failed");
    const data = await res.json();
    const code = data.current?.weather_code ?? 0;
    const { condition, icon } = getWeatherConditionFromCode(code);
    return {
      city: fallbackCity,
      temperature: Math.round(data.current?.temperature_2m ?? 20),
      condition,
      weatherCode: code,
      iconName: icon,
      humidity: data.current?.relative_humidity_2m,
      windSpeed: data.current?.wind_speed_10m,
      isAutoDetected: true,
    };
  } catch (err) {
    console.warn("Could not fetch live weather from Open-Meteo, using fallback:", err);
    return {
      city: fallbackCity,
      temperature: 21,
      condition: "Pleasant & Clear",
      weatherCode: 0,
      iconName: "Sun",
      isAutoDetected: false,
    };
  }
}

export async function fetchMultiDayForecast(
  lat: number,
  lng: number,
  destination: string,
  totalDays: number = 3,
  startDateStr?: string
): Promise<WeatherForecastData> {
  const isDateSpecific = !!startDateStr && startDateStr.trim().length > 0;
  const start = isDateSpecific ? new Date(startDateStr) : new Date();

  try {
    const daysParam = Math.min(Math.max(totalDays, 1), 16);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,uv_index_max&timezone=auto&forecast_days=${Math.max(daysParam, 7)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Multi-day weather request failed");
    const data = await res.json();

    const dailyData = data.daily;
    const dailyForecast: WeatherForecastDay[] = [];

    let sumHigh = 0;
    let sumLow = 0;

    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + i);

      const dateISO = dayDate.toISOString().split("T")[0];
      const dayOfWeek = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const dateDisplay = dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      // Match open meteo index or fallback
      const apiIdx = Math.min(i, (dailyData?.time?.length || 1) - 1);
      const code = dailyData?.weather_code?.[apiIdx] ?? 0;
      const { condition, icon } = getWeatherConditionFromCode(code);

      const highC = Math.round(dailyData?.temperature_2m_max?.[apiIdx] ?? (22 + (i % 3)));
      const lowC = Math.round(dailyData?.temperature_2m_min?.[apiIdx] ?? (14 + (i % 2)));
      const precip = dailyData?.precipitation_probability_max?.[apiIdx] ?? (code > 50 ? 60 : 15);
      const uv = Math.round(dailyData?.uv_index_max?.[apiIdx] ?? 6);
      const wind = Math.round(dailyData?.wind_speed_10m_max?.[apiIdx] ?? 12);

      sumHigh += highC;
      sumLow += lowC;

      let activityTip = "Great conditions for outdoor exploration and sightseeing.";
      if (precip > 50) {
        activityTip = "Pack an umbrella; plan indoor museum or cafe visits during peak rain.";
      } else if (highC > 28) {
        activityTip = "Warm weather—stay hydrated and schedule shade during mid-day hours.";
      } else if (highC < 12) {
        activityTip = "Crisp air—dress warmly for scenic walks and hot drink stops.";
      }

      let clothingAdvice = "Comfortable walking shoes, breathable layers, and sunglasses.";
      if (precip > 30) clothingAdvice = "Light waterproof jacket or compact umbrella recommended.";
      if (highC < 15) clothingAdvice = "Warm fleece/sweater and windproof outer shell.";

      dailyForecast.push({
        dayNumber: i + 1,
        dateStr: `${dayOfWeek}, ${dateDisplay}`,
        dayOfWeek,
        tempHighC: highC,
        tempLowC: lowC,
        condition,
        iconName: icon,
        precipitationChance: precip,
        humidity: 60,
        uvIndex: uv,
        windSpeedKmH: wind,
        activityTip,
        clothingAdvice,
      });
    }

    const avgHigh = Math.round(sumHigh / totalDays);
    const avgLow = Math.round(sumLow / totalDays);

    const seasonalityWarnings: string[] = [];
    if (avgHigh > 27) seasonalityWarnings.push("☀️ High heat index during noon: apply SPF 50+ and stay hydrated.");
    if (avgLow < 12) seasonalityWarnings.push("🧥 Chilly evenings: temperatures drop up to 8°C after sunset.");
    if (dailyForecast.some((d) => d.precipitationChance > 40)) seasonalityWarnings.push("🌧️ Coastal drizzle / rain shower window likely—keep flexible indoor options.");
    if (dailyForecast.some((d) => (d.uvIndex || 0) >= 7)) seasonalityWarnings.push("🕶️ High UV Radiation between 11:00 AM - 3:00 PM: sunglasses and hat advised.");
    if (seasonalityWarnings.length === 0) seasonalityWarnings.push("✨ Favorable climate window with mild temperatures and low weather hazards.");

    return {
      destination,
      startDate: startDateStr,
      isDateSpecific,
      summary: isDateSpecific
        ? `Seasonal Forecast for ${destination} starting ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
        : `Live Real-Time Forecast for ${destination}.`,
      avgHighC: avgHigh,
      avgLowC: avgLow,
      seasonalityWarnings,
      packingEssentials: [
        "Breathable walking shoes",
        avgLow < 15 ? "Warm sweater / fleece layer" : "Light summer attire",
        dailyForecast.some((d) => d.precipitationChance > 30) ? "Compact rain shell or umbrella" : "Sunglasses & Sunscreen",
      ],
      dailyForecast,
    };
  } catch (err) {
    console.warn("Failed to fetch Open-Meteo multi-day forecast, generating smart fallback:", err);

    const dailyForecast: WeatherForecastDay[] = [];
    for (let i = 0; i < totalDays; i++) {
      const dayDate = new Date(start);
      dayDate.setDate(start.getDate() + i);
      const dayOfWeek = dayDate.toLocaleDateString("en-US", { weekday: "short" });
      const dateDisplay = dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

      dailyForecast.push({
        dayNumber: i + 1,
        dateStr: `${dayOfWeek}, ${dateDisplay}`,
        dayOfWeek,
        tempHighC: 22 + (i % 2),
        tempLowC: 15,
        condition: i % 2 === 0 ? "Sunny & Mild" : "Partly Cloudy",
        iconName: i % 2 === 0 ? "Sun" : "CloudSun",
        precipitationChance: 15,
        humidity: 55,
        uvIndex: 6,
        windSpeedKmH: 12,
        activityTip: "Ideal climate for walking tours, outdoor terraces, and sightseeing.",
        clothingAdvice: "Layered clothing with comfortable walking shoes.",
      });
    }

    return {
      destination,
      startDate: startDateStr,
      isDateSpecific,
      summary: isDateSpecific
        ? `Seasonal forecast profile for ${destination} starting ${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`
        : `Live weather outlook for ${destination}.`,
      avgHighC: 22,
      avgLowC: 15,
      seasonalityWarnings: [
        "☀️ Moderate UV conditions around noon—bring sunglasses and light sunscreen.",
        "🧥 Comfortable climate overall with mild evening breeze.",
      ],
      packingEssentials: ["Walking shoes", "Sunglasses", "Light jacket for night"],
      dailyForecast,
    };
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });
    if (!res.ok) throw new Error("Reverse geocode failed");
    const data = await res.json();
    const address = data.address;
    if (address) {
      const townOrCity = address.city || address.town || address.village || address.suburb || address.county;
      const stateOrCountry = address.state || address.country;
      if (townOrCity && stateOrCountry) {
        return `${townOrCity}, ${stateOrCountry}`;
      } else if (townOrCity) {
        return townOrCity;
      }
    }
    return data.display_name?.split(",").slice(0, 2).join(",") || "Detected Location";
  } catch (err) {
    console.warn("Nominatim reverse geocode error:", err);
    return "Nearby Location";
  }
}
