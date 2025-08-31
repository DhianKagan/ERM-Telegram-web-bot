/** @jest-environment jsdom */
// Назначение файла: проверяет наличие подсказки по перезагрузке в запасном UI ErrorBoundary.
// Основные модули: React, @testing-library/react, i18next.
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from '../apps/web/src/components/ErrorBoundary';
import i18n from '../apps/web/src/i18n';

describe('ErrorBoundary', () => {
  it.each(['ru', 'en'] as const)(
    'выводит подсказку перезагрузки (%s)',
    async (lng) => {
      await i18n.changeLanguage(lng);
      const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const Problem: React.FC = () => {
        throw new Error('boom');
      };
      render(
        <ErrorBoundary
          fallback={<div role="alert">{i18n.t('errorFallback')}</div>}
        >
          <React.StrictMode>
            <Problem />
          </React.StrictMode>
        </ErrorBoundary>,
      );
      expect(screen.getByRole('alert')).toHaveTextContent(
        lng === 'ru' ? 'Перезагрузите страницу' : 'Reload the page',
      );
      spy.mockRestore();
    },
  );
});
