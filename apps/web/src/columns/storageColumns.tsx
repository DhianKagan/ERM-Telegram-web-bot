// Конфигурация колонок таблицы файлов хранилища
// Основные модули: React, @tanstack/react-table, heroicons
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowDownTrayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import EmployeeLink from "../components/EmployeeLink";
import type { StoredFile } from "../services/storage";

export interface StorageRow extends StoredFile {
  sizeLabel: string;
  uploadedLabel: string;
  userDisplay: string;
  userHint: string;
  taskDisplay: string;
  taskParam?: string;
  taskLink?: string;
  onDownload: () => void;
  onDelete: () => void;
}

interface Labels {
  name: string;
  user: string;
  type: string;
  size: string;
  task: string;
  uploaded: string;
  download: string;
  delete: string;
  taskTitleHint: (title: string) => string;
}

const userBadgeClass = [
  "inline-flex max-w-full items-center gap-1",
  "rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 shadow-xs",
  "transition-colors duration-150 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
  "dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100",
].join(" ");

export default function createStorageColumns(
  labels: Labels,
  options: { onTaskOpen?: (taskId: string) => void } = {},
): ColumnDef<StorageRow, any>[] {
  const handleTaskOpen = options.onTaskOpen;
  return [
    {
      header: labels.name,
      accessorKey: "name",
      meta: { minWidth: "12rem", maxWidth: "20rem", renderAsBadges: false },
      cell: ({ row }) => {
        const file = row.original;
        return (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate font-medium" title={file.name}>
              {file.name}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  file.onDownload();
                }}
                className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
                aria-label={labels.download}
              >
                <ArrowDownTrayIcon className="mr-1 size-4" aria-hidden />
                {labels.download}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  file.onDelete();
                }}
                className="inline-flex items-center rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100"
                aria-label={labels.delete}
              >
                <TrashIcon className="mr-1 size-4" aria-hidden />
                {labels.delete}
              </button>
            </div>
          </div>
        );
      },
    },
    {
      header: labels.user,
      accessorKey: "userDisplay",
      meta: { minWidth: "8rem", maxWidth: "12rem", renderAsBadges: false },
      cell: ({ row }) => {
        const file = row.original;
        const label = file.userDisplay;
        if (!file.userId) {
          return (
            <span className="truncate text-sm" title={file.userHint}>
              {label}
            </span>
          );
        }
        return (
          <EmployeeLink
            employeeId={file.userId}
            stopPropagation
            className={userBadgeClass}
            title={file.userHint}
          >
            <span className="truncate">{label}</span>
          </EmployeeLink>
        );
      },
    },
    {
      header: labels.type,
      accessorKey: "type",
      meta: { minWidth: "8rem", maxWidth: "10rem" },
      cell: ({ row }) => row.original.type || "",
    },
    {
      header: labels.size,
      accessorKey: "sizeLabel",
      meta: { minWidth: "6rem", maxWidth: "8rem" },
      cell: ({ row }) => row.original.sizeLabel,
    },
    {
      header: labels.task,
      accessorKey: "taskDisplay",
      meta: { minWidth: "10rem", maxWidth: "16rem", renderAsBadges: false },
      cell: ({ row }) => {
        const file = row.original;
        const content = (
          <span className="block">
            {file.taskDisplay}
            {file.taskTitle ? (
              <span className="block text-xs text-muted-foreground">
                {file.taskTitle}
              </span>
            ) : null}
          </span>
        );
        if (!file.taskParam) {
          return content;
        }
        if (handleTaskOpen) {
          return (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleTaskOpen(file.taskParam as string);
              }}
              className="inline-flex w-full flex-col items-start gap-0.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs font-semibold text-blue-700 transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
              title={
                file.taskTitle
                  ? labels.taskTitleHint(file.taskTitle)
                  : undefined
              }
            >
              {content}
            </button>
          );
        }
        if (file.taskLink) {
          return (
            <a
              href={file.taskLink}
              className="inline-flex w-full flex-col items-start gap-0.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-left text-xs font-semibold text-blue-700 no-underline transition hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100"
              onClick={(event) => event.stopPropagation()}
              title={
                file.taskTitle
                  ? labels.taskTitleHint(file.taskTitle)
                  : undefined
              }
            >
              {content}
            </a>
          );
        }
        return content;
      },
    },
    {
      header: labels.uploaded,
      accessorKey: "uploadedLabel",
      meta: { minWidth: "10rem", maxWidth: "12rem" },
      cell: ({ row }) => row.original.uploadedLabel,
    },
  ];
}
