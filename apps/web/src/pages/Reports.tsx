// Страница отчётов с фильтром по датам
import React from "react";
import ReportFilterForm from "../components/ReportFilterForm";
import KPIOverview from "../components/KPIOverview";
import TasksChart from "../components/TasksChart";
import authFetch from "../utils/authFetch";

export default function Reports() {
  const [kpi, setKpi] = React.useState({ count: 0, time: 0 });
  const [filters, setFilters] = React.useState<{ from?: string; to?: string }>({});

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
      </div>
      <div className="space-y-4 rounded-lg bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold">Динамика задач</h3>
        <TasksChart filters={filters} />
      </div>
    </div>
  );
}
