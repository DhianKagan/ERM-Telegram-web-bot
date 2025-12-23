// Переключатель темы с сохранением в localStorage
// Модули: React, ThemeContext, Button
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/useTheme';

interface ThemeToggleProps {
  className?: string;
}

const themeStorageKey = 'theme';

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.dataset.theme = `erm-${theme}`;
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const toggle = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    if (typeof window !== 'undefined') {
      document.documentElement.dataset.theme = `erm-${nextTheme}`;
      window.localStorage.setItem(themeStorageKey, nextTheme);
    }
    setTheme(nextTheme);
  };

  return (
    <Button
      variant="pill"
      size="pill"
      onClick={toggle}
      aria-label="Тема"
      className={className}
      type="button"
    >
      {isDark ? '🌙' : '☀️'}
    </Button>
  );
}
