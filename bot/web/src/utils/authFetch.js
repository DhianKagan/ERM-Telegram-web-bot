// Обёртка для fetch с автоматическим добавлением JWT.
export default function authFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  if (!token) {
    return Promise.reject(new Error('No token'));
  }
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  return fetch(url, { ...options, headers }).then(res => {
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('token');
    }
    return res;
  });
}
