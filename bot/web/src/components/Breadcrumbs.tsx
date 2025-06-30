// Хлебные крошки навигации
import React from 'react'

export interface Crumb {
  label: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="mb-4 text-sm text-body">
      <ol className="list-reset flex">
        {items.map((c, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <li><span className="px-2 text-body">/</span></li>}
            <li>
              {c.href ? (
                <a href={c.href} className="text-primary hover:underline">
                  {c.label}
                </a>
              ) : (
                <span className="text-bodydark">{c.label}</span>
              )}
            </li>
          </React.Fragment>
        ))}
      </ol>
    </nav>
  )
}
