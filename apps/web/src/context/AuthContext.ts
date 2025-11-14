// Контекст аутентификации
import { createContext } from 'react';
import type { User } from '../types/user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});
