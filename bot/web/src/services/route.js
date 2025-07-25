// Запрос к API /api/v1/route для расчёта дистанции
// Модули: fetch, document.cookie

export const fetchRoute = async (start, end) => {
  const getToken = () =>
    typeof document !== "undefined"
      ? document.cookie
          .split("; ")
          .find((c) => c.startsWith("XSRF-TOKEN="))
          ?.slice("XSRF-TOKEN=".length)
      : undefined;
  let token = getToken();
  if (!token) {
    await fetch("/api/v1/csrf", { credentials: "include" }).catch(() => {});
    token = getToken();
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers["X-XSRF-TOKEN"] = token;
  const opts = {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ start, end }),
  };
  let res = await fetch("/api/v1/route", opts);
  if (res.status === 403) {
    let retry = false;
    try {
      const data = await res.clone().json();
      if (data.error === "Invalid CSRF token") retry = true;
    } catch {
      retry = true;
    }
    if (retry) {
      await fetch("/api/v1/csrf", { credentials: "include" });
      const fresh = getToken();
      if (fresh) headers["X-XSRF-TOKEN"] = fresh;
      res = await fetch("/api/v1/route", opts);
    }
  }
  return res.ok ? res.json() : null;
};
export default fetchRoute;

