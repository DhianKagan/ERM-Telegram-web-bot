/** @jest-environment jsdom */
// Назначение: проверяет корректную работу useIntervalEffect при смене видимости вкладки
// Основные модули: React, @testing-library/react, jest fake timers
import '@testing-library/jest-dom';
import React from 'react';
import { act, render } from '@testing-library/react';
import useIntervalEffect from './useIntervalEffect';

describe('useIntervalEffect', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('останавливает и возобновляет выполнение при смене document.hidden', () => {
    const callback = jest.fn();
    const listeners = new Set<() => void>();
    const visibilityDocument = {
      hidden: false,
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'visibilitychange') {
          listeners.add(handler);
        }
      }),
      removeEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'visibilitychange') {
          listeners.delete(handler);
        }
      }),
      dispatchVisibilityChange() {
        listeners.forEach((listener) => listener());
      },
    };

    const TestComponent = () => {
      useIntervalEffect(callback, 1000, {
        immediate: true,
        document: visibilityDocument as unknown as Document,
      });
      return null;
    };

    render(<TestComponent />);

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(2);

    act(() => {
      visibilityDocument.hidden = true;
      visibilityDocument.dispatchVisibilityChange();
      jest.advanceTimersByTime(5000);
    });
    expect(callback).toHaveBeenCalledTimes(2);

    act(() => {
      visibilityDocument.hidden = false;
      visibilityDocument.dispatchVisibilityChange();
    });
    expect(callback).toHaveBeenCalledTimes(3);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(4);
  });
});
