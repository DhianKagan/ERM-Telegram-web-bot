// Хук доступа к токенам темы
// Модули: React, ThemeContext
import { useContext } from "react";
import { ThemeContext } from "./ThemeContext";

export function useTheme() {
  return useContext(ThemeContext);
}
