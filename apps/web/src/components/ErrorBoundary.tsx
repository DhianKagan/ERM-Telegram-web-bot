// Компонент границы ошибок для перехвата исключений и вывода запасного UI.
// Основные модули: React.
import React, { type ReactNode } from "react";

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    const msg =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    console.error("Ошибка приложения:", msg);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
