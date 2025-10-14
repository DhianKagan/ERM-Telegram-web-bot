// Компонент диагностики файлового хранилища и управления исправлениями
// Основные модули: React, i18next, storage service, ui/button, toast
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { showToast } from "../utils/toast";
import type {
  StorageDiagnosticsReport,
  StorageFixAction,
  StorageFixExecution,
} from "../services/storage";
import { applyFixes, runDiagnostics } from "../services/storage";
import { PROJECT_TIMEZONE, PROJECT_TIMEZONE_LABEL } from "shared";

interface Props {
  className?: string;
}

type FixExecutionSnapshot = StorageFixExecution & { timestamp: string };

type IssueSummaryKey = keyof StorageDiagnosticsReport["summary"];

type FormattedSummaryItem = {
  key: IssueSummaryKey;
  value: number;
  label: string;
};

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const numberFormatter = new Intl.NumberFormat("ru-RU");

function formatBytes(bytes?: number): string {
  if (typeof bytes !== "number" || Number.isNaN(bytes)) {
    return "—";
  }
  if (bytes <= 0) {
    return "0 Б";
  }
  const units = ["Б", "КБ", "МБ", "ГБ", "ТБ", "ПБ"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const rounded = value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[index]}`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "—";
  return `${dateTimeFormatter.format(parsed)} ${PROJECT_TIMEZONE_LABEL}`;
}

function describeAction(
  action: StorageFixAction,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (action.type) {
    case "remove_file_entry":
      return t("storage.diagnostics.actions.removeEntry", { id: action.fileId });
    case "delete_disk_file":
      return t("storage.diagnostics.actions.deleteFile", { path: action.path });
    case "unlink_task_reference":
      return t("storage.diagnostics.actions.unlinkTask", {
        id: action.taskId,
        url: action.attachmentUrl,
      });
    default:
      return t("storage.diagnostics.actions.unknown");
  }
}

function actionKey(action: StorageFixAction): string {
  switch (action.type) {
    case "remove_file_entry":
      return `remove:${action.fileId}`;
    case "delete_disk_file":
      return `delete:${action.path}`;
    case "unlink_task_reference":
      return `unlink:${action.taskId}:${action.attachmentUrl}`;
    default:
      return JSON.stringify(action);
  }
}

export default function StorageDiagnosticsCard({ className }: Props) {
  const { t } = useTranslation();
  const [report, setReport] = React.useState<StorageDiagnosticsReport | null>(null);
  const [running, setRunning] = React.useState(false);
  const [fixing, setFixing] = React.useState(false);
  const [autoFixing, setAutoFixing] = React.useState(false);
  const [selectedActions, setSelectedActions] = React.useState<string[]>([]);
  const [lastExecution, setLastExecution] = React.useState<FixExecutionSnapshot | null>(null);

  const loading = running || fixing || autoFixing;

  const resetSelection = React.useCallback((nextReport: StorageDiagnosticsReport | null) => {
    if (!nextReport) {
      setSelectedActions([]);
      return;
    }
    const keys = nextReport.recommendedFixes.map((item) => actionKey(item));
    setSelectedActions(keys);
  }, []);

  const handleRun = React.useCallback(async () => {
    setRunning(true);
    try {
      const nextReport = await runDiagnostics();
      setReport(nextReport);
      resetSelection(nextReport);
      showToast(t("storage.diagnostics.success"), "success");
    } catch (error) {
      console.error("Не удалось выполнить диагностику", error);
      showToast(t("storage.diagnostics.error"), "error");
    } finally {
      setRunning(false);
    }
  }, [resetSelection, t]);

  const applyActions = React.useCallback(
    async (actions: StorageFixAction[], mode: "manual" | "auto") => {
      if (!actions.length) {
        showToast(t("storage.diagnostics.noActions"), "info");
        return;
      }
      if (mode === "manual") {
        setFixing(true);
      } else {
        setAutoFixing(true);
      }
      try {
        const response = await applyFixes(actions);
        const nextReport = response.report;
        setReport(nextReport);
        resetSelection(nextReport);
        const snapshot: FixExecutionSnapshot = {
          ...response.result,
          timestamp: new Date().toISOString(),
        };
        setLastExecution(snapshot);
        if (response.result.errors.length) {
          showToast(t("storage.diagnostics.fixError"), "error");
        } else if (mode === "manual") {
          showToast(t("storage.diagnostics.fixSuccess"), "success");
        } else {
          showToast(t("storage.diagnostics.autoSuccess"), "success");
        }
      } catch (error) {
        console.error("Не удалось применить исправления", error);
        if (mode === "manual") {
          showToast(t("storage.diagnostics.fixError"), "error");
        } else {
          showToast(t("storage.diagnostics.autoError"), "error");
        }
      } finally {
        if (mode === "manual") {
          setFixing(false);
        } else {
          setAutoFixing(false);
        }
      }
    },
    [resetSelection, t],
  );

  const handleFix = React.useCallback(() => {
    if (!report) return;
    const actions = report.recommendedFixes.filter((action) =>
      selectedActions.includes(actionKey(action)),
    );
    void applyActions(actions, "manual");
  }, [applyActions, report, selectedActions]);

  const handleAutoFix = React.useCallback(() => {
    if (!report) return;
    void applyActions(report.recommendedFixes, "auto");
  }, [applyActions, report]);

  const toggleAction = React.useCallback((key: string) => {
    setSelectedActions((prev) =>
      prev.includes(key) ? prev.filter((candidate) => candidate !== key) : [...prev, key],
    );
  }, []);

  const toggleAll = React.useCallback(() => {
    if (!report) return;
    if (selectedActions.length === report.recommendedFixes.length) {
      setSelectedActions([]);
      return;
    }
    setSelectedActions(report.recommendedFixes.map((action) => actionKey(action)));
  }, [report, selectedActions.length]);

  const summaryItems = React.useMemo<FormattedSummaryItem[]>(() => {
    if (!report) return [];
    const entries: Array<[IssueSummaryKey, string]> = [
      ["total", "storage.diagnostics.summaryTitle"],
      ["missing_on_disk", "storage.diagnostics.summary.missing"],
      ["orphan_on_disk", "storage.diagnostics.summary.orphan"],
      ["duplicate_entry", "storage.diagnostics.summary.duplicate"],
      ["stale_task_link", "storage.diagnostics.summary.stale"],
    ];
    return entries.map(([key, labelKey]) => ({
      key,
      value: report.summary[key],
      label: t(labelKey, { count: report.summary[key] }),
    }));
  }, [report, t]);

  const planHint = React.useMemo(() => {
    if (!report) return null;
    return t("storage.diagnostics.planHint", {
      count: report.recommendedFixes.length,
    });
  }, [report, t]);

  return (
    <section
      className={`space-y-4 rounded border border-border bg-card p-5 shadow-sm ${
        className ? className : ""
      }`}
    >
      <header className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("storage.diagnostics.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {report
              ? t("storage.diagnostics.issues", { count: report.summary.total })
              : t("storage.diagnostics.noReport")}
          </p>
          {report ? (
            <p className="text-xs text-muted-foreground">
              {t("storage.diagnostics.reportTimestamp", { value: formatDate(report.scannedAt) })}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleRun} disabled={loading}>
            {running ? t("storage.diagnostics.running") : t("storage.diagnostics.run")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleFix}
            disabled={
              loading || !report || !report.recommendedFixes.length || !selectedActions.length
            }
          >
            {fixing ? t("storage.diagnostics.fixing") : t("storage.diagnostics.fix")}
          </Button>
          <Button
            type="button"
            onClick={handleAutoFix}
            disabled={loading || !report || !report.recommendedFixes.length}
          >
            {autoFixing ? t("storage.diagnostics.autoFixing") : t("storage.diagnostics.autoFix")}
          </Button>
        </div>
      </header>
      {report ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {summaryItems.map((item) => (
              <div key={item.key} className="rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  {item.key === "total"
                    ? t("storage.diagnostics.summaryTitle")
                    : t(`storage.diagnostics.issueTypes.${item.key}` as const)}
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {numberFormatter.format(item.value)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
          <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            <p>
              {t("storage.diagnostics.diskHint", {
                free: formatBytes(report.stats.diskFreeBytes),
                total: formatBytes(report.stats.diskTotalBytes),
              })}
            </p>
            <p className="mt-1">
              {t("storage.diagnostics.thresholdHint", {
                threshold: formatBytes(report.stats.thresholdBytes),
              })}
            </p>
          </div>
          {planHint ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("storage.diagnostics.planTitle")}
                </h3>
                <button
                  type="button"
                  className="text-xs font-medium text-accentPrimary underline"
                  onClick={toggleAll}
                  disabled={loading || !report.recommendedFixes.length}
                >
                  {selectedActions.length === report.recommendedFixes.length
                    ? t("storage.diagnostics.deselectAll")
                    : t("storage.diagnostics.selectAll")}
                </button>
              </div>
              <p className="text-sm text-muted-foreground">{planHint}</p>
              {report.recommendedFixes.length ? (
                <ul className="space-y-2">
                  {report.recommendedFixes.map((action) => {
                    const key = actionKey(action);
                    const checked = selectedActions.includes(key);
                    return (
                      <li
                        key={key}
                        className="flex items-start gap-3 rounded-md border border-border p-3"
                      >
                        <input
                          type="checkbox"
                          className="mt-1 size-4"
                          checked={checked}
                          onChange={() => toggleAction(key)}
                          disabled={loading}
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {describeAction(action, t)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t(`storage.diagnostics.actionTypes.${action.type}` as const)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("storage.diagnostics.noActions")}
                </p>
              )}
            </div>
          ) : null}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">
              {t("storage.diagnostics.recommendationsTitle")}
            </h3>
            {report.recommendations.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {report.recommendations.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("storage.diagnostics.noRecommendations")}
              </p>
            )}
          </div>
          {lastExecution ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              <h3 className="text-sm font-semibold text-foreground">
                {t("storage.diagnostics.lastExecutionTitle", {
                  value: formatDate(lastExecution.timestamp),
                })}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("storage.diagnostics.lastExecutionSummary", {
                  performed: lastExecution.performed.length,
                  errors: lastExecution.errors.length,
                })}
              </p>
              {lastExecution.errors.length ? (
                <ul className="list-disc space-y-1 pl-5 text-sm text-red-500">
                  {lastExecution.errors.map((item, index) => (
                    <li key={`${actionKey(item.action)}:${index}`}>
                      {describeAction(item.action, t)} — {item.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          {running ? t("storage.diagnostics.loading") : t("storage.diagnostics.noReport")}
        </div>
      )}
      {!report && !running ? (
        <div className="text-xs text-muted-foreground">
          {t("storage.diagnostics.loadingHint")}
        </div>
      ) : null}
    </section>
  );
}
