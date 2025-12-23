// Провайдер темы и токенов
// Модули: React, next-themes, ThemeContext
import { useState, useEffect, useRef, type ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { ThemeContext, type ThemeTokens } from './ThemeContext';
import presets from '../theme/presets.json';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;max-age=31536000`;
}

const presetMap = presets as Record<string, ThemeTokens>;
const defaultTheme = 'light';
const themeStorageKey = 'theme';

function sanitizeTokens(
  source: unknown,
  base: ThemeTokens,
): Partial<ThemeTokens> | null {
  if (!source || typeof source !== 'object') return null;
  const sanitized: Partial<ThemeTokens> = {};
  for (const [key, value] of Object.entries(
    source as Record<string, unknown>,
  )) {
    if (typeof value === 'string' && key in base) {
      sanitized[key as keyof ThemeTokens] = value;
    }
  }
  return Object.keys(sanitized).length ? sanitized : null;
}

function readThemeStorage(): string | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(themeStorageKey);
  return stored && presetMap[stored] ? stored : null;
}

function readThemeCookie(): string | null {
  const cookieTheme = getCookie('theme');
  return cookieTheme && presetMap[cookieTheme] ? cookieTheme : null;
}

function readInitialTheme(): string {
  return readThemeStorage() || readThemeCookie() || defaultTheme;
}

function readTokensCookie(
  theme: string,
  base: ThemeTokens,
): Partial<ThemeTokens> | null {
  const raw = getCookie('theme-tokens');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    if ('theme' in parsed || 'tokens' in parsed) {
      const cookieTheme = (parsed as { theme?: unknown }).theme;
      if (typeof cookieTheme === 'string' && cookieTheme !== theme) {
        return null;
      }
      const cookieTokens = sanitizeTokens(
        (parsed as { tokens?: unknown }).tokens,
        base,
      );
      return cookieTokens;
    }
    return sanitizeTokens(parsed, base);
  } catch {
    return null;
  }
}

function mergeWithPreset(
  base: ThemeTokens,
  extra: Partial<ThemeTokens> | null,
): ThemeTokens {
  if (!extra) return base;
  return { ...extra, ...base } as ThemeTokens;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const initialTheme = readInitialTheme();
  const initialBase = presetMap[initialTheme] || presetMap[defaultTheme];
  const [theme, setTheme] = useState(initialTheme);
  const [tokens, setTokens] = useState<ThemeTokens>(() =>
    mergeWithPreset(initialBase, readTokensCookie(initialTheme, initialBase)),
  );

  const appliedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!presetMap[theme]) {
      setTheme(defaultTheme);
      return;
    }
    const base = presetMap[theme] || presetMap[defaultTheme];
    setTokens(mergeWithPreset(base, readTokensCookie(theme, base)));
  }, [theme]);

  useEffect(() => {
    const root = document.documentElement;
    const currentKeys = new Set<string>();
    for (const [k, v] of Object.entries(tokens)) {
      root.style.setProperty(`--${k}`, v);
      currentKeys.add(k);
    }
    for (const key of appliedKeys.current) {
      if (!currentKeys.has(key)) {
        root.style.removeProperty(`--${key}`);
      }
    }
    appliedKeys.current = currentKeys;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset.theme = `erm-${theme}`;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(themeStorageKey, theme);
    }
    setCookie('theme', theme);
    setCookie('theme-tokens', JSON.stringify({ theme, tokens }));
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
