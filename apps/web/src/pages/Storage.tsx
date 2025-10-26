// Страница управления файлами: таблица, фильтры и карточка файла
// Основные модули: React, DataTable, heroicons, storageService, react-router
import React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownTrayIcon,
  DocumentIcon,
  DocumentTextIcon,
  PhotoIcon,
  VideoCameraIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

import Breadcrumbs from "../components/Breadcrumbs";
import DataTable from "../components/DataTable";
import Modal from "../components/Modal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import createStorageColumns, {
  type StorageRow,
} from "../columns/storageColumns";
import {
  fetchFile,
  fetchFiles,
  removeFile,
  runDiagnostics,
  type StorageDiagnosticsReport,
  type StoredFile,
} from "../services/storage";
import { fetchUsers } from "../services/users";
import type { User } from "../types/user";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from "shared";

const PAGE_SIZE = 25;

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

type SortOption = "uploaded_desc" | "uploaded_asc" | "size_desc" | "size_asc";

type PreviewMode = "image" | "video" | "pdf" | "text";

type PreviewState = {
  mode: PreviewMode;
  inlineUrl: string;
  mime: string;
  loading?: boolean;
  error?: string;
  content?: string;
};

const previewIcons: Record<PreviewMode, React.ComponentType<{ className?: string }>> = {
  image: PhotoIcon,
  video: VideoCameraIcon,
  pdf: DocumentIcon,
  text: DocumentTextIcon,
};

function isTextLike(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime.includes("json") ||
    mime.endsWith("xml") ||
    mime === "application/sql"
  );
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || Number.isNaN(bytes)) return "—";
  if (bytes <= 0) return "0 Б";
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "—";
  const label = dateTimeFormatter.format(new Date(time)).replace(", ", " ");
  return `${label} ${PROJECT_TIMEZONE_LABEL}`;
}

