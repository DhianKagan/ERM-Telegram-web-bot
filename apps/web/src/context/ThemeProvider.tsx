// Провайдер темы и токенов
// Модули: React, next-themes, ThemeContext
import { useState, useEffect, type ReactNode } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ThemeContext, type ThemeTokens } from "./ThemeContext";
import presets from "../theme/presets.json";

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=31536000`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(() => getCookie("theme") || "light");
  const [tokens, setTokens] = useState<ThemeTokens>(() => {
    const saved = getCookie("theme-tokens");
    if (saved) {
      try {
        return JSON.parse(saved) as ThemeTokens;
      } catch {
        /* игнорируем */
      }
    }
    return (presets as Record<string, ThemeTokens>)[theme] || presets.light;
  });

  useEffect(() => {
    const base = (presets as Record<string, ThemeTokens>)[theme];
    if (base) setTokens((t) => ({ ...base, ...t }));
  }, [theme]);

  useEffect(() => {
    for (const [k, v] of Object.entries(tokens)) {
      document.documentElement.style.setProperty(`--${k}`, v);
    }
    document.documentElement.classList.toggle("dark", theme === "dark");
    setCookie("theme", theme);
    setCookie("theme-tokens", JSON.stringify(tokens));
  }, [tokens, theme]);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={theme}
      enableSystem={false}
    >
      <ThemeContext.Provider value={{ theme, setTheme, tokens, setTokens }}>
        {children}
      </ThemeContext.Provider>
    </NextThemesProvider>
  );
}
