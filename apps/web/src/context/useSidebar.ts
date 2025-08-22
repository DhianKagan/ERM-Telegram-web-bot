// Хук доступа к состоянию боковой панели
import { useContext } from "react";
import { SidebarContext } from "./SidebarContext";

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("SidebarContext");
  return ctx;
}
