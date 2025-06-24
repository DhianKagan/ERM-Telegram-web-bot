// Компонент вкладок TailAdmin
import React from 'react'

export interface TabOption {
  key: string
  label: string
}

export default function Tabs({ options, active, onChange }: { options: TabOption[]; active: string; onChange: (key: string) => void }) {
  return (
    <div className="mb-4 border-b border-stroke dark:border-strokedark">
      {options.map((o) => (
        <button
          key={o.key}
          className={`mr-4 pb-2 text-sm font-medium ${active === o.key ? 'text-primary border-b-2 border-primary' : 'text-body hover:text-primary'}`}
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
