// Блок KPI с общими метриками по задачам
import React from 'react';

interface KPIOverviewProps {
  count: number;
  time: number;
}

export default function KPIOverview({ count, time }: KPIOverviewProps) {
  return (
    <div className="flex space-x-4">
      <div className="rounded border p-2">Всего задач: {count}</div>
      <div className="rounded border p-2">Затрачено минут: {time}</div>
    </div>
  );
}
