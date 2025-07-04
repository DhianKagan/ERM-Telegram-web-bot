// Очередь вызовов Telegram API. Ограничивает количество запросов.
const queue = []
let tokens = 30
let timer

function process() {
  while (tokens > 0 && queue.length) {
    tokens--
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve().then(fn).then(resolve).catch(reject)
  }
}

function start() {
  if (!timer) {
    timer = setInterval(() => {
      tokens = 30
      process()
    }, 1000)
  }
}
start()

function stopQueue() {
  if (timer) {
    clearInterval(timer)
    timer = undefined
  }
}

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    process()
  })
}

module.exports = { enqueue, queue, stopQueue }

