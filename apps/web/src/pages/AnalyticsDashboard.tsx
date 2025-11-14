// Назначение: дашборд аналитики маршрутных планов с фильтрами и графиками.
// Основные модули: React, react-apexcharts, services/analytics

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RoutePlanAnalyticsSummary, RoutePlanStatus } from 'shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchRoutePlanAnalytics } from '../services/analytics';

const ReactApexChart = React.lazy(() => import('react-apexcharts'));

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateInput = (date: Date): string => {
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  return iso;
};

const defaultTo = toDateInput(new Date());
const defaultFrom = toDateInput(new Date(Date.now() - DAY_MS * 29));

type DashboardFilters = {
  from: string;
  to: string;
  status: RoutePlanStatus | 'all';
};

const statusOptions: Array<{ value: RoutePlanStatus | 'all'; label: string }> =
  [
    { value: 'all', label: 'Все статусы' },
    { value: 'draft', label: 'Черновики' },
    { value: 'approved', label: 'Утверждённые' },
    { value: 'completed', label: 'Завершённые' },
  ];

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const loadFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const ensureParams = (filters: DashboardFilters) => {
  const params: Record<string, string> = {};
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.status !== 'all') params.status = filters.status;
  return params;
};

const mapMileageSeries = (data?: RoutePlanAnalyticsSummary | null) =>
  data?.mileage.byPeriod.map((point) => ({
    x: point.date,
    y: typeof point.value === 'number' ? point.value : 0,
  })) ?? [];

const mapLoadSeries = (data?: RoutePlanAnalyticsSummary | null) =>
  data?.load.byPeriod.map((point) => ({
    x: point.date,
    y: typeof point.value === 'number' ? point.value : null,
  })) ?? [];

const mapSlaSeries = (data?: RoutePlanAnalyticsSummary | null) =>
  data?.sla.byPeriod.map((point) => ({
    x: point.date,
    y:
      typeof point.rate === 'number'
        ? Number((point.rate * 100).toFixed(2))
        : null,
  })) ?? [];

export default function AnalyticsDashboard(): React.ReactElement {
  const { t } = useTranslation();
  const [filters, setFilters] = React.useState<DashboardFilters>({
    from: defaultFrom,
    to: defaultTo,
    status: 'completed',
  });
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] =
    React.useState<RoutePlanAnalyticsSummary | null>(null);

  const loadData = React.useCallback(
    async (params: DashboardFilters) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchRoutePlanAnalytics(ensureParams(params));
        setSummary(response);
      } catch (err) {
        console.error('Не удалось загрузить аналитику маршрутных планов', err);
        setError(t('analytics.loadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  React.useEffect(() => {
    void loadData(filters);
  }, [filters, loadData]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextFilters: DashboardFilters = {
      from: String(form.get('from') || ''),
      to: String(form.get('to') || ''),
      status: (form.get('status') as DashboardFilters['status']) || 'all',
    };
    setFilters(nextFilters);
  };

  const handleReset = () => {
    const initial: DashboardFilters = {
      from: defaultFrom,
      to: defaultTo,
      status: 'completed',
    };
    setFilters(initial);
  };

  const mileageSeries = React.useMemo(
    () => mapMileageSeries(summary),
    [summary],
  );
  const loadSeries = React.useMemo(() => mapLoadSeries(summary), [summary]);
  const slaSeries = React.useMemo(() => mapSlaSeries(summary), [summary]);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">{t('analytics.title')}</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {t('analytics.description')}
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900"
      >
        <label className="flex flex-col text-sm text-slate-700 dark:text-slate-200">
          {t('analytics.filters.from')}
          <Input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label className="flex flex-col text-sm text-slate-700 dark:text-slate-200">
          {t('analytics.filters.to')}
          <Input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label className="flex flex-col text-sm text-slate-700 dark:text-slate-200">
          {t('analytics.filters.status')}
          <select
            name="status"
            defaultValue={filters.status}
            className="mt-1 w-48 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(`analytics.status.${option.value}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? t('analytics.loading') : t('analytics.apply')}
          </Button>
          <Button type="button" variant="outline" onClick={handleReset}>
            {t('analytics.reset')}
          </Button>
        </div>
      </form>
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-300">
            {t('analytics.cards.mileage')}
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {numberFormatter.format(summary?.mileage.total ?? 0)} км
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('analytics.cards.period', {
              from: summary?.period.from ?? filters.from,
              to: summary?.period.to ?? filters.to,
            })}
          </p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-300">
            {t('analytics.cards.load')}
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {typeof summary?.load.average === 'number'
              ? `${loadFormatter.format(summary.load.average)} кг`
              : t('analytics.noData')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('analytics.cards.loadHint')}
          </p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="text-sm font-medium text-slate-500 dark:text-slate-300">
            SLA
          </h2>
          <p className="mt-2 text-2xl font-semibold">
            {typeof summary?.sla.average === 'number'
              ? percentFormatter.format(summary.sla.average)
              : t('analytics.noData')}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t('analytics.cards.slaHint')}
          </p>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900 lg:col-span-3">
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {t('analytics.charts.mileage')}
          </h3>
          <React.Suspense fallback={<div>{t('analytics.loading')}</div>}>
            <ReactApexChart
              type="area"
              height={280}
              series={[
                { name: t('analytics.cards.mileage'), data: mileageSeries },
              ]}
              options={{
                chart: {
                  id: 'analytics-mileage',
                  animations: { enabled: false },
                },
                dataLabels: { enabled: false },
                stroke: { curve: 'smooth', width: 2 },
                xaxis: { type: 'category' },
                yaxis: {
                  labels: {
                    formatter: (value: number) => numberFormatter.format(value),
                  },
                },
                tooltip: {
                  y: {
                    formatter: (value: number) =>
                      `${numberFormatter.format(value)} км`,
                  },
                },
              }}
            />
          </React.Suspense>
        </div>
        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {t('analytics.charts.load')}
          </h3>
          <React.Suspense fallback={<div>{t('analytics.loading')}</div>}>
            <ReactApexChart
              type="bar"
              height={280}
              series={[{ name: t('analytics.cards.load'), data: loadSeries }]}
              options={{
                chart: { id: 'analytics-load', animations: { enabled: false } },
                dataLabels: { enabled: false },
                xaxis: { type: 'category' },
                yaxis: {
                  labels: {
                    formatter: (value: number) =>
                      `${loadFormatter.format(value)} кг`,
                  },
                },
                tooltip: {
                  y: {
                    formatter: (value: number) =>
                      `${loadFormatter.format(value)} кг`,
                  },
                },
              }}
            />
          </React.Suspense>
        </div>
        <div className="space-y-2 rounded-lg bg-white p-4 shadow-sm dark:bg-slate-900">
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">
            {t('analytics.charts.sla')}
          </h3>
          <React.Suspense fallback={<div>{t('analytics.loading')}</div>}>
            <ReactApexChart
              type="line"
              height={280}
              series={[{ name: 'SLA', data: slaSeries }]}
              options={{
                chart: { id: 'analytics-sla', animations: { enabled: false } },
                dataLabels: { enabled: false },
                stroke: { curve: 'straight', width: 2 },
                markers: { size: 4 },
                xaxis: { type: 'category' },
                yaxis: {
                  min: 0,
                  max: 100,
                  tickAmount: 5,
                  labels: {
                    formatter: (value: number) =>
                      percentFormatter.format(value / 100),
                  },
                },
                tooltip: {
                  y: {
                    formatter: (value: number) =>
                      percentFormatter.format(value / 100),
                  },
                },
              }}
            />
          </React.Suspense>
        </div>
      </section>
    </div>
  );
}
