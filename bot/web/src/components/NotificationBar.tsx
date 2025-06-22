// Уведомление об успешном действии
import React from 'react'

export default function NotificationBar({ message }: { message: string }) {
  const [show, setShow] = React.useState(true)
  if (!show) return null
  return (
    <div className="fixed right-4 top-4 z-50 rounded bg-green-500 px-4 py-2 text-white shadow" onClick={() => setShow(false)}>
      {message}
    </div>
  )
}
