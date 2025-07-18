// Очередь вызовов Telegram API с ограничением объёма.
const queue = [];
const MAX_QUEUE_SIZE = 100;
let tokens = 30;
let timer;

function process() {
  while (tokens > 0 && queue.length) {
    tokens--;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve()
      .then(fn)
      .then(resolve)
      .catch((e) => {
        console.error('Ошибка очереди', e);
        reject(e);
      });
  }
}

function start() {
  if (!timer) {
    timer = setInterval(() => {
      tokens = 30;
      process();
    }, 1000);
  }
}
start();

function stopQueue() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    if (queue.length >= MAX_QUEUE_SIZE) {
      console.error('Превышен лимит очереди');
      reject(new Error('queue overflow'));
      return;
    }
    queue.push({ fn, resolve, reject });
    process();
  });
}

module.exports = { enqueue, queue, stopQueue, MAX_QUEUE_SIZE };
