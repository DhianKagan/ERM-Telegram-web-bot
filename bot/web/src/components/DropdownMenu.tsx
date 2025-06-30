// Выпадающее меню общего назначения
import React from 'react'

export interface DropdownItem {
  label: string
  href?: string
  onClick?: () => void
}

export default function DropdownMenu({ items }: { items: DropdownItem[] }) {
  const [open, setOpen] = React.useState(false)
  const toggle = () => setOpen(!open)
  const close = () => setOpen(false)
  return (
    <div className="relative" onBlur={close} tabIndex={0}>
      <button onClick={toggle} className="h-8 w-8 rounded-full focus:outline-none">
        <img src="/img/avatar.png" alt="avatar" className="h-full w-full rounded-full" />
      </button>
      {open && (
        <ul className="absolute right-0 mt-2 w-48 rounded border border-stroke bg-white py-2 shadow-lg transition-all">
          {items.map((item, idx) => (
            <li key={idx} className={idx ? 'border-t border-stroke' : ''}>
              {item.href ? (
                <a href={item.href} className="block w-full px-4 py-2 text-left text-sm text-body hover:bg-gray">
                  {item.label}
                </a>
              ) : (
                <button onClick={item.onClick} className="block w-full px-4 py-2 text-left text-sm text-body hover:bg-gray">
                  {item.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
