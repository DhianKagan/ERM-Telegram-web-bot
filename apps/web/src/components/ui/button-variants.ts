// Назначение: варианты оформления кнопок; экспортирует функцию buttonVariants.
// Основные модули: class-variance-authority.

import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent text-sm font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-200",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-200",
        outline:
          "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-200",
        secondary:
          "bg-slate-100 text-slate-700 hover:bg-slate-200 focus-visible:ring-slate-200",
        ghost:
          "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-200",
        link: "text-indigo-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-2 has-[>svg]:px-3",
        sm: "px-3 py-1.5 has-[>svg]:px-2.5 text-sm",
        lg: "px-5 py-2.5 has-[>svg]:px-4 text-base",
        icon: "p-2 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
