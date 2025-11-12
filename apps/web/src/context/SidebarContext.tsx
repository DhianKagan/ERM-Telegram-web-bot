// Контекст управления боковой панелью
import React, { useState } from 'react';
import { SidebarContext, type SidebarState } from './SidebarContext';

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [open, setOpen] = useState(true);
  return (
    <SidebarContext.Provider
      value={{
        open,
        toggle: () => setOpen((v) => !v),
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
