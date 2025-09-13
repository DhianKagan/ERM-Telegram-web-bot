/**
 * Назначение файла: извлекает короткий адрес из ссылки Google Maps.
 * Основные модули: parseGoogleAddress.
 */
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
    return url;
  } catch {
    return url;
  }
}
