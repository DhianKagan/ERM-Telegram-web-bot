// Очередь вызовов Telegram API с ограничением объёма
// Модули: Promise, setInterval

interface QueueItem<T> {
  fn: () => Promise<T> | T;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export const queue: QueueItem<unknown>[] = [];
export const MAX_QUEUE_SIZE = 100;
let tokens = 30;
let timer: NodeJS.Timeout | undefined;

function process(): void {
  while (tokens > 0 && queue.length) {
    tokens--;
    const { fn, resolve, reject } = queue.shift()!;
    Promise.resolve()
      .then(fn)
      .then(resolve)
      .catch((e) => {
        console.error('Ошибка очереди', e);
        reject(e);
      });
  }
}

function start(): void {
  if (!timer) {
    timer = setInterval(() => {
      tokens = 30;
      process();
    }, 1000);
  }
}
start();

export function stopQueue(): void {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

export function enqueue<T>(fn: () => Promise<T> | T): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.error('Превышен лимит очереди');
      reject(new Error('queue overflow'));
      return;
    }
    queue.push({
      fn: fn as () => Promise<unknown> | unknown,
      resolve: resolve as unknown as (value: unknown) => void,
      reject,
    });
    process();
  });
}
