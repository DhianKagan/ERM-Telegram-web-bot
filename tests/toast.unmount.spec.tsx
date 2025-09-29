/** @jest-environment jsdom */
// Назначение файла: тест размонтирования ToastProvider.
// Основные модули: React, @testing-library/react.
const originalNodeEnv = process.env.NODE_ENV;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
});
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../apps/web/src/context/ToastContext';
import { useToast } from '../apps/web/src/context/useToast';

test.skip('очищает таймер при размонтировании', () => {
  jest.useFakeTimers();
  const spy = jest.spyOn(global, 'clearTimeout');

  const Test: React.FC = () => {
    const { addToast } = useToast();
    useEffect(() => {
      addToast('msg');
    }, [addToast]);
    return null;
  };

  const div = document.createElement('div');
  const root = createRoot(div);
  root.render(
    <ToastProvider>
      <Test />
    </ToastProvider>,
  );

  root.unmount();
  expect(spy).toHaveBeenCalled();
});