export default function StoragePage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = React.useState<StoredFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [usersById, setUsersById] = React.useState<Record<number, User>>({});
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortOption>("uploaded_desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [selectedId, setSelectedId] = React.useState<string | null>(
    searchParams.get("file"),
  );
  const [selectedFile, setSelectedFile] = React.useState<StoredFile | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [diagnostics, setDiagnostics] = React.useState<
    StorageDiagnosticsReport | null
  >(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = React.useState(false);
  const [diagnosticsError, setDiagnosticsError] = React.useState<string | null>(
    null,
  );

  const loadFiles = React.useCallback(() => {
    setLoading(true);
    return fetchFiles()
      .then((list) => {
        setFiles(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        showToast(t("storage.loadError"), "error");
      })
      .finally(() => setLoading(false));
  }, [t]);

  const detachedCount = React.useMemo(
    () => files.filter((file) => !file.taskId).length,
    [files],
  );

  const handleDiagnostics = React.useCallback(() => {
    setDiagnosticsLoading(true);
    setDiagnosticsError(null);
    return runDiagnostics()
      .then((report) => {
        setDiagnostics(report);
        showToast(t("storage.diagnostics.success"), "success");
        return loadFiles();
      })
      .catch(() => {
        setDiagnosticsError(t("storage.diagnostics.error"));
        showToast(t("storage.diagnostics.error"), "error");
      })
      .finally(() => {
        setDiagnosticsLoading(false);
      });
  }, [loadFiles, t]);

  React.useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  React.useEffect(() => {
    let active = true;
    fetchUsers()
      .then((list) => {
        if (!active) return;
        const map: Record<number, User> = {};
        list.forEach((user) => {
          if (typeof user.telegram_id === "number") {
            map[user.telegram_id] = user;
          }
        });
        setUsersById(map);
      })
      .catch(() => {
        showToast(t("storage.usersLoadError"), "error");
      });
    return () => {
      active = false;
    };
  }, [t]);

  React.useEffect(() => {
    const queryId = searchParams.get("file");
    setSelectedId(queryId);
  }, [searchParams]);

  React.useEffect(() => {
    if (!selectedId) {
      setSelectedFile(null);
      setDetailsLoading(false);
      setPreview(null);
      return;
    }
    const existing = files.find((file) => file.id === selectedId);
    if (existing) {
      setSelectedFile(existing);
      return;
    }
    setDetailsLoading(true);
    fetchFile(selectedId)
      .then((file) => {
        setSelectedFile(file);
      })
      .catch(() => {
        showToast(t("storage.loadError"), "error");
        setSelectedFile(null);
      })
      .finally(() => setDetailsLoading(false));
  }, [selectedId, files, t]);

  React.useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }
    const mime = selectedFile.type || "application/octet-stream";
    const inlineUrl = selectedFile.previewUrl || `${selectedFile.url}?mode=inline`;
    if (mime.startsWith("image/")) {
      setPreview({ mode: "image", inlineUrl, mime });
      return;
    }
    if (mime.startsWith("video/")) {
      setPreview({ mode: "video", inlineUrl, mime });
      return;
    }
    if (mime === "application/pdf") {
      setPreview({ mode: "pdf", inlineUrl, mime });
      return;
    }
    if (isTextLike(mime)) {
      let cancelled = false;
      setPreview({ mode: "text", inlineUrl, mime, loading: true });
      authFetch(inlineUrl)
        .then((res) => {
          if (!res.ok) throw new Error("preview");
          return res.text();
        })
        .then((content) => {
          if (cancelled) return;
          setPreview({ mode: "text", inlineUrl, mime, content });
        })
        .catch(() => {
          if (cancelled) return;
          setPreview({ mode: "text", inlineUrl, mime, error: t("storage.previewError") });
        });
      return () => {
        cancelled = true;
      };
    }
    setPreview(null);
    // неподдерживаемые типы доступны только для скачивания
  }, [selectedFile, t]);

  const filteredFiles = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) =>
      query ? file.name.toLowerCase().includes(query) : true,
    );
  }, [files, search]);

  const sortedFiles = React.useMemo(() => {
    const list = [...filteredFiles];
    list.sort((a, b) => {
      switch (sort) {
        case "uploaded_asc": {
          const left = Date.parse(a.uploadedAt || "");
          const right = Date.parse(b.uploadedAt || "");
          return (left || 0) - (right || 0);
        }
        case "uploaded_desc": {
          const left = Date.parse(a.uploadedAt || "");
          const right = Date.parse(b.uploadedAt || "");
          return (right || 0) - (left || 0);
        }
        case "size_asc":
          return (a.size || 0) - (b.size || 0);
        case "size_desc":
          return (b.size || 0) - (a.size || 0);
        default:
          return 0;
      }
    });
    return list;
  }, [filteredFiles, sort]);

  const pagedFiles = React.useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return sortedFiles.slice(start, start + PAGE_SIZE);
  }, [sortedFiles, pageIndex]);

  const handleDownload = React.useCallback(
    (file: StoredFile) => {
      if (!file.url) return;
      window.open(file.url, "_blank", "noopener,noreferrer");
      showToast(t("storage.openedInNewTab"), "success");
    },
    [t],
  );

  const handleDelete = React.useCallback(
    (file: StoredFile) => {
      const confirmed = window.confirm(
        t("storage.deleteConfirm", { name: file.name }),
      );
      if (!confirmed) return;
      removeFile(file.id)
        .then((res) => {
          if (!res.ok) throw new Error("delete");
          showToast(t("storage.deleteSuccess"), "success");
          setFiles((current) => current.filter((candidate) => candidate.id !== file.id));
          if (selectedId === file.id) {
            const next = new URLSearchParams(searchParams.toString());
            next.delete("file");
            setSearchParams(next, { replace: true });
          }
        })
        .catch(() => {
          showToast(t("storage.deleteError"), "error");
        });
    },
    [searchParams, selectedId, setSearchParams, t],
  );

  const toRow = React.useCallback(
    (file: StoredFile): StorageRow => {
      const hasTaskId = file.taskId != null && file.taskId !== "";
      const normalizedTaskId = hasTaskId ? String(file.taskId) : undefined;
      const normalizedTitle =
        typeof file.taskTitle === "string" && file.taskTitle.trim()
          ? file.taskTitle.trim()
          : undefined;
      const identifier = hasTaskId
        ? file.taskNumber && file.taskNumber !== ""
          ? t("storage.taskNumberLabel", { number: file.taskNumber })
          : t("storage.taskLabel", { id: normalizedTaskId })
        : t("storage.taskMissing");
      const user =
        typeof file.userId === "number" ? usersById[file.userId] : undefined;
      const displayName =
        (typeof user?.name === "string" && user.name.trim()) ||
        (typeof user?.telegram_username === "string" &&
          user.telegram_username.trim()) ||
        (typeof user?.username === "string" && user.username.trim()) ||
        t("storage.userLabel", { id: file.userId });
      const userHint =
        typeof file.userId === "number"
          ? t("storage.details.userId", { id: file.userId })
          : t("storage.details.userId", { id: "—" });
      let taskLink: string | undefined;
      if (normalizedTaskId) {
        const paramsWithTask = new URLSearchParams(searchParams.toString());
        paramsWithTask.set("task", normalizedTaskId);
        taskLink = `?${paramsWithTask.toString()}`;
      }
      return {
        ...file,
        taskTitle: normalizedTitle,
        sizeLabel: formatSize(file.size),
        uploadedLabel: formatDate(file.uploadedAt),
        userDisplay: displayName,
        userHint,
        taskDisplay: identifier,
        taskParam: normalizedTaskId,
        taskLink,
        onDownload: () => handleDownload(file),
        onDelete: () => handleDelete(file),
      };
    },
    [handleDelete, handleDownload, searchParams, t, usersById],
  );

  const rows = React.useMemo<StorageRow[]>(
    () => pagedFiles.map((file) => toRow(file)),
    [pagedFiles, toRow],
  );

  const pageCount = React.useMemo(() => {
    if (!sortedFiles.length) return 1;
    return Math.max(1, Math.ceil(sortedFiles.length / PAGE_SIZE));
  }, [sortedFiles.length]);

  const openTaskDialog = React.useCallback(
    (taskId?: string) => {
      if (!taskId) return;
      const next = new URLSearchParams(searchParams.toString());
      next.set("task", taskId);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const closeModal = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("file");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const selectedRow = React.useMemo(
    () => (selectedFile ? toRow(selectedFile) : null),
    [selectedFile, toRow],
  );

  const details = React.useMemo(() => {
    if (!selectedRow) return [];
    const empty = t("storage.details.empty");
    return [
      {
        key: "task",
        label: t("storage.details.task"),
        value: selectedRow.taskDisplay,
      },
      {
        key: "taskNumber",
        label: t("storage.details.taskNumber"),
        value: selectedRow.taskNumber || empty,
      },
      {
        key: "taskId",
        label: t("storage.details.taskId"),
        value: selectedRow.taskId || empty,
      },
      {
        key: "taskTitle",
        label: t("storage.details.taskTitle"),
        value: selectedRow.taskTitle || empty,
      },
      {
        key: "user",
        label: t("storage.details.user"),
        value: (
          <span className="flex flex-col">
            {selectedRow.userDisplay}
            <span className="text-xs text-muted-foreground">
              {selectedRow.userHint}
            </span>
          </span>
        ),
      },
      {
        key: "uploaded",
        label: t("storage.details.uploaded"),
        value: selectedRow.uploadedLabel || empty,
      },
      {
        key: "size",
        label: t("storage.details.size"),
        value: selectedRow.sizeLabel || empty,
      },
      {
        key: "type",
        label: t("storage.details.type"),
        value: selectedRow.type || empty,
      },
      {
        key: "path",
        label: t("storage.details.path"),
        value: <code className="break-all text-xs">{selectedRow.path}</code>,
      },
    ];
  }, [selectedRow, t]);

  const previewIcon = preview ? previewIcons[preview.mode] : null;
  const diagnosticsTimestamp = React.useMemo(
    () => (diagnostics ? formatDate(diagnostics.generatedAt) : null),
    [diagnostics],
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: t("storage.title") }]} />
      <section className="rounded border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-amber-900">
              {t("storage.diagnostics.title")}
            </h2>
            <p className="text-sm text-amber-800">
              {t("storage.diagnostics.description")}
            </p>
            <p className="text-sm text-amber-900">
              {detachedCount === 0
                ? t("storage.sync.ok", { count: files.length })
                : t("storage.sync.warning", { count: detachedCount })}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="self-start border-amber-400 text-amber-900 hover:bg-amber-100"
            disabled={diagnosticsLoading}
            onClick={() => {
              void handleDiagnostics();
            }}
          >
            {diagnosticsLoading
              ? t("storage.diagnostics.progress")
              : t("storage.diagnostics.cta")}
          </Button>
        </div>
        {diagnosticsError ? (
          <p className="mt-3 text-sm text-red-700">{diagnosticsError}</p>
        ) : null}
        {diagnostics ? (
          <div className="mt-3 space-y-1 text-sm text-amber-900">
            <p>
              {t("storage.diagnostics.lastRun", {
                date: diagnosticsTimestamp ?? "—",
              })}
            </p>
            <p>
              {t("storage.diagnostics.snapshot", {
                total: diagnostics.snapshot.totalFiles,
                linked: diagnostics.snapshot.linkedFiles,
                detached: diagnostics.snapshot.detachedFiles,
              })}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-amber-800">
            {t("storage.diagnostics.placeholder")}
          </p>
        )}
      </section>
      <section className="space-y-5 rounded border border-border bg-card p-5 shadow-sm">
        <header className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold text-foreground">{t("storage.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("storage.total", { count: filteredFiles.length })}
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPageIndex(0);
                }}
                placeholder={t("storage.searchPlaceholder") ?? ""}
                className="max-w-xs"
              />
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as SortOption);
                  setPageIndex(0);
                }}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="uploaded_desc">{t("storage.sort.uploadedDesc")}</option>
                <option value="uploaded_asc">{t("storage.sort.uploadedAsc")}</option>
                <option value="size_desc">{t("storage.sort.sizeDesc")}</option>
                <option value="size_asc">{t("storage.sort.sizeAsc")}</option>
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void loadFiles()}
                disabled={loading}
              >
                {t("storage.refresh")}
              </Button>
            </div>
            <div className="text-xs text-muted-foreground md:text-sm">
              {loading ? t("loading") : null}
            </div>
          </div>
        </header>
        <DataTable<StorageRow>
          columns={createStorageColumns(
            {
              name: t("storage.columns.name"),
              user: t("storage.columns.user"),
              type: t("storage.columns.type"),
              size: t("storage.columns.size"),
              task: t("storage.columns.task"),
              uploaded: t("storage.columns.uploaded"),
              download: t("storage.download"),
              delete: t("storage.delete"),
              taskTitleHint: (title: string) => t("storage.taskTitleHint", { title }),
            },
            { onTaskOpen: openTaskDialog },
          )}
          data={rows}
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          pageCount={pageCount}
          onPageChange={setPageIndex}
          showGlobalSearch={false}
          showFilters={false}
          wrapCellsAsBadges
          onRowClick={(row) => {
            const next = new URLSearchParams(searchParams.toString());
            next.set("file", row.id);
            setSearchParams(next, { replace: false });
          }}
        />
      </section>
      <Modal open={Boolean(selectedId)} onClose={closeModal}>
        {detailsLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : selectedRow ? (
          <div className="space-y-4">
            <header className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedRow.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {selectedRow.type || t("storage.details.type")}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDownload(selectedRow)}
                >
                  <ArrowDownTrayIcon className="mr-2 size-4" />
                  {t("storage.download")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => handleDelete(selectedRow)}
                >
                  <TrashIcon className="mr-2 size-4" />
                  {t("storage.delete")}
                </Button>
              </div>
            </header>
            {preview ? (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  {previewIcon ? <previewIcon className="size-5" /> : null}
                  <span>{t("storage.previewTitle")}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("storage.mimeLabel", { mime: preview.mime })}
                  </span>
                </div>
                {preview.mode === "image" ? (
                  <img
                    src={preview.inlineUrl}
                    alt={selectedRow.name}
                    className="max-h-[300px] w-full rounded-md object-contain"
                  />
                ) : preview.mode === "video" ? (
                  <video
                    controls
                    src={preview.inlineUrl}
                    className="max-h-[320px] w-full rounded-md"
                  />
                ) : preview.mode === "pdf" ? (
                  <iframe
                    title={selectedRow.name}
                    src={preview.inlineUrl}
                    className="h-[320px] w-full rounded-md"
                  />
                ) : preview.mode === "text" ? (
                  preview.loading ? (
                    <div className="text-sm text-muted-foreground">
                      {t("storage.previewLoading")}
                    </div>
                  ) : preview.error ? (
                    <div className="text-sm text-red-500">{preview.error}</div>
                  ) : (
                    <pre className="max-h-[320px] overflow-auto rounded bg-muted p-3 text-xs">
                      {preview.content}
                    </pre>
                  )
                ) : null}
              </div>
            ) : null}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">{t("storage.details.title")}</h3>
              <dl className="grid gap-2 sm:grid-cols-2">
                {details.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-md border border-border p-3 text-sm"
                  >
                    <dt className="text-xs font-semibold uppercase text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm">{item.value}</dd>
                  </div>
                ))}
              </dl>
              {selectedRow.taskId ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openTaskDialog(selectedRow.taskId)}
                >
                  {t("storage.details.openTask")}
                </Button>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            {t("storage.loadError")}
          </div>
        )}
      </Modal>
    </div>
  );
}
