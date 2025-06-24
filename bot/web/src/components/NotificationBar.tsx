// Всплывающее уведомление о результате действия
import React from 'react'

export default function NotificationBar({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  const [show, setShow] = React.useState(true)
  React.useEffect(() => {
    const t = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  const base = 'fixed right-4 top-4 z-50 flex items-center rounded-lg px-4 py-2 text-white shadow-lg'
  const color = type === 'error' ? 'bg-danger' : 'bg-success'
  return (
    <div className={`${base} ${color}`} onClick={() => setShow(false)}>
      {message}
    </div>
  )
}
