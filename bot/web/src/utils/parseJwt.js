// Назначение файла: утилита для разбора JWT
// Разбор JWT для извлечения полезной нагрузки
export default function parseJwt(token) {
  try {
    const base = token.split('.')[1]
    const json = atob(base)
    return JSON.parse(json)
  } catch {
    return null
  }
}
