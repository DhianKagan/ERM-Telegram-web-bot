// Назначение: дашборд аналитики маршрутных планов с фильтрами и графиками.
// Основные модули: React, react-apexcharts, services/analytics

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { RoutePlanAnalyticsSummary, RoutePlanStatus } from 'shared';
import { ChartPieIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { FormGroup } from '@/components/ui/form-group';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useRoutePlanAnalytics } from '../services/analytics';
import SettingsSectionHeader from './Settings/SettingsSectionHeader';

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
  const params = React.useMemo(() => ensureParams(filters), [filters]);
  const {
    data: summary,
    isFetching,
    error,
    refetch,
  } = useRoutePlanAnalytics(params, { keepPreviousData: true });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextFilters: DashboardFilters = {
      from: String(form.get('from') || ''),
      to: String(form.get('to') || ''),
      status: (form.get('status') as DashboardFilters['status']) || 'all',
    };
    const isSameFilters =
      filters.from === nextFilters.from &&
      filters.to === nextFilters.to &&
      filters.status === nextFilters.status;
    setFilters(nextFilters);
    if (isSameFilters) {
      void refetch();
    }
  };

  const handleReset = () => {
    const initial: DashboardFilters = {
      from: defaultFrom,
      to: defaultTo,
      status: 'completed',
    };
    setFilters(initial);
    void refetch();
  };

  const handleFormKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleReset();
    }
  };

  const mileageSeries = React.useMemo(
    () => mapMileageSeries(summary),
    [summary],
  );
  const loadSeries = React.useMemo(() => mapLoadSeries(summary), [summary]);
  const slaSeries = React.useMemo(() => mapSlaSeries(summary), [summary]);
  const isLoading = isFetching && !summary;
  const loadError =
    error instanceof Error
      ? error.message || t('analytics.loadError')
      : error
        ? t('analytics.loadError')
        : null;
  const formKey = React.useMemo(() => JSON.stringify(filters), [filters]);

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title={t('analytics.title')}
        description={t('analytics.description')}
        icon={ChartPieIcon}
        controls={
          <form
            key={formKey}
            onSubmit={handleSubmit}
            onKeyDown={handleFormKeyDown}
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <FormGroup
              label={t('analytics.filters.from')}
              htmlFor="report-from"
            >
              <Input
                id="report-from"
                type="date"
                name="from"
                defaultValue={filters.from}
              />
            </FormGroup>
            <FormGroup label={t('analytics.filters.to')} htmlFor="report-to">
              <Input
                id="report-to"
                type="date"
                name="to"
                defaultValue={filters.to}
              />
            </FormGroup>
            <FormGroup
              label={t('analytics.filters.status')}
              htmlFor="report-status"
            >
              <Select
                id="report-status"
                name="status"
                defaultValue={filters.status}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(`analytics.status.${option.value}`)}
                  </option>
                ))}
              </Select>
            </FormGroup>
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" variant="primary" disabled={isFetching}>
                {isFetching ? t('analytics.loading') : t('analytics.apply')}
              </Button>
              <Button type="button" variant="outline" onClick={handleReset}>
                {t('analytics.reset')}
              </Button>
            </div>
          </form>
        }
      />
      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {loadError}
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
