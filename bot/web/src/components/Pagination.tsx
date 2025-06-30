// Пагинация списка элементов
import React from 'react'

export default function Pagination({ total, page, onChange }: { total: number; page: number; onChange: (p: number) => void }) {
  const pages = Array.from({ length: total }, (_, i) => i + 1)
  return (
    <div className="flex items-center justify-end space-x-1 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="px-3 py-1 rounded border border-stroke text-body hover:bg-gray disabled:opacity-50 disabled:pointer-events-none"
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1 rounded border border-stroke text-body hover:bg-gray ${p === page ? 'bg-gray font-medium' : ''}`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        className="px-3 py-1 rounded border border-stroke text-body hover:bg-gray disabled:opacity-50 disabled:pointer-events-none"
      >
        →
      </button>
    </div>
  )
}
