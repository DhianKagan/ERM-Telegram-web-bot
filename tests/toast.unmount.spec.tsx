/** @jest-environment jsdom */
// Назначение файла: тест размонтирования ToastProvider.
// Основные модули: React, @testing-library/react.
const originalNodeEnv = process.env.NODE_ENV;
const originalIsActEnvironment = (
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => {
  process.env.NODE_ENV = 'development';
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  process.env.NODE_ENV = originalNodeEnv;
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = originalIsActEnvironment;
});
import React, { useEffect } from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../apps/web/src/context/ToastContext';
import { useToast } from '../apps/web/src/context/useToast';

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('очищает все таймеры при размонтировании', () => {
  jest.useFakeTimers();
  const spy = jest.spyOn(global, 'clearTimeout');

  const Test: React.FC = () => {
    const { addToast } = useToast();
    useEffect(() => {
      addToast('msg-1');
      addToast('msg-2');
    }, [addToast]);
    return null;
  };

  const div = document.createElement('div');
  const root = createRoot(div);
  act(() => {
    root.render(
      <ToastProvider>
        <Test />
      </ToastProvider>,
    );
  });

  act(() => {
    root.unmount();
  });

  expect(spy).toHaveBeenCalledTimes(2);
});
