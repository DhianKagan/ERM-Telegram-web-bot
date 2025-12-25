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
  const buttonClasses =
    'border-stroke text-body hover:bg-gray rounded border px-3 py-1 disabled:pointer-events-none disabled:opacity-50 min-h-[var(--touch-target)] min-w-[var(--touch-target)]';
  return (
    <div className="flex items-center justify-end space-x-1 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page === 1}
        className={buttonClasses}
        aria-label="Предыдущая страница"
        type="button"
      >
        ←
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`${buttonClasses} ${p === page ? 'bg-gray font-medium' : ''}`}
          aria-current={p === page}
          type="button"
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page === total}
        className={buttonClasses}
        aria-label="Следующая страница"
        type="button"
      >
        →
      </button>
    </div>
  );
}
