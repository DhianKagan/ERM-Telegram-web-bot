/* eslint-env browser, es6 */
// API запросы для регистрации и входа
export const getProfile = token =>
  fetch('/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())

export const updateProfile = (token, data) =>
  fetch('/api/auth/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  }).then(r => r.json())
