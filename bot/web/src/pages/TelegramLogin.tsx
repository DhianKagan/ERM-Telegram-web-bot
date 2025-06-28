// Страница входа через Telegram Login виджет
import { useEffect } from 'react'

export default function TelegramLogin() {
  useEffect(() => {
    // @ts-expect-error: глобальный объект от виджета Telegram
    window.onTelegramAuth = (user: Record<string, unknown>) => {
      fetch('/api/auth/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      })
        .then(r => r.json())
        .then(d => {
          localStorage.setItem('token', d.token)
          window.location.href = '/'
        })
    }
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    const botUser = import.meta.env.VITE_BOT_USERNAME
    if (!botUser || botUser === 'YOUR_BOT_USERNAME') {
      console.error('VITE_BOT_USERNAME не задан')
    }
    script.setAttribute('data-telegram-login', botUser || 'YOUR_BOT_USERNAME')
    script.setAttribute('data-size', 'large')
    script.setAttribute('data-request-access', 'write')
    script.setAttribute('data-onauth', 'onTelegramAuth(user)')
    document.getElementById('telegram-button')?.appendChild(script)
  }, [])
  return <div className="p-4" id="telegram-button" />
}
