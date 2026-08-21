import { WeatherData } from "../types";

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
