// Уведомление об успешном действии
import React from 'react'

export default function NotificationBar({ message }: { message: string }) {
  const [show, setShow] = React.useState(true)
  if (!show) return null
  return (
    <div
      className="fixed right-4 top-4 z-50 flex items-center gap-2 rounded-lg border border-green-500 bg-success-50 px-4 py-2 text-sm text-green-700 shadow-md dark:border-green-600 dark:bg-success-700 dark:text-white"
      onClick={() => setShow(false)}
    >
      {message}
    </div>
  )
}
