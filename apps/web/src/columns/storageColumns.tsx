// Конфигурация колонок таблицы файлов хранилища
// Основные модули: React, @tanstack/react-table, react-router-dom, heroicons
import React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router-dom";
import {
  ArrowDownTrayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import type { StoredFile } from "../services/storage";

export interface StorageRow extends StoredFile {
  sizeLabel: string;
  uploadedLabel: string;
  userLabel: string;
  taskLabel: string;
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
}

export default function createStorageColumns(
  labels: Labels,
): ColumnDef<StorageRow, any>[] {
  return [
    {
      header: labels.name,
      accessorKey: "name",
      meta: { minWidth: "12rem", maxWidth: "20rem" },
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
      accessorKey: "userLabel",
      meta: { minWidth: "6rem", maxWidth: "10rem" },
      cell: ({ row }) => row.original.userLabel,
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
      accessorKey: "taskLabel",
      meta: { minWidth: "8rem", maxWidth: "12rem" },
      cell: ({ row }) => {
        const file = row.original;
        if (!file.taskId) return <span>{file.taskLabel}</span>;
        if (!file.taskLink) return <span>{file.taskLabel}</span>;
        return (
          <Link
            to={file.taskLink}
            className="text-blue-600 underline"
            onClick={(event) => event.stopPropagation()}
          >
            {file.taskLabel}
          </Link>
        );
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
