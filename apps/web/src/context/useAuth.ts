// Хук доступа к данным и действиям аутентификации
import { useContext, useEffect } from "react";
import { AuthContext } from "./AuthContext";
import { AuthActionsContext } from "./AuthActionsContext";
import authFetch from "../utils/authFetch";

let started = false;

export function useAuth() {
  const state = useContext(AuthContext);
  const actions = useContext(AuthActionsContext);
  useEffect(() => {
    if (started || !state.user) return;
    started = true;
    const id = setInterval(() => {
      authFetch("/api/v1/auth/refresh", {
        method: "POST",
        noRedirect: true,
      }).catch(() => {});
    }, 10 * 60 * 1000);
    return () => {
      clearInterval(id);
      started = false;
    };
  }, [state.user]);
  return { ...state, ...actions };
}
