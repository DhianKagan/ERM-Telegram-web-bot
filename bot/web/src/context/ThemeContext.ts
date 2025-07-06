// Контекст темы
import { createContext } from 'react'

type Theme = 'light'

export interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const ThemeContext = createContext<ThemeState | undefined>(undefined)

// Экспорт провайдера из соседнего файла
export { ThemeProvider } from './ThemeContext.tsx'

