// Всплывающее уведомление о результате действия
import React from 'react'
import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/solid'

export default function NotificationBar({ message, type = 'success' }: { message: string; type?: 'success' | 'error' }) {
  const [show, setShow] = React.useState(true)
  React.useEffect(() => {
    const t = setTimeout(() => setShow(false), 3000)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  const base = 'fixed right-4 top-4 z-50 flex items-center rounded-lg px-4 py-2 text-white shadow-lg'
  const color = type === 'error' ? 'bg-danger' : 'bg-success'
  const Icon = type === 'error' ? ExclamationCircleIcon : CheckCircleIcon
  return (
    <div className={`${base} ${color}`}> 
      <Icon className="mr-2 h-5 w-5" />
      <span className="mr-2">{message}</span>
      <button onClick={() => setShow(false)} className="ml-auto text-xl leading-none hover:opacity-75">
        <XMarkIcon className="h-5 w-5" />
      </button>
    </div>
  )
}
