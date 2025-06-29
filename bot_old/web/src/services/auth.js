/* eslint-env browser, es6 */
// API запросы для регистрации и входа
export const getProfile = token =>
  fetch('/api/auth/profile', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json())
