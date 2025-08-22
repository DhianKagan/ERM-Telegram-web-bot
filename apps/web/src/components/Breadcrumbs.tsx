// Хлебные крошки навигации
import React from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="text-body mb-4 text-sm">
      <ol className="list-reset flex">
        {items.map((c, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <li>
                <span className="text-body px-2">/</span>
              </li>
            )}
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
  );
}
