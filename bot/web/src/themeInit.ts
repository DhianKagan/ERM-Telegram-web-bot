// Назначение файла: инициализация темы до загрузки приложения.
// Основные модули: document, JSON
(function () {
  const m = document.cookie.match(/theme=([^;]+)/);
  const t = m ? decodeURIComponent(m[1]) : "light";
  const tokens = document.cookie.match(/theme-tokens=([^;]+)/);
  if (tokens) {
    try {
      const obj: Record<string, string> = JSON.parse(
        decodeURIComponent(tokens[1]),
      );
      for (const k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          document.documentElement.style.setProperty(`--${k}`, obj[k]);
        }
      }
    } catch {
      // игнорируем ошибки парсинга
    }
  }
  if (t === "dark") document.documentElement.classList.add("dark");
})();
