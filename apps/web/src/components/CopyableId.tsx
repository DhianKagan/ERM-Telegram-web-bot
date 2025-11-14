// Назначение файла: компонент кнопки-чипа для копирования идентификаторов
// Основные модули: React, heroicons, cn util
import React from 'react';
import { CheckIcon, DocumentDuplicateIcon } from '@heroicons/react/24/outline';

import { cn } from '@/lib/utils';

interface CopyableIdProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  displayValue?: string;
  copyHint?: string;
  copiedHint?: string;
  onCopy?: (payload: { value: string }) => void;
}

export default function CopyableId({
  value,
  displayValue,
  copyHint,
  copiedHint,
  onCopy,
  className,
  disabled,
  ...props
}: CopyableIdProps) {
  const [copied, setCopied] = React.useState(false);
  const resetTimerRef = React.useRef<number>();

  const textToShow = displayValue ?? value;
  const defaultCopyHint = copyHint ?? 'Copy';
  const defaultCopiedHint = copiedHint ?? 'Copied';

  React.useEffect(() => {
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!copied) return;
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
    return () => {
      if (resetTimerRef.current) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, [copied]);

  const handleCopy = async () => {
    if (!value || disabled) return;
    const performCopy = async () => {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      if (typeof document === 'undefined') {
        return false;
      }
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const result = document.execCommand('copy');
        return result;
      } catch {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    };

    try {
      const success = await performCopy();
      if (success) {
        setCopied(true);
      }
    } finally {
      onCopy?.({ value });
    }
  };

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-gray-300)]',
        'bg-[color:var(--color-gray-25)] px-3 py-1 text-[11px] font-semibold tracking-wide text-[color:var(--color-gray-700)]',
        'transition-colors duration-150 ease-out hover:border-[color:var(--color-brand-400)] hover:bg-[color:var(--color-brand-50)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand-500)] focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:border-[color:var(--color-gray-200)] disabled:text-[color:var(--color-gray-400)]',
        'dark:border-[color:var(--color-gray-700)] dark:bg-[color:var(--color-gray-dark)] dark:text-[color:var(--color-gray-100)]',
        'dark:hover:border-[color:var(--color-brand-400)] dark:hover:bg-[color:var(--color-gray-800)]',
        className,
      )}
      onClick={handleCopy}
      title={copied ? defaultCopiedHint : defaultCopyHint}
      aria-pressed={copied}
      aria-live="polite"
      disabled={disabled}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        {copied ? (
          <CheckIcon
            className="h-4 w-4 text-[color:var(--color-brand-500)] dark:text-[color:var(--color-brand-400)]"
            aria-hidden="true"
          />
        ) : (
          <DocumentDuplicateIcon
            className="h-4 w-4 text-[color:var(--color-gray-500)] dark:text-[color:var(--color-gray-300)]"
            aria-hidden="true"
          />
        )}
        <span className="truncate text-left">{textToShow}</span>
      </span>
      <span className="sr-only">
        {copied ? defaultCopiedHint : defaultCopyHint}
      </span>
    </button>
  );
}
