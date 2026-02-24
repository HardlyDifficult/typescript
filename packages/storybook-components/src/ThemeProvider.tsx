"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {return "light";}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") {return null;}
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {return stored;}
  return null;
}

interface ThemeProviderProps {
  defaultTheme?: Theme;
  children: ReactNode;
}

/** Manages `data-theme` attribute on `<html>`, with localStorage persistence and `prefers-color-scheme` sync. */
export function ThemeProvider({
  defaultTheme,
  children,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return getStoredTheme() ?? defaultTheme ?? getSystemTheme();
  });

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      localStorage.setItem(STORAGE_KEY, t);
      applyTheme(t);
    },
    [applyTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [theme, setTheme]);

  // Apply theme on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // Sync with system preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function handleChange() {
      // Only sync if user hasn't explicitly chosen a theme
      if (getStoredTheme() === null) {
        const sys = mq.matches ? "dark" : "light";
        setThemeState(sys);
        applyTheme(sys);
      }
    }
    mq.addEventListener("change", handleChange);
    return () => {
      mq.removeEventListener("change", handleChange);
    };
  }, [applyTheme]);

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

/** Access current theme and controls. Must be used within a `<ThemeProvider>`. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error("useTheme must be used within a <ThemeProvider>");
  }
  return ctx;
}
