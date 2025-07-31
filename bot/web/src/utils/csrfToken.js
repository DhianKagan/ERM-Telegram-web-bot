// Хранение CSRF-токена с резервом в памяти
let memoryToken

export function getCsrfToken() {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('csrfToken') || memoryToken
    } catch {
      return memoryToken
    }
  }
  return memoryToken
}

export function setCsrfToken(t) {
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
