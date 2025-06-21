/**
 * Назначение: утилиты доступа к API сервера.
 * Основные модули: fetch, localStorage.
 */
const base = process.env.NEXT_PUBLIC_API_BASE ?? ''

function token() {
  return localStorage.getItem('token') ?? ''
}

async function api(path: string, options: RequestInit = {}) {
  const opts = {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}), Authorization: token() ? `Bearer ${token()}` : undefined },
    ...options,
  }
  const res = await fetch(base + path, opts)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function login(email: string, password: string) {
  const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  localStorage.setItem('token', data.token)
  return data
}

export async function getTasks() {
  return api('/tasks')
}

