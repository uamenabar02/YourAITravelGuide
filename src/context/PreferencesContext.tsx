import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
  rateVsUSD: number; // Conversion rate relative to 1 USD
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyOption> = {
  USD: { code: "USD", symbol: "$", name: "US Dollar ($)", rateVsUSD: 1.0 },
  EUR: { code: "EUR", symbol: "€", name: "Euro (€)", rateVsUSD: 0.92 },
  GBP: { code: "GBP", symbol: "£", name: "British Pound (£)", rateVsUSD: 0.79 },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen (¥)", rateVsUSD: 155.0 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar (A$)", rateVsUSD: 1.52 },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar (C$)", rateVsUSD: 1.35 },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc (CHF)", rateVsUSD: 0.88 },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee (₹)", rateVsUSD: 83.5 },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real (R$)", rateVsUSD: 5.4 },
  MXN: { code: "MXN", symbol: "MXN$", name: "Mexican Peso (MXN$)", rateVsUSD: 18.2 },
};

export type DistanceUnit = "km" | "mi";
export type TemperatureUnit = "C" | "F";

interface PreferencesContextType {
  currency: string;
  currencyOption: CurrencyOption;
  currencySymbol: string;
  distanceUnit: DistanceUnit;
  temperatureUnit: TemperatureUnit;
  theme: string;
  setCurrency: (code: string) => void;
  setDistanceUnit: (unit: DistanceUnit) => void;
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setTheme: (theme: string) => void;
  formatAmount: (amountInUSD: number | string) => string;
  formatDistance: (kmValue: number | string) => string;
  formatTemperature: (celsiusValue: number | string) => string;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

const LOCAL_KEY_CURRENCY = "localexplorer_preferred_currency";
const LOCAL_KEY_DISTANCE = "localexplorer_preferred_distance_unit";
const LOCAL_KEY_TEMP = "localexplorer_preferred_temp_unit";
const LOCAL_KEY_THEME = "localexplorer_theme";

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LOCAL_KEY_CURRENCY) || "USD";
    }
    return "USD";
  });

  const [distanceUnit, setDistanceUnitState] = useState<DistanceUnit>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(LOCAL_KEY_DISTANCE) as DistanceUnit) || "km";
    }
    return "km";
  });

  const [temperatureUnit, setTemperatureUnitState] = useState<TemperatureUnit>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(LOCAL_KEY_TEMP) as TemperatureUnit) || "C";
    }
    return "C";
  });

  const [theme, setThemeState] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(LOCAL_KEY_THEME) || "classic";
    }
    return "classic";
  });

  const setCurrency = useCallback((code: string) => {
    if (SUPPORTED_CURRENCIES[code]) {
      setCurrencyState(code);
      localStorage.setItem(LOCAL_KEY_CURRENCY, code);
    }
  }, []);

  const setDistanceUnit = useCallback((unit: DistanceUnit) => {
    setDistanceUnitState(unit);
    localStorage.setItem(LOCAL_KEY_DISTANCE, unit);
  }, []);

  const setTemperatureUnit = useCallback((unit: TemperatureUnit) => {
    setTemperatureUnitState(unit);
    localStorage.setItem(LOCAL_KEY_TEMP, unit);
  }, []);

  const setTheme = useCallback((newTheme: string) => {
    setThemeState(newTheme);
    localStorage.setItem(LOCAL_KEY_THEME, newTheme);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const themes = ["theme-classic", "theme-emerald", "theme-nordic", "theme-burgundy", "theme-obsidian", "theme-midnight", "theme-forest-dark"];
      document.documentElement.classList.remove(...themes);
      document.documentElement.classList.add(`theme-${theme}`);
    }
  }, [theme]);

  const currencyOption = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.USD;
  const currencySymbol = currencyOption.symbol;

  /**
   * Converts and formats a numeric or string USD amount into the target user currency.
   * If given "$25" or "25", extracts digits and applies exchange rate.
   */
  const formatAmount = useCallback(
    (amountInUSD: number | string): string => {
      if (amountInUSD === null || amountInUSD === undefined || amountInUSD === "") return "";

      let numericVal = 0;
      if (typeof amountInUSD === "number") {
        numericVal = amountInUSD;
      } else {
        const parsed = parseFloat(String(amountInUSD).replace(/[^0-9.]/g, ""));
        if (isNaN(parsed)) return String(amountInUSD);
        numericVal = parsed;
      }

      const converted = numericVal * currencyOption.rateVsUSD;

      if (currency === "JPY" || currency === "INR") {
        return `${currencySymbol}${Math.round(converted).toLocaleString()}`;
      }

      return `${currencySymbol}${converted.toFixed(converted % 1 === 0 ? 0 : 2)}`;
    },
    [currency, currencyOption.rateVsUSD, currencySymbol]
  );

  /**
   * Converts kilometers to km or miles based on preference.
   */
  const formatDistance = useCallback(
    (kmValue: number | string): string => {
      const numericKm = typeof kmValue === "number" ? kmValue : parseFloat(String(kmValue));
      if (isNaN(numericKm)) return String(kmValue);

      if (distanceUnit === "mi") {
        const miles = numericKm * 0.621371;
        return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
      }

      return `${numericKm < 10 ? numericKm.toFixed(1) : Math.round(numericKm)} km`;
    },
    [distanceUnit]
  );

  /**
   * Converts Celsius to °C or °F based on preference.
   */
  const formatTemperature = useCallback(
    (celsiusValue: number | string): string => {
      const numericC = typeof celsiusValue === "number" ? celsiusValue : parseFloat(String(celsiusValue));
      if (isNaN(numericC)) return String(celsiusValue);

      if (temperatureUnit === "F") {
        const fahrenheit = Math.round((numericC * 9) / 5 + 32);
        return `${fahrenheit}°F`;
      }

      return `${Math.round(numericC)}°C`;
    },
    [temperatureUnit]
  );

  const value = useMemo<PreferencesContextType>(
    () => ({
      currency,
      currencyOption,
      currencySymbol,
      distanceUnit,
      temperatureUnit,
      theme,
      setCurrency,
      setDistanceUnit,
      setTemperatureUnit,
      setTheme,
      formatAmount,
      formatDistance,
      formatTemperature,
    }),
    [
      currency,
      currencyOption,
      currencySymbol,
      distanceUnit,
      temperatureUnit,
      theme,
      setCurrency,
      setDistanceUnit,
      setTemperatureUnit,
      setTheme,
      formatAmount,
      formatDistance,
      formatTemperature,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return ctx;
};
