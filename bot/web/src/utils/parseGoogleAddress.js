// Извлекает короткий адрес из ссылки Google Maps
export default function parseGoogleAddress(url) {
  try {
    const place = url.match(/\/place\/([^/]+)/);
    if (place) return decodeURIComponent(place[1].replace(/\+/g, ' ')).split(',')[0];
    const q = url.match(/[?&]q=([^&]+)/);
    if (q) return decodeURIComponent(q[1].replace(/\+/g, ' ')).split(',')[0];
    return url;
  } catch {
    return url;
  }
}
