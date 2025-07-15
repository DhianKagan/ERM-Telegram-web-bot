// Страница входа в админку через код
import React, { useState } from 'react'

export default function AdminLogin() {
  const [telegramId, setTelegramId] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)

  async function send(e?: React.FormEvent) {
    e?.preventDefault()
    await fetch('/api/v1/admin_auth/send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId) })
    })
    setSent(true)
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault()
    const res = await fetch('/api/v1/admin_auth/verify_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId), code })
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('token', data.token)
      window.location.href = '/admin'
    }
  }

  return (
    <form className="p-4 flex flex-col gap-2" onSubmit={sent ? verify : send}>
      <input
        className="border p-2"
        placeholder="Telegram ID"
        value={telegramId}
        onChange={e => setTelegramId(e.target.value)}
      />
      <a
        className="text-blue-500 underline"
        href="https://telegram.me/userinfobot"
        target="_blank"
        rel="noopener"
      >
        Узнать свой ID через @userinfobot
      </a>
      {sent && (
        <input
          className="border p-2"
          placeholder="Код"
          value={code}
          onChange={e => setCode(e.target.value)}
        />
      )}
      <button type="submit" className="bg-blue-500 text-white p-2">
        {sent ? 'Войти по коду' : 'Отправить код'}
      </button>
    </form>
  )
}
