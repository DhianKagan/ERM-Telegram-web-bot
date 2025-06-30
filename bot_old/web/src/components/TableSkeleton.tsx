// Компонент показывает полоски-заглушки вместо таблицы во время загрузки данных
import React from 'react'

export default function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse rounded border border-stroke bg-gray p-4">
      <div className="mb-4 h-6 w-1/3 rounded bg-gray-2" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 w-full rounded bg-gray-2" />
        ))}
      </div>
    </div>
  )
}
