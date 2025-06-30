// Карточка KPI: отображает название, значение и дельту
import React from 'react'

interface KpiCardProps {
  title: string
  value: number
  delta?: number
  icon?: React.ComponentType<{ className?: string }>
}

export default function KpiCard({ title, value, delta, icon: Icon }: KpiCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-1 text-2xl font-bold text-accentPrimary">{value}</p>
        {delta !== undefined && (
          <p className={`text-sm ${delta >= 0 ? 'text-green-500' : 'text-red-500'}`}>{delta >= 0 ? '+' : ''}{delta}</p>
        )}
      </div>
      {Icon && <Icon className="h-8 w-8 text-gray-400" />}
    </div>
  )
}
