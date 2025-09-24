"use client";

// Назначение файла: базовые элементы таблицы на Tailwind
// Модули: React, util cn
import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto scroll-smooth rounded-xl border border-border/70 bg-background shadow-sm dark:border-border/60 lg:overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "min-w-full table-auto caption-bottom font-ui text-[12px] leading-tight text-foreground dark:text-foreground",
          "sm:text-[13px]",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-background dark:bg-background", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

type TableRowProps = React.ComponentProps<"tr"> & {
  variant?: "body" | "header" | "footer";
};

function TableRow({ className, variant = "body", ...props }: TableRowProps) {
  const isBodyRow = variant === "body";
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "group relative isolate transition-colors",
        isBodyRow
          ? [
              "odd:bg-sky-50/70 even:bg-emerald-50/70 dark:odd:bg-slate-800/70 dark:even:bg-slate-700/70",
              "odd:text-slate-900 even:text-slate-900 dark:odd:text-slate-100 dark:even:text-slate-100",
              "hover:odd:bg-sky-100/80 hover:even:bg-emerald-100/80 dark:hover:odd:bg-slate-700 dark:hover:even:bg-slate-600",
            ]
          : "bg-muted/80",
        "data-[state=selected]:bg-transparent data-[state=selected]:text-foreground",
        "dark:data-[state=selected]:bg-transparent dark:data-[state=selected]:text-foreground",
        "min-h-[2.25rem] text-[12px] sm:min-h-[2.5rem] sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground border-b border-border/70 px-1.5 py-1.5 text-left align-middle font-semibold",
        "text-[11px] leading-snug sm:px-2 sm:text-[13px]",
        "whitespace-normal [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "relative z-[1] px-1.5 py-1.5 align-middle text-[12px] leading-snug",
        "data-[state=selected]:bg-muted/80 data-[state=selected]:text-foreground",
        "dark:data-[state=selected]:bg-muted/50 dark:data-[state=selected]:text-foreground",
        "sm:px-2 sm:text-sm",
        "whitespace-normal [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
};
