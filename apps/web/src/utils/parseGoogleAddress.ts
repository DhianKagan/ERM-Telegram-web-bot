/**
 * Назначение файла: извлекает короткий адрес из ссылки Google Maps.
 * Основные модули: parseGoogleAddress.
 */
const GOOGLE_LABEL_FALLBACK = "Точка на карте";

const isGoogleHost = (candidate: string): boolean => {
  if (!candidate) {
    return false;
  }
  const host = candidate.toLowerCase();
  return (
    host.includes("google") ||
    host.endsWith("goo.gl") ||
    host.endsWith("maps.app") ||
    host.endsWith("maps.app.goo.gl")
  );
};

export default function parseGoogleAddress(url: string): string {
  if (!url) {
    return url;
  }
  try {
    const place = url.match(/\/place\/([^/]+)/);
    if (place) {
      return decodeURIComponent(place[1].replace(/\+/g, " ")).split(",")[0];
    }
    const q = url.match(/[?&]q=([^&]+)/);
    if (q) {
      return decodeURIComponent(q[1].replace(/\+/g, " ")).split(",")[0];
    }
    const parsed = new URL(url);
    if (isGoogleHost(parsed.hostname)) {
      const searchLabel = parsed.searchParams.get("q");
      if (searchLabel) {
        return decodeURIComponent(searchLabel.replace(/\+/g, " ")).split(",")[0];
      }
      return GOOGLE_LABEL_FALLBACK;
    }
    return url;
  } catch {
    return url;
  }
}
