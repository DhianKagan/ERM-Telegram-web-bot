// Глобальный модуль поиска
// Модули: React, heroicons, i18next, ui
import React from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import useTasks from '../context/useTasks';

export type GlobalSearchHandle = {
  search: () => void;
  reset: () => void;
};

type GlobalSearchProps = {
  showActions?: boolean;
  className?: string;
};

const GlobalSearch = React.forwardRef<GlobalSearchHandle, GlobalSearchProps>(
  ({ showActions = true, className }, forwardedRef) => {
    const { query, setQuery } = useTasks();
    const { t } = useTranslation();
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [value, setValue] = React.useState(query);

    const clear = () => {
      setValue('');
      setQuery('');
      inputRef.current?.focus();
    };

    const search = () => {
      setQuery(value);
    };

    React.useImperativeHandle(forwardedRef, () => ({
      search,
      reset: clear,
    }));

    const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        clear();
        inputRef.current?.blur();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        search();
      }
    };

    return (
      <div
        className={cn('flex w-full flex-wrap items-center gap-2', className)}
      >
        <div className="relative w-full min-w-[12rem] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKey}
            placeholder={t('search')}
            aria-label={t('search')}
            className="w-full pl-9 pr-9"
          />
          {value ? (
            <button
              onClick={clear}
              aria-label="Очистить"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XMarkIcon className="size-4" />
            </button>
          ) : null}
        </div>
        {showActions ? (
          <>
            <Button type="button" size="sm" variant="primary" onClick={search}>
              {t('find')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={clear}>
              Сбросить
            </Button>
          </>
        ) : null}
      </div>
    );
  },
);

GlobalSearch.displayName = 'GlobalSearch';

export default GlobalSearch;
