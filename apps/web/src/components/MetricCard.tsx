// Карточка метрики для Dashboard
import React from 'react';
import { type ElementType } from 'react';

interface Props {
  title: string;
  value: number;
  icon: ElementType;
}

export default function MetricCard({ title, value, icon: Icon }: Props) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-accentPrimary mt-2 text-2xl font-bold">{value}</p>
      </div>
      <Icon className="h-8 w-8 text-gray-400" />
    </div>
  );
}
