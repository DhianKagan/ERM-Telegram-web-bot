/**
 * Назначение: утилиты доступа к API сервера.
 * Основные модули: fetch, localStorage.
 */
const base = process.env.NEXT_PUBLIC_API_BASE ?? ''

function token() {
  return localStorage.getItem('token') ?? ''
}

async function api(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = token()
  if (t) headers.Authorization = `Bearer ${t}`
  if (options.headers) Object.assign(headers, options.headers as Record<string, string>)
  const res = await fetch(base + path, { ...options, headers })

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

export async function createTask(description: string) {
  return api('/tasks', {
    method: 'POST',
    body: JSON.stringify({ description })
  })
}

