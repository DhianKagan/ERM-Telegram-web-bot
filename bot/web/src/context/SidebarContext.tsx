// Контекст управления боковой панелью
import React, { createContext, useContext, useState } from "react";

export interface SidebarState {
  open: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarState | undefined>(undefined);

export const useSidebar = () => {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("SidebarContext");
  return ctx;
};

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((v) => !v) }}>
      {children}
    </SidebarContext.Provider>
  );
};
