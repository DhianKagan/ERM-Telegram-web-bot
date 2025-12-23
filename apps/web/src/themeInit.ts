// Назначение файла: инициализация темы до загрузки приложения.
// Основные модули: document, JSON
(function () {
  const storedTheme = localStorage.getItem('theme');
  const m = document.cookie.match(/theme=([^;]+)/);
  const cookieTheme = m ? decodeURIComponent(m[1]) : null;
  const t = storedTheme || cookieTheme || 'light';
  const tokens = document.cookie.match(/theme-tokens=([^;]+)/);
  if (tokens) {
    try {
      const parsed = JSON.parse(decodeURIComponent(tokens[1])) as unknown;
      let map: Record<string, string> | null = null;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if ('theme' in parsed || 'tokens' in parsed) {
          const cookieTheme = (parsed as { theme?: unknown }).theme;
          const rawTokens = (parsed as { tokens?: unknown }).tokens;
          if (
            (typeof cookieTheme !== 'string' || cookieTheme === t) &&
            rawTokens &&
            typeof rawTokens === 'object' &&
            !Array.isArray(rawTokens)
          ) {
            map = {};
            for (const [key, value] of Object.entries(
              rawTokens as Record<string, unknown>,
            )) {
              if (typeof value === 'string') {
                map[key] = value;
              }
            }
          }
        } else {
          map = {};
          for (const [key, value] of Object.entries(
            parsed as Record<string, unknown>,
          )) {
            if (typeof value === 'string') {
              map[key] = value;
            }
          }
        }
      }
      if (map) {
        for (const [key, value] of Object.entries(map)) {
          document.documentElement.style.setProperty(`--${key}`, value);
        }
      }
    } catch {
      // игнорируем ошибки парсинга
    }
  }
  if (t === 'dark') document.documentElement.classList.add('dark');
  document.documentElement.dataset.theme = `erm-${t}`;
})();
