"use client";

// Назначение файла: базовые элементы таблицы на Tailwind
// Модули: React, util cn
import * as React from "react";

import { cn } from "@/lib/utils";

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto rounded-xl border border-border dark:border-border/60 shadow-sm lg:overflow-x-visible"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom text-[12px] leading-tight text-foreground dark:text-foreground table-auto font-ui border-collapse",
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
        "border-b border-border dark:border-border/60",
        isBodyRow
          ? [
              "before:absolute before:inset-x-1 before:top-0.5 before:bottom-0.5 before:-z-10 before:rounded-[1.35rem] before:opacity-90",
              "before:bg-[repeating-linear-gradient(90deg,rgba(148,163,184,0.24)_0,rgba(148,163,184,0.24)_14%,rgba(100,116,139,0.18)_14%,rgba(100,116,139,0.18)_28%)]",
              "dark:before:bg-[repeating-linear-gradient(90deg,rgba(71,85,105,0.45)_0,rgba(71,85,105,0.45)_14%,rgba(30,41,59,0.55)_14%,rgba(30,41,59,0.55)_28%)]",
              "before:ring-1 before:ring-slate-300/60 before:transition-opacity before:duration-150 dark:before:ring-slate-600/70",
              "hover:before:opacity-100",
            ]
          : "",
        "data-[state=selected]:bg-transparent data-[state=selected]:text-foreground",
        "dark:data-[state=selected]:bg-transparent dark:data-[state=selected]:text-foreground",
        "min-h-[2rem] text-[12px] sm:min-h-[2.25rem] sm:text-sm",
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
        "text-foreground border border-border dark:border-border/60 px-2 py-2 text-left align-middle font-semibold",
        "text-[11px] leading-snug sm:px-2.5 sm:text-[13px]",
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
        "relative z-[1] border border-border dark:border-border/60 px-2 py-1.5 align-top text-[12px] leading-snug",
        "data-[state=selected]:bg-muted data-[state=selected]:text-foreground",
        "dark:data-[state=selected]:bg-muted/50 dark:data-[state=selected]:text-foreground",
        "sm:px-2.5 sm:py-2 sm:text-sm",
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
