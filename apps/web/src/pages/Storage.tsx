// Страница управления файлами в хранилище через DataTable
// Основные модули: React, DataTable, heroicons, i18next
import React from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowDownTrayIcon,
  DocumentIcon,
  DocumentTextIcon,
  InformationCircleIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
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
  fetchFiles,
  removeFile,
  type StoredFile,
} from "../services/storage";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type PreviewMode = "image" | "video" | "pdf" | "text";

type SortOption =
  | "uploaded_desc"
  | "uploaded_asc"
  | "size_desc"
  | "size_asc";

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
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "—";
  return dateTimeFormatter.format(new Date(time)).replace(", ", " ");
}

export default function StoragePage() {
  const { t } = useTranslation();
  const [files, setFiles] = React.useState<StoredFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState<{ userId?: number; type?: string }>({});
  const [draftFilters, setDraftFilters] = React.useState<{ userId?: number; type?: string }>({});
  const [search, setSearch] = React.useState("");
  const [sort, setSort] = React.useState<SortOption>("uploaded_desc");
  const [pageIndex, setPageIndex] = React.useState(0);
  const [preview, setPreview] = React.useState<{
    file: StoredFile;
    inlineUrl: string;
    mime: string;
    mode: PreviewMode;
    loading?: boolean;
    error?: string;
    content?: string;
  } | null>(null);

  const loadFiles = React.useCallback(() => {
    setLoading(true);
    return fetchFiles(filters)
      .then((list) => {
        setFiles(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        showToast(t("storage.loadError"), "error");
      })
      .finally(() => setLoading(false));
  }, [filters, t]);

  React.useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  React.useEffect(() => {
    setDraftFilters(filters);
  }, [filters]);

  const userOptions = React.useMemo(() => {
    const ids = new Set<number>();
    files.forEach((file) => {
      if (typeof file.userId === "number") {
        ids.add(file.userId);
      }
    });
    return Array.from(ids).sort((a, b) => a - b);
  }, [files]);

  const typeOptions = React.useMemo(() => {
    const types = new Set<string>();
    files.forEach((file) => {
      if (file.type) types.add(file.type);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [files]);

  const applyFilters = React.useCallback(() => {
    setPageIndex(0);
    setFilters({ ...draftFilters });
  }, [draftFilters]);

  const resetFilters = React.useCallback(() => {
    setDraftFilters({});
    setPageIndex(0);
    setFilters({});
  }, []);

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
      removeFile(file.path)
        .then((res) => {
          if (!res.ok) throw new Error("delete");
          showToast(t("storage.deleteSuccess"), "success");
          return loadFiles();
        })
        .catch(() => {
          showToast(t("storage.deleteError"), "error");
        });
    },
    [loadFiles, t],
  );

  const openPreview = React.useCallback(
    (file: StoredFile) => {
      const mime = file.type || "application/octet-stream";
      const inlineUrl = file.previewUrl || `${file.url}?mode=inline`;
      if (mime.startsWith("image/")) {
        setPreview({ file, inlineUrl, mime, mode: "image" });
        return;
      }
      if (mime.startsWith("video/")) {
        setPreview({ file, inlineUrl, mime, mode: "video" });
        return;
      }
      if (mime === "application/pdf") {
        setPreview({ file, inlineUrl, mime, mode: "pdf" });
        return;
      }
      if (isTextLike(mime)) {
        setPreview({ file, inlineUrl, mime, mode: "text", loading: true });
        authFetch(inlineUrl)
          .then((res) => {
            if (!res.ok) throw new Error("preview");
            return res.text();
          })
          .then((content) => {
            setPreview((current) =>
              current && current.file.path === file.path
                ? { ...current, content, loading: false, error: undefined }
                : current,
            );
          })
          .catch(() => {
            setPreview((current) =>
              current && current.file.path === file.path
                ? {
                    ...current,
                    loading: false,
                    error: t("storage.previewError"),
                  }
                : current,
            );
          });
        return;
      }
      window.open(file.url, "_blank", "noopener,noreferrer");
      showToast(t("storage.openedInNewTab"), "success");
    },
    [t],
  );

  const filteredFiles = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return files.filter((file) =>
      query ? file.name.toLowerCase().includes(query) : true,
    );
  }, [files, search]);

  const sortedFiles = React.useMemo(() => {
    const items = [...filteredFiles];
    items.sort((a, b) => {
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
        case "size_asc": {
          const left = a.size || 0;
          const right = b.size || 0;
          return left - right;
        }
        case "size_desc": {
          const left = a.size || 0;
          const right = b.size || 0;
          return right - left;
        }
        default:
          return 0;
      }
    });
    return items;
  }, [filteredFiles, sort]);

  const rows = React.useMemo<StorageRow[]>(
    () =>
      sortedFiles.map((file) => ({
        ...file,
        sizeLabel: formatSize(file.size),
        uploadedLabel: formatDate(file.uploadedAt),
        userLabel: t("storage.userLabel", { id: file.userId }),
        taskLabel: file.taskId != null && file.taskId !== ""
          ? t("storage.taskLabel", { id: file.taskId })
          : t("storage.taskMissing"),
        taskLink: file.taskId != null && file.taskId !== ""
          ? `/cp/tasks?task=${encodeURIComponent(String(file.taskId))}`
          : undefined,
        onDownload: () => handleDownload(file),
        onDelete: () => handleDelete(file),
      })),
    [sortedFiles, t, handleDelete, handleDownload],
  );

  const columns = React.useMemo(
    () =>
      createStorageColumns({
        name: t("storage.columns.name"),
        user: t("storage.columns.user"),
        type: t("storage.columns.type"),
        size: t("storage.columns.size"),
        task: t("storage.columns.task"),
        uploaded: t("storage.columns.uploaded"),
        download: t("storage.download"),
        delete: t("storage.delete"),
      }),
    [t],
  );

  const pageSize = rows.length > 0 ? rows.length : 10;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: t("storage.title") }]} />
      <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50/60 p-4 text-sm text-blue-900 shadow-xs dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
        <div className="flex items-center gap-2 font-medium">
          <InformationCircleIcon className="size-5" aria-hidden />
          <span>{t("storage.previewTitle")}</span>
        </div>
        <p className="text-sm leading-relaxed text-blue-900/90 dark:text-blue-50/80">
          {t("storage.previewHint")}
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "image", label: t("storage.typeImage"), icon: PhotoIcon },
            { key: "video", label: t("storage.typeVideo"), icon: VideoCameraIcon },
            { key: "pdf", label: t("storage.typePdf"), icon: DocumentIcon },
            { key: "text", label: t("storage.typeText"), icon: DocumentTextIcon },
          ] as Array<{
            key: PreviewMode;
            label: string;
            icon: React.ComponentType<{ className?: string }>;
          }>).map(({ key, label, icon: Icon }) => (
            <span
              key={key}
              className="flex items-center gap-1.5 rounded-md bg-white/60 px-2.5 py-1 text-xs font-medium text-blue-900 ring-1 ring-blue-200 dark:bg-slate-900/60 dark:text-blue-100 dark:ring-blue-500/40"
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </span>
          ))}
        </div>
        <p className="text-xs text-blue-800/80 dark:text-blue-200/60">
          {t("storage.previewLimitation")}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("storage.searchPlaceholder") ?? ""}
          className="w-64"
        />
        <select
          className="rounded border px-3 py-2 text-sm"
          value={sort}
          onChange={(event) => setSort(event.target.value as SortOption)}
        >
          <option value="uploaded_desc">{t("storage.sort.uploadedDesc")}</option>
          <option value="uploaded_asc">{t("storage.sort.uploadedAsc")}</option>
          <option value="size_desc">{t("storage.sort.sizeDesc")}</option>
          <option value="size_asc">{t("storage.sort.sizeAsc")}</option>
        </select>
      </div>
      <section className="space-y-3 rounded border p-4">
        <h2 className="text-sm font-semibold">{t("storage.filters.title")}</h2>
        <div className="flex flex-wrap gap-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t("storage.filters.user")}
            </legend>
            <div className="flex flex-col gap-2">
              {userOptions.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("storage.filters.empty")}
                </span>
              )}
              {userOptions.map((id) => {
                const checked = draftFilters.userId === id;
                return (
                  <label key={id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          userId: checked ? undefined : id,
                        }))
                      }
                    />
                    {t("storage.userLabel", { id })}
                  </label>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t("storage.filters.type")}
            </legend>
            <div className="flex flex-col gap-2">
              {typeOptions.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  {t("storage.filters.empty")}
                </span>
              )}
              {typeOptions.map((type) => {
                const checked = draftFilters.type === type;
                return (
                  <label key={type} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setDraftFilters((current) => ({
                          ...current,
                          type: checked ? undefined : type,
                        }))
                      }
                    />
                    <span title={type}>{type}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters}>
            {t("find")}
          </Button>
          <Button type="button" variant="outline" onClick={resetFilters}>
            {t("reset")}
          </Button>
        </div>
      </section>
      {loading && <div>{t("loading")}</div>}
      <DataTable
        columns={columns}
        data={rows}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={1}
        onPageChange={setPageIndex}
        onRowClick={(row) => openPreview(row)}
      />
      <Modal open={!!preview} onClose={() => setPreview(null)}>
        {preview && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                {React.createElement(previewIcons[preview.mode], {
                  className: "size-5 text-muted-foreground",
                  "aria-hidden": true,
                })}
                <div>
                  <p className="text-lg font-semibold">{preview.file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("storage.mimeLabel", { mime: preview.mime })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(preview.file.url, "_blank", "noopener,noreferrer")
                  }
                  title={t("storage.downloadHint") ?? undefined}
                >
                  <ArrowDownTrayIcon className="size-4" aria-hidden />
                  {t("storage.download")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPreview(null)}
                  aria-label={t("close") ?? undefined}
                >
                  <XMarkIcon className="size-5" aria-hidden />
                </Button>
              </div>
            </div>
            {preview.mode === "image" && (
              <img
                srcSet={`${preview.file.thumbnailUrl || preview.inlineUrl} 1x, ${preview.inlineUrl} 2x`}
                sizes="(max-width: 800px) 100vw, 800px"
                src={preview.file.thumbnailUrl || preview.inlineUrl}
                alt=""
                className="max-h-[70vh] w-full rounded-lg object-contain"
              />
            )}
            {preview.mode === "video" && (
              <video
                src={preview.inlineUrl}
                controls
                className="max-h-[70vh] w-full rounded-lg bg-black"
              />
            )}
            {preview.mode === "pdf" && (
              <iframe
                src={preview.inlineUrl}
                title={t("storage.previewTitle") ?? "PDF"}
                className="max-h-[70vh] w-full rounded-lg border"
              />
            )}
            {preview.mode === "text" && (
              <div className="max-h-[70vh] overflow-auto rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed">
                {preview.loading && (
                  <p className="text-muted-foreground">
                    {t("storage.previewLoading")}
                  </p>
                )}
                {preview.error && !preview.loading && (
                  <p className="text-destructive">{preview.error}</p>
                )}
                {!preview.loading && !preview.error && (
                  <pre className="whitespace-pre-wrap break-words text-left text-muted-foreground">
                    {preview.content}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
