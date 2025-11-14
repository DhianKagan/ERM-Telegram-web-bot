// Компонент границы ошибок для перехвата исключений и вывода запасного UI.
// Основные модули: React.
import React, { type ReactNode, useState } from 'react';

interface Props {
  fallback: ReactNode;
  children: ReactNode;
}

class InnerBoundary extends React.Component<{
  onError: (error: unknown, info: React.ErrorInfo) => void;
  children: ReactNode;
}> {
  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    this.props.onError(error, info);
  }

  override render() {
    return this.props.children;
  }
}

export default function ErrorBoundary({ fallback, children }: Props) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <>{fallback}</>;
  }

  return (
    <InnerBoundary
      onError={(error, info) => {
        const msg =
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error);
        console.error('Ошибка приложения:', msg, info);
        setHasError(true);
      }}
    >
      {children}
    </InnerBoundary>
  );
}
