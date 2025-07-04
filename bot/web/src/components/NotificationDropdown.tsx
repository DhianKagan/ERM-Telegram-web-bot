// Выпадающий список уведомлений
import React from 'react'

export default function NotificationDropdown({ notifications, children }: { notifications: string[]; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="relative" onBlur={() => setOpen(false)} tabIndex={0}>
      <button onClick={() => setOpen(!open)} className="p-2 hover:text-accentPrimary" aria-label="Уведомления">
        {children}
      </button>
      {open && (
        <ul className="absolute right-0 mt-2 w-60 rounded border border-stroke bg-white py-2 shadow-lg transition-all">
          {notifications.length ? (
            notifications.map((n, i) => (
              <li key={i} className="px-4 py-2 text-sm text-body hover:bg-gray">
                {n}
              </li>
            ))
          ) : (
            <li className="px-4 py-2 text-sm text-bodydark">Нет уведомлений</li>
          )}
        </ul>
      )}
    </div>
  )
}
