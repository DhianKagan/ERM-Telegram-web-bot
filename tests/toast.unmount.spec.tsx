/** @jest-environment jsdom */
// Назначение файла: тест размонтирования ToastProvider.
// Основные модули: React, @testing-library/react.
process.env.NODE_ENV = 'development';
import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../apps/web/src/context/ToastContext';
import { useToast } from '../apps/web/src/context/useToast';

test('очищает таймер при размонтировании', () => {
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
