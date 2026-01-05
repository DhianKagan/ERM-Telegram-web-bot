// Контекст управления боковой панелью
import React, { useEffect, useState } from 'react';
import { SidebarContext, type SidebarState } from './SidebarContext';

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 1024px)').matches;
  });
  const [open, setOpen] = useState(isDesktop);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');

    const handleChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches);
      if (event.matches) {
        // На десктопе по умолчанию панель открыта,
        // но это не мешает пользователю её закрыть вручную.
        setOpen(true);
      } else {
        setOpen(false);
      }
    };

    setIsDesktop(mediaQuery.matches);
    setOpen(mediaQuery.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Разрешаем переключать панель независимо от размера экрана.
  const toggle = () => setOpen((value) => !value);

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
