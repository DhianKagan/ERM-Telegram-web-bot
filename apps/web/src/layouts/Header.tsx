// Шапка приложения с кнопкой темы и бургером меню
// Верхняя панель навигации
import React from 'react';
import { Bars3Icon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

import ProfileDropdown from '../components/ProfileDropdown';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useAuth } from '../context/useAuth';
import { useSidebar } from '../context/useSidebar';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';

export default function Header() {
  const { toggle } = useSidebar();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const tabClassName = buttonVariants({ variant: 'pill', size: 'pill' });
  return (
    <header
      className="border-stroke sticky top-0 z-40 w-full border-b bg-white/90 px-4 py-2 shadow-sm backdrop-blur transition-colors dark:bg-slate-900/90"
      data-testid="app-header"
    >
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={toggle}
            variant="pill"
            size="pill"
            aria-label={t('menu')}
            type="button"
          >
            <Bars3Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t('menu')}</span>
          </Button>
          <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            ERM
          </h3>
        </div>
        <nav
          aria-label={t('menu')}
          className="flex flex-wrap items-center gap-2"
        >
          <label htmlFor="lang-select" className="sr-only">
            {t('language')}
          </label>
          <div className={tabClassName} role="presentation">
            <select
              id="lang-select"
              className="bg-transparent text-xs font-semibold uppercase tracking-wide text-slate-700 outline-none focus-visible:outline-none dark:text-slate-100"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              aria-label={t('language')}
            >
              <option value="ru">RU</option>
              <option value="en">EN</option>
            </select>
          </div>
          {user && (
            <>
              <ThemeToggle className={tabClassName} />
              <ProfileDropdown triggerClassName={tabClassName}>
                <UserCircleIcon className="h-4 w-4" />
              </ProfileDropdown>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
