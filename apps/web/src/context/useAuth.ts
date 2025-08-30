// Хук доступа к данным и действиям аутентификации
import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import { AuthActionsContext } from "./AuthActionsContext";

export function useAuth() {
  const state = useContext(AuthContext);
  const actions = useContext(AuthActionsContext);
  return { ...state, ...actions };
}
