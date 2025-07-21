// Обёртка для fetch с учётом cookie
// Модули: fetch, window.location
export default function authFetch(url, options = {}) {
  return fetch(url, { ...options, credentials: "include" }).then((res) => {
    if (res.status === 401 || res.status === 403) {
      window.location.href = "/login";
    }
    return res;
  });
}
