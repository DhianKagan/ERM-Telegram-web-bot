// Переключатель светлой и тёмной темы
// Модули: React, контекст темы, кнопка shadcn
import React, { useContext } from 'react';
import { Button } from '@/components/ui/button';
import { ThemeContext } from '../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme } = useContext(ThemeContext);
  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  return (
    <Button
      variant="pill"
      size="pill"
      onClick={toggle}
      aria-label="Тема"
      className={className}
    >
      {theme === 'dark' ? '🌙' : '☀️'}
    </Button>
  );
}
