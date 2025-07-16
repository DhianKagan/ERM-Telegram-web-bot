// Обёртка для fetch с автоматическим добавлением JWT
// Модули: fetch, localStorage, window.location
export default function authFetch(url, options = {}) {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.href = '/login'
    return Promise.resolve(new Response(null, { status: 401 }))
  }
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return res
  })
}
