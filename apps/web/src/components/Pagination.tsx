// Пагинация списка элементов
import React from 'react';

export default function Pagination({
  total,
  page,
  onChange,
}: {
  total: number;
  page: number;
  onChange: (p: number) => void;
}) {
  const pages = Array.from({ length: total }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-end space-x-1 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className="border-stroke text-body hover:bg-gray rounded border px-3 py-1 disabled:pointer-events-none disabled:opacity-50"
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`border-stroke text-body hover:bg-gray rounded border px-3 py-1 ${p === page ? 'bg-gray font-medium' : ''}`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        className="border-stroke text-body hover:bg-gray rounded border px-3 py-1 disabled:pointer-events-none disabled:opacity-50"
      >
        →
      </button>
    </div>
  );
}
