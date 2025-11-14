// Назначение: запускает колбэк по таймеру с учётом видимости вкладки
// Основные модули: React, document.visibilityState
import React from 'react';

interface UseIntervalEffectOptions {
  enabled?: boolean;
  immediate?: boolean;
  pauseOnHidden?: boolean;
  deps?: React.DependencyList;
  document?: Pick<
    Document,
    'hidden' | 'addEventListener' | 'removeEventListener'
  >;
}

const useIntervalEffect = (
  callback: () => void,
  delay: number | null | undefined,
  options: UseIntervalEffectOptions = {},
): void => {
  const {
    enabled = true,
    immediate = false,
    pauseOnHidden = true,
    deps = [],
    document: customDocument,
  } = options;
  const savedCallback = React.useRef(callback);

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const doc =
      customDocument ??
      (typeof document !== 'undefined' ? document : undefined);

    const isHidden = () => Boolean(pauseOnHidden && doc?.hidden);

    if (delay == null || !Number.isFinite(delay) || delay <= 0) {
      if (!isHidden() && immediate) {
        savedCallback.current();
      }
      return undefined;
    }

    let disposed = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const clear = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const run = () => {
      savedCallback.current();
    };

    const schedule = () => {
      if (disposed || isHidden()) {
        return;
      }
      clear();
      intervalId = setInterval(() => {
        if (!isHidden()) {
          run();
        }
      }, delay);
    };

    if (!isHidden() && immediate) {
      run();
    }

    schedule();

    let handleVisibility: (() => void) | null = null;
    if (doc && pauseOnHidden && typeof doc.addEventListener === 'function') {
      handleVisibility = () => {
        if (disposed) {
          return;
        }
        if (doc.hidden) {
          clear();
        } else {
          run();
          schedule();
        }
      };
      doc.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      disposed = true;
      clear();
      if (
        handleVisibility &&
        doc &&
        typeof doc.removeEventListener === 'function'
      ) {
        doc.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [customDocument, delay, enabled, immediate, pauseOnHidden, ...deps]);
};

export default useIntervalEffect;
