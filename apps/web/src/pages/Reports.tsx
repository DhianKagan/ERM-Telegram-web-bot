// Страница отчётов с фильтром по датам
import React from "react";
import ReportFilterForm from "../components/ReportFilterForm";
import KPIOverview from "../components/KPIOverview";
import TasksChart from "../components/TasksChart";
import authFetch from "../utils/authFetch";
import { Button } from "../components/ui/button";
import { showToast } from "../utils/toast";

export default function Reports() {
  const [kpi, setKpi] = React.useState({ count: 0, time: 0 });
  const [filters, setFilters] = React.useState<{ from?: string; to?: string }>({});
  const [downloading, setDownloading] = React.useState({
    pdf: false,
    xlsx: false,
  });

  const normalizePeriod = (source?: { from?: string; to?: string }) => {
    const normalized: { from?: string; to?: string } = {};
    if (source?.from) {
      const trimmed = source.from.trim();
      if (trimmed) normalized.from = trimmed;
    }
    if (source?.to) {
      const trimmed = source.to.trim();
      if (trimmed) normalized.to = trimmed;
    }
    return normalized;
  };

  const buildQuery = (period: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
    const query = params.toString();
    return query ? `?${query}` : "";
  };

  const extractFilename = (header: string | null, fallback: string) => {
    if (!header) return fallback;
    const match = header.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i);
    if (match && match[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    return fallback;
  };

  const handleDownload = React.useCallback(
    async (kind: "pdf" | "xlsx") => {
      setDownloading((prev) => ({ ...prev, [kind]: true }));
      try {
        const query = buildQuery(filters);
        const endpoint =
          kind === "pdf"
            ? `/api/v1/tasks/report.pdf${query}`
            : `/api/v1/tasks/report.xlsx${query}`;
        const res = await authFetch(endpoint, { noRedirect: true });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const fallbackName =
          kind === "pdf" ? "tasks-report.pdf" : "tasks-report.xlsx";
        const filename = extractFilename(disposition, fallbackName);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("report download error", error);
        showToast("Не удалось скачать отчёт", "error");
      } finally {
        setDownloading((prev) => ({ ...prev, [kind]: false }));
      }
    },
    [filters],
  );

  const fetchSummary = React.useCallback((period: { from?: string; to?: string }) => {
    authFetch(`/api/v1/tasks/report/summary${buildQuery(period)}`)
      .then((r) => (r.ok ? r.json() : { count: 0, time: 0 }))
      .then(setKpi);
  }, []);

  const load = (next?: { from?: string; to?: string }) => {
    const normalized = normalizePeriod(next);
    setFilters(normalized);
    fetchSummary(normalized);
  };

  React.useEffect(() => {
    fetchSummary({});
  }, [fetchSummary]);
  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-xl font-semibold">Отчёты</h2>
        <ReportFilterForm onChange={load} />
        <KPIOverview count={kpi.count} time={kpi.time} />
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleDownload("pdf")}
            disabled={downloading.pdf}
          >
            {downloading.pdf ? "Формируем PDF..." : "Скачать PDF"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDownload("xlsx")}
            disabled={downloading.xlsx}
          >
            {downloading.xlsx ? "Формируем Excel..." : "Скачать Excel"}
          </Button>
        </div>
      </div>
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Динамика задач</h3>
        <TasksChart filters={filters} />
      </div>
    </div>
  );
}
