// Контекст состояния боковой панели
import { createContext } from "react";

export interface SidebarState {
  open: boolean;
  toggle: () => void;
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const SidebarContext = createContext<SidebarState | undefined>(
  undefined,
);

// Экспорт провайдера из соседнего файла
export { SidebarProvider } from "./SidebarContext.tsx";
