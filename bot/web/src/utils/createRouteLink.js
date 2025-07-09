// Формирование ссылки маршрута Google Maps из координат
export default function createRouteLink(start, end, mode='driving'){
  if(!start||!end) return ''
  return `https://www.google.com/maps/dir/?api=1&origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&travelmode=${mode}`
}
