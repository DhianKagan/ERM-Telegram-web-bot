// Хук доступа к данным и действиям аутентификации
import { useContext, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import { AuthActionsContext } from "./AuthActionsContext";

export function useAuth() {
  const state = useContext(AuthContext);
  const actions = useContext(AuthActionsContext);
  useEffect(() => {
    const id = window.setInterval(
      () => {
        fetch("/api/v1/auth/refresh", {
          method: "POST",
          credentials: "include",
        }).catch(() => {});
      },
      4 * 60 * 1000,
    );
    return () => clearInterval(id);
  }, []);
  return { ...state, ...actions };
}
