// Унифицированный поиск с общими действиями
// Модули: React, heroicons, i18next, ui
import React from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type UnifiedSearchProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  onReset?: () => void;
  placeholder?: string;
  ariaLabel?: string;
  hint?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  actionsClassName?: string;
  showActions?: boolean;
  allowClear?: boolean;
  handleKeys?: boolean;
  actionLabel?: string;
  resetLabel?: string;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function UnifiedSearch({
  id,
  value,
  onChange,
  onSearch,
  onReset,
  placeholder,
  ariaLabel,
  hint,
  className,
  inputClassName,
  actionsClassName,
  showActions = true,
  allowClear = true,
  handleKeys = true,
  actionLabel,
  resetLabel,
  disabled = false,
  autoFocus = false,
}: UnifiedSearchProps) {
  const { t } = useTranslation();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resolvedPlaceholder = placeholder ?? t('search');
  const resolvedAriaLabel = ariaLabel ?? resolvedPlaceholder;
  const resolvedActionLabel = actionLabel ?? t('find');
  const resolvedResetLabel = resetLabel ?? t('reset');

  const handleReset = React.useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      onChange('');
    }
    inputRef.current?.focus();
  }, [onChange, onReset]);

  const handleSearch = React.useCallback(() => {
    onSearch?.();
  }, [onSearch]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!handleKeys) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      handleReset();
      inputRef.current?.blur();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      handleSearch();
    }
  };

  return (
    <div className={cn('flex w-full flex-col gap-1', className)}>
      <div className="flex w-full flex-wrap items-center gap-2">
        <div className="relative w-full min-w-[12rem] flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={id}
            ref={inputRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={resolvedPlaceholder}
            aria-label={resolvedAriaLabel}
            disabled={disabled}
            autoFocus={autoFocus}
            className={cn('w-full pl-9 pr-9', inputClassName)}
          />
          {allowClear && value ? (
            <button
              type="button"
              onClick={handleReset}
              aria-label={resolvedResetLabel}
              className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <XMarkIcon className="size-4" />
            </button>
          ) : null}
        </div>
        {showActions ? (
          <div
            className={cn(
              'flex flex-wrap items-center justify-end gap-2',
              actionsClassName,
            )}
          >
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={handleSearch}
              disabled={disabled}
            >
              {resolvedActionLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleReset}
              disabled={disabled}
            >
              {resolvedResetLabel}
            </Button>
          </div>
        ) : null}
      </div>
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </div>
  );
}
