// График количества задач за период
// Модули: React, react-apexcharts, next-themes, authFetch
import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import authFetch from '../utils/authFetch';
const ReactApexChart = React.lazy(() => import('react-apexcharts'));

interface ChartState {
  series: { data: number[] }[];
  categories: string[];
}

interface TasksChartProps {
  filters?: {
    from?: string;
    to?: string;
  };
}

const buildQuery = (filters?: TasksChartProps['filters']) => {
  const params = new URLSearchParams();
  if (filters?.from) params.set('from', filters.from);
  if (filters?.to) params.set('to', filters.to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export default function TasksChart({ filters }: TasksChartProps) {
  const [series, setSeries] = useState<ChartState['series']>([{ data: [] }]);
  const [categories, setCategories] = useState<ChartState['categories']>([]);
  const { theme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    authFetch(`/api/v1/tasks/report/chart${buildQuery(filters)}`)
      .then((r) => (r.ok ? r.json() : { data: [], labels: [] }))
      .then(({ data, labels }) => {
        if (cancelled) return;
        const normalizedData = Array.isArray(data)
          ? data.map((value) => {
              const numeric = Number(value);
              return Number.isFinite(numeric) ? numeric : 0;
            })
          : [];
        const normalizedLabels = Array.isArray(labels)
          ? labels.map((label) => String(label))
          : [];
        setSeries([{ data: normalizedData }]);
        setCategories(normalizedLabels);
      })
      .catch(() => {
        if (cancelled) return;
        setSeries([{ data: [] }]);
        setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filters?.from, filters?.to]);

  const options = {
    chart: {
      height: 200,
      type: 'line',
      fontFamily: 'Inter, sans-serif',
      toolbar: { show: false },
      background: theme === 'dark' ? '#24303F' : undefined,
    },
    colors: ['#2563EB'],
    stroke: { width: 2, curve: 'smooth' },
    xaxis: {
      categories,
      labels: { style: { colors: theme === 'dark' ? '#DEE4EE' : '#6B7280' } },
    },
    yaxis: {
      labels: { style: { colors: theme === 'dark' ? '#DEE4EE' : '#6B7280' } },
    },
  };

  return (
    <React.Suspense fallback={<div>Загрузка...</div>}>
      <ReactApexChart
        series={series}
        options={options}
        type="line"
        height={200}
      />
    </React.Suspense>
  );
}
