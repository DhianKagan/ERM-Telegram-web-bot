// Страница управления файлами в хранилище через DataTable
// Основные модули: React, DataTable, heroicons, i18next
import React from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDownTrayIcon,
  DocumentIcon,
  DocumentTextIcon,
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
  runDiagnostics as runStorageDiagnostics,
  applyFixes as applyStorageFixes,
  type StoredFile,
  type StorageDiagnosticsReport,
  type StorageFixAction,
} from "../services/storage";
import authFetch from "../utils/authFetch";
import { showToast } from "../utils/toast";
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from "shared";
import {
  fetchOverview as fetchStackOverview,
  executePlan as executeStackPlan,
  fetchLatestLogAnalysis,
  type StackOverview,
  type StackExecutionResult,
  type RailwayLogAnalysisSummary,
} from "../services/system";

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

type PreviewMode = "image" | "video" | "pdf" | "text";

type PreviewState = {
  file: StorageRow;
  inlineUrl: string;
  mime: string;
  mode: PreviewMode;
  loading?: boolean;
  error?: string;
  content?: string;
};

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
  return `${dateTimeFormatter.format(new Date(time)).replace(", ", " ")} ${PROJECT_TIMEZONE_LABEL}`;
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
  const [diagnostics, setDiagnostics] = React.useState<StorageDiagnosticsReport | null>(null);
  const [diagLoading, setDiagLoading] = React.useState(false);
  const [fixLoading, setFixLoading] = React.useState(false);
  const [autoLoading, setAutoLoading] = React.useState(false);
  const [overview, setOverview] = React.useState<StackOverview | null>(null);
  const [logAnalysis, setLogAnalysis] = React.useState<RailwayLogAnalysisSummary | null>(null);
  const [logAnalysisLoading, setLogAnalysisLoading] = React.useState(false);
  const [overviewLoading, setOverviewLoading] = React.useState(false);
  const [lastExecution, setLastExecution] = React.useState<StackExecutionResult | null>(null);
  const [preview, setPreview] = React.useState<PreviewState | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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

  const refreshOverview = React.useCallback(() => {
    setOverviewLoading(true);
    return fetchStackOverview()
      .then((snapshot) => {
        setOverview(snapshot);
        setDiagnostics(snapshot.storage);
        setLogAnalysis(snapshot.logAnalysis ?? null);
      })
      .catch(() => {
        showToast(t("storage.diagnostics.overviewError"), "error");
      })
      .finally(() => setOverviewLoading(false));
  }, [t]);

  React.useEffect(() => {
    refreshOverview();
  }, [refreshOverview]);

  const refreshLogAnalysis = React.useCallback(() => {
    setLogAnalysisLoading(true);
    return fetchLatestLogAnalysis()
      .then((summary) => {
        setLogAnalysis(summary ?? null);
      })
      .catch(() => {
        showToast(t("storage.diagnostics.logAnalysisError"), "error");
      })
      .finally(() => setLogAnalysisLoading(false));
  }, [t]);

  React.useEffect(() => {
    refreshLogAnalysis();
  }, [refreshLogAnalysis]);

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

  const sanitizeId = React.useCallback(
    (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9а-яё]+/gi, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, ""),
    [],
  );

  const applyFilters = React.useCallback(() => {
    setPageIndex(0);
    setFilters({ ...draftFilters });
  }, [draftFilters]);

  const resetFilters = React.useCallback(() => {
    setDraftFilters({});
    setPageIndex(0);
    setFilters({});
  }, []);

  const handleDiagnosticsRun = React.useCallback(() => {
    setDiagLoading(true);
    runStorageDiagnostics()
      .then((report) => {
        setDiagnostics(report);
        setOverview((snapshot) =>
          snapshot
            ? { ...snapshot, storage: report, plannedActions: report.recommendedFixes }
            : snapshot,
        );
        showToast(t("storage.diagnostics.success"), "success");
      })
      .catch(() => {
        showToast(t("storage.diagnostics.error"), "error");
      })
      .finally(() => setDiagLoading(false));
  }, [t]);

  const handleApplyFixes = React.useCallback(() => {
    if (!diagnostics?.recommendedFixes?.length) {
      showToast(t("storage.diagnostics.noActions"), "warning");
      return;
    }
    setFixLoading(true);
    applyStorageFixes(diagnostics.recommendedFixes)
      .then(async (payload) => {
        setDiagnostics(payload.report);
        setOverview((snapshot) =>
          snapshot
            ? {
                ...snapshot,
                storage: payload.report,
                plannedActions: payload.report.recommendedFixes,
              }
            : snapshot,
        );
        showToast(t("storage.diagnostics.fixSuccess"), "success");
        await loadFiles();
      })
      .catch(() => {
        showToast(t("storage.diagnostics.fixError"), "error");
      })
      .finally(() => setFixLoading(false));
  }, [diagnostics, loadFiles, t]);

  const handleCoordinate = React.useCallback(() => {
    setAutoLoading(true);
    executeStackPlan()
      .then(async (result) => {
        setLastExecution(result);
        setDiagnostics(result.report);
        setLogAnalysis(result.logAnalysis ?? null);
        setOverview({
          generatedAt: result.generatedAt,
          storage: result.report,
          plannedActions: result.plan,
          logAnalysis: result.logAnalysis ?? null,
        });
        showToast(t("storage.diagnostics.autoSuccess"), "success");
        await loadFiles();
      })
      .catch(() => {
        showToast(t("storage.diagnostics.autoError"), "error");
      })
      .finally(() => setAutoLoading(false));
  }, [loadFiles, t]);

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
    (file: StorageRow) => {
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
      sortedFiles.map((file) => {
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
          userLabel: t("storage.userLabel", { id: file.userId }),
          taskDisplay: identifier,
          taskParam: normalizedTaskId,
          taskLink,
          onDownload: () => handleDownload(file),
          onDelete: () => handleDelete(file),
        };
      }),
    [sortedFiles, t, handleDelete, handleDownload, searchParams],
  );

  const openTaskDialog = React.useCallback(
    (taskId?: string) => {
      if (!taskId) return;
      const next = new URLSearchParams(searchParams.toString());
      next.set("task", taskId);
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  const columns = React.useMemo(
    () =>
      createStorageColumns(
        {
          name: t("storage.columns.name"),
          user: t("storage.columns.user"),
          type: t("storage.columns.type"),
          size: t("storage.columns.size"),
          task: t("storage.columns.task"),
          uploaded: t("storage.columns.uploaded"),
          download: t("storage.download"),
          delete: t("storage.delete"),
          taskTitleHint: (title: string) =>
            t("storage.taskTitleHint", { title }),
        },
        { onTaskOpen: openTaskDialog },
      ),
    [t, openTaskDialog],
  );

  const pageSize = rows.length > 0 ? rows.length : 10;

  const previewDetails = React.useMemo(() => {
    if (!preview) {
      return [] as Array<{ key: string; label: string; value: React.ReactNode }>;
    }
    const file = preview.file;
    const empty = t("storage.details.empty");
    return [
      {
        key: "task",
        label: t("storage.details.task"),
        value: (
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">{file.taskDisplay}</span>
            {file.taskTitle ? (
              <span className="block text-xs text-muted-foreground">{file.taskTitle}</span>
            ) : null}
          </div>
        ),
      },
      {
        key: "taskNumber",
        label: t("storage.details.taskNumber"),
        value: file.taskNumber && file.taskNumber.trim() ? file.taskNumber : empty,
      },
      {
        key: "taskId",
        label: t("storage.details.taskId"),
        value: file.taskParam ? (
          <code className="break-all text-xs text-foreground">{file.taskParam}</code>
        ) : (
          empty
        ),
      },
      {
        key: "taskTitle",
        label: t("storage.details.taskTitle"),
        value: file.taskTitle && file.taskTitle.trim() ? file.taskTitle : empty,
      },
      {
        key: "user",
        label: t("storage.details.user"),
        value: (
          <div className="space-y-0.5">
            <span className="font-medium text-foreground">{file.userLabel}</span>
            <span className="block text-xs text-muted-foreground">
              {t("storage.details.userId", { id: file.userId })}
            </span>
          </div>
        ),
      },
      {
        key: "uploaded",
        label: t("storage.details.uploaded"),
        value: file.uploadedLabel && file.uploadedLabel.trim()
          ? file.uploadedLabel
          : empty,
      },
      {
        key: "size",
        label: t("storage.details.size"),
        value: file.sizeLabel && file.sizeLabel.trim() ? file.sizeLabel : empty,
      },
      {
        key: "type",
        label: t("storage.details.type"),
        value: file.type && file.type.trim() ? file.type : empty,
      },
      {
        key: "path",
        label: t("storage.details.path"),
        value: (
          <code className="break-all text-xs text-foreground">{file.path}</code>
        ),
      },
    ];
  }, [preview, t]);

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: t("storage.title") }]} />
      <section className="space-y-4 rounded border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">
              {t("storage.diagnostics.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {diagnostics
                ? t("storage.diagnostics.issues", {
                    count: diagnostics.summary.total,
                  })
                : overviewLoading
                ? t("storage.diagnostics.loading")
                : t("storage.diagnostics.noReport")}
            </p>
            {diagnostics ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("storage.diagnostics.reportTimestamp", {
                  value: formatDate(diagnostics.scannedAt),
                })}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("storage.diagnostics.planHint", {
                count:
                  overview?.plannedActions?.length ??
                  diagnostics?.recommendedFixes?.length ??
                  0,
              })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleDiagnosticsRun}
              disabled={diagLoading}
            >
              {diagLoading
                ? t("storage.diagnostics.running")
                : t("storage.diagnostics.run")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleApplyFixes}
              disabled={fixLoading || !diagnostics?.recommendedFixes?.length}
            >
              {fixLoading
                ? t("storage.diagnostics.fixing")
                : t("storage.diagnostics.fix")}
            </Button>
            <Button
              type="button"
              onClick={handleCoordinate}
              disabled={autoLoading}
            >
              {autoLoading
                ? t("storage.diagnostics.autoFixing")
                : t("storage.diagnostics.autoFix")}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold">
              {t("storage.diagnostics.summaryTitle")}
            </h3>
            {diagnostics ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>
                  {t("storage.diagnostics.summary.missing", {
                    count: diagnostics.summary.missing_on_disk,
                  })}
                </li>
                <li>
                  {t("storage.diagnostics.summary.orphan", {
                    count: diagnostics.summary.orphan_on_disk,
                  })}
                </li>
                <li>
                  {t("storage.diagnostics.summary.duplicate", {
                    count: diagnostics.summary.duplicate_entry,
                  })}
                </li>
                <li>
                  {t("storage.diagnostics.summary.stale", {
                    count: diagnostics.summary.stale_task_link,
                  })}
                </li>
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("storage.diagnostics.noReport")}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {t("storage.diagnostics.recommendationsTitle")}
            </h3>
            {diagnostics ? (
              <>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {diagnostics.recommendations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                {typeof diagnostics.stats.diskFreeBytes === "number" &&
                typeof diagnostics.stats.diskTotalBytes === "number" ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("storage.diagnostics.diskHint", {
                      free: formatSize(diagnostics.stats.diskFreeBytes ?? 0),
                      total: formatSize(diagnostics.stats.diskTotalBytes ?? 0),
                    })}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                {t("storage.diagnostics.noRecommendations")}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">
                {t("storage.diagnostics.logAnalysis.title")}
              </p>
              <p className="text-xs text-muted-foreground">
                {logAnalysis
                  ? t("storage.diagnostics.logAnalysis.generated", {
                      value: formatDate(logAnalysis.generatedAt),
                    })
                  : logAnalysisLoading
                  ? t("storage.diagnostics.logAnalysis.loading")
                  : t("storage.diagnostics.logAnalysis.empty")}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={refreshLogAnalysis}
              disabled={logAnalysisLoading}
            >
              {logAnalysisLoading
                ? t("storage.diagnostics.logAnalysis.refreshing")
                : t("storage.diagnostics.logAnalysis.refresh")}
            </Button>
          </div>
          {logAnalysis ? (
            <div className="mt-3 space-y-2">
              <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                <span>
                  {t("storage.diagnostics.logAnalysis.errors", {
                    count: logAnalysis.stats.errors,
                  })}
                </span>
                <span>
                  {t("storage.diagnostics.logAnalysis.warnings", {
                    count: logAnalysis.stats.warnings,
                  })}
                </span>
                <span>
                  {t("storage.diagnostics.logAnalysis.commands", {
                    count: logAnalysis.recommendations.length,
                  })}
                </span>
              </div>
              {logAnalysis.recommendations.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {logAnalysis.recommendations.slice(0, 3).map((item) => (
                    <li key={item.id}>
                      <span className="font-medium text-foreground">{item.title}</span>
                      {item.command ? ` — ${item.command}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t("storage.diagnostics.logAnalysis.noRecommendations")}
                </p>
              )}
            </div>
          ) : null}
        </div>
        {lastExecution ? (
          <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/30 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {t("storage.diagnostics.lastExecutionTitle", {
                value: formatDate(lastExecution.generatedAt),
              })}
            </p>
            <p className="mt-1">
              {t("storage.diagnostics.lastExecutionSummary", {
                performed: lastExecution.execution.performed.length,
                errors: lastExecution.execution.errors.length,
              })}
            </p>
          </div>
        ) : null}
      </section>
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
                const fieldId = `storage-user-${sanitizeId(String(id))}`;
                return (
                  <label
                    key={id}
                    className="flex items-center gap-2 text-sm"
                    htmlFor={fieldId}
                  >
                    <input
                      id={fieldId}
                      name="storageUser"
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
                const fieldId = `storage-type-${sanitizeId(type)}`;
                return (
                  <label
                    key={type}
                    className="flex items-center gap-2 text-sm"
                    htmlFor={fieldId}
                  >
                    <input
                      id={fieldId}
                      name="storageType"
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
            <section className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("storage.details.title")}
                </h3>
                {preview.file.taskParam ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      openTaskDialog(preview.file.taskParam);
                      setPreview(null);
                    }}
                  >
                    {t("storage.details.openTask")}
                  </Button>
                ) : null}
              </div>
              <dl className="mt-1 grid gap-3 text-sm sm:grid-cols-2">
                {previewDetails.map((item) => (
                  <div
                    key={item.key}
                    className="space-y-1 rounded-md border border-border/40 bg-background/70 p-3"
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="break-words text-sm text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
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
