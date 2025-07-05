// Страница входа через код подтверждения
import { useState } from 'react'

export default function CodeLogin() {
  const [telegramId, setTelegramId] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)

  async function send() {
    await fetch('/api/v1/auth/send_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId) })
    })
    setSent(true)
  }

  async function verify() {
    const res = await fetch('/api/v1/auth/verify_code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId: Number(telegramId), code })
    })
    if (res.ok) {
      const data = await res.json()
      localStorage.setItem('token', data.token)
      window.location.href = '/'
    }
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      <input
        className="border p-2"
        placeholder="Telegram ID"
        value={telegramId}
        onChange={(e) => setTelegramId(e.target.value)}
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
          onChange={(e) => setCode(e.target.value)}
        />
      )}
      {!sent ? (
        <button onClick={send} className="bg-blue-500 text-white p-2">
          Отправить код
        </button>
      ) : (
        <button onClick={verify} className="bg-blue-500 text-white p-2">
          Войти по коду
        </button>
      )}
    </div>
  )
}
