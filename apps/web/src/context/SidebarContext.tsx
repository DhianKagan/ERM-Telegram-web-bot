// Контекст управления боковой панелью
import React, { useEffect, useState } from 'react';
import { SidebarContext } from './SidebarContext';

const SIDEBAR_COLLAPSED_KEY = 'erm-sidebar-collapsed';

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    const isWide = window.matchMedia('(min-width: 1024px)').matches;
    if (!isWide) return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      if (!event.matches) {
        setOpen(false);
        return;
      }
      setOpen(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true');
    };

    setIsDesktop(mediaQuery.matches);
    if (mediaQuery.matches) {
      setOpen(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true');
    } else {
      setOpen(false);
    }
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggle = () =>
    setOpen((value) => {
      const next = !value;
      if (typeof window !== 'undefined' && isDesktop) {
        window.localStorage.setItem(
          SIDEBAR_COLLAPSED_KEY,
          next ? 'false' : 'true',
        );
      }
      return next;
    });

  return (
    <SidebarContext.Provider
      value={{
        open,
        toggle,
        setOpen,
        isDesktop,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};
