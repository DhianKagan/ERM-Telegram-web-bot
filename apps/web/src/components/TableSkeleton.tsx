// Компонент показывает полоски-заглушки вместо таблицы во время загрузки данных
import React from 'react';

export default function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border-stroke bg-gray animate-pulse rounded border p-4">
      <div className="bg-gray-2 mb-4 h-6 w-1/3 rounded" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-gray-2 h-4 w-full rounded" />
        ))}
      </div>
    </div>
  );
}
