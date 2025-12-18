// Назначение: варианты оформления кнопок; экспортирует функцию buttonVariants.
// Основные модули: class-variance-authority.

import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] border text-sm font-semibold leading-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-surface)] disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [box-shadow:var(--shadow-sm)]",
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-primary)] text-white border-transparent hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-600)] focus-visible:ring-[var(--color-primary-400)]',
        secondary:
          'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--color-primary)] hover:bg-[var(--bg-muted)] active:bg-[var(--bg-muted)] focus-visible:ring-[var(--color-primary-400)]',
        ghost:
          'border-transparent bg-transparent text-[var(--color-primary)] hover:bg-[var(--bg-muted)] focus-visible:ring-[var(--color-primary-400)]',
        danger:
          'border-transparent bg-[var(--color-danger)] text-white hover:bg-[#dc2626] active:bg-[#b91c1c] focus-visible:ring-[var(--color-danger)]',
        destructive:
          'border-transparent bg-[var(--color-danger)] text-white hover:bg-[#dc2626] active:bg-[#b91c1c] focus-visible:ring-[var(--color-danger)]',
        success:
          'border-transparent bg-[var(--color-success)] text-white hover:bg-[#16a34a] active:bg-[#15803d] focus-visible:ring-[var(--color-success)]',
        outline:
          'border-[var(--border)] bg-[var(--bg-surface)] text-[var(--color-primary)] hover:bg-[var(--bg-muted)] focus-visible:ring-[var(--color-primary-400)]',
        default:
          'border-transparent bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-600)] active:bg-[var(--color-primary-600)] focus-visible:ring-[var(--color-primary-400)]',
        link: 'border-transparent bg-transparent text-[var(--color-primary)] underline underline-offset-4 shadow-none hover:text-[var(--color-primary-600)] focus-visible:ring-[var(--color-primary-400)]',
        pill: 'rounded-full border-[var(--border)] bg-[var(--bg-surface)] text-[var(--color-muted)] hover:bg-[var(--bg-muted)] focus-visible:ring-[var(--color-primary-400)]',
      },
      size: {
        md: 'min-h-[var(--btn-height)] px-[var(--btn-padding-x)] py-[var(--btn-padding-y)] text-sm',
        sm: 'min-h-[36px] px-3 py-2 text-sm',
        lg: 'min-h-[44px] px-5 py-3 text-base',
        xs: 'min-h-[32px] px-3 py-1.5 text-xs',
        pill: 'min-h-[32px] px-3 py-1 text-xs',
        icon: 'min-h-[36px] min-w-[36px] rounded-full p-2',
        'icon-lg': 'min-h-[44px] min-w-[44px] rounded-full p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);
