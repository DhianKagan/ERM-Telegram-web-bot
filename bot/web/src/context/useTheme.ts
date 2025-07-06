// Хук доступа к теме
import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('ThemeContext')
  return ctx
}

