// Корневой компонент мини‑приложения ERM
import React, { Suspense, lazy, useEffect } from "react";
import { useTranslation, I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  BrowserRouter as Router,
  useLocation,
  useNavigate,
} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import AlertDialog from "./components/AlertDialog";
import { AuthProvider } from "./context/AuthProvider";
import { useAuth } from "./context/useAuth";
import { ToastProvider } from "./context/ToastProvider";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));
const CodeLogin = lazy(() => import("./pages/CodeLogin"));
const AttachmentMenu = lazy(() => import("./pages/AttachmentMenu"));
const ToastsLazy = lazy(() => import("./components/Toasts"));

function LoginLayout() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm space-y-4 rounded border bg-white p-6 shadow">
        <Suspense fallback={<div>{t("loading")}</div>}>
          <CodeLogin />
        </Suspense>
      </div>
    </main>
  );
}

function GlobalToasts() {
  return (
    <Suspense fallback={null}>
      <ToastsLazy />
    </Suspense>
  );
}

function AppContent({
  initialAlert,
  onCloseAlert,
}: {
  initialAlert: string | null;
  onCloseAlert: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, i18n } = useTranslation();
  const isLogin = location.pathname.startsWith("/login");
  const isAttachmentMenu = location.pathname.startsWith("/menu");
  useEffect(() => {
    if (loading || isAttachmentMenu) return;
    if (!user && !isLogin) {
      navigate("/login", { replace: true });
    } else if (user && isLogin) {
      navigate("/tasks", { replace: true });
    }
  }, [isAttachmentMenu, isLogin, loading, navigate, user]);
  React.useEffect(() => {
    const appTitle = t("appTitle", { defaultValue: "ERM WEB" });
    if (typeof document !== "undefined") {
      document.title = appTitle;
    }
  }, [t, i18n.language]);
  const alert = (
    <AlertDialog
      open={!!initialAlert}
      message={initialAlert || ""}
      onClose={onCloseAlert}
      closeText={i18n.t("close")}
    />
  );
  if (isAttachmentMenu) {
    return (
      <>
        <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
          <Suspense fallback={<div>{t("loading")}</div>}>
            <AttachmentMenu />
          </Suspense>
        </ErrorBoundary>
        {alert}
      </>
    );
  }
  if (loading) {
    return (
      <>
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
          <div>{t("loading")}</div>
        </main>
        {alert}
      </>
    );
  }
  if (!user) {
    return (
      <>
        <ErrorBoundary fallback={<div>Произошла ошибка</div>}>
          <LoginLayout />
        </ErrorBoundary>
        {alert}
      </>
    );
  }
  return (
    <Suspense fallback={<div>{t("loading")}</div>}>
      <AuthenticatedApp alert={alert} />
    </Suspense>
  );
}

export default function App() {
  const [initialAlert, setInitialAlert] = React.useState<string | null>(
    typeof window !== "undefined"
      ? (window as any).__ALERT_MESSAGE__ || null
      : null,
  );
  return (
    <I18nextProvider i18n={i18n}>
      <ToastProvider>
        <AuthProvider>
          <Router>
            <GlobalToasts />
            <AppContent
              initialAlert={initialAlert}
              onCloseAlert={() => setInitialAlert(null)}
            />
          </Router>
        </AuthProvider>
      </ToastProvider>
    </I18nextProvider>
  );
}
