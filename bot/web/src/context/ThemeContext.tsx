// Контекст темы без переключателя, поддерживается только светлая схема
import React from "react";
import { ThemeContext, type ThemeState } from "./ThemeContext";


export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = "light";
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove("dark");
    document.body.classList.remove("dark");
    localStorage.setItem("theme", "light");
  }
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggle: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};



