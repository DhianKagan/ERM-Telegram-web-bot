/**
 * Заглушка для react-intl.
 * Основные модули: React.
 * Возвращает строку по умолчанию без форматирования.
 */
import type { ReactNode } from "react";

export function IntlProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useIntl() {
  return {
    formatMessage: ({ defaultMessage }: { defaultMessage: string }) =>
      defaultMessage,
  };
}

export const FormattedMessage = ({
  defaultMessage,
}: {
  id?: string;
  defaultMessage: string;
}) => <>{defaultMessage}</>;
