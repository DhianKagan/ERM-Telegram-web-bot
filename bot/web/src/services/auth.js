/* eslint-env browser, es6 */
// API запросы для регистрации и входа
export const login = creds =>
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds)
  }).then(r => r.json())

export const register = data =>
  fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(r => r.json())

export const getProfile = token =>
  fetch('/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())
