// Назначение файла: хранение CSRF-токена с резервом в памяти
// Основные модули: web utils
let memoryToken: string | null

export function getCsrfToken(): string | null {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('csrfToken') || memoryToken || null
    } catch {
      return memoryToken || null
    }
  }
  return memoryToken || null
}

export function setCsrfToken(t: string): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('csrfToken', t)
      memoryToken = t
      return
    } catch {
      memoryToken = t
      return
    }
  }
  memoryToken = t
}
