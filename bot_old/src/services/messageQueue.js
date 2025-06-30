// Очередь вызовов Telegram API. Ограничивает количество запросов.
const queue = []
let tokens = 30

function process() {
  while (tokens > 0 && queue.length) {
    tokens--
    const { fn, resolve, reject } = queue.shift()
    Promise.resolve().then(fn).then(resolve).catch(reject)
  }
}

setInterval(() => {
  tokens = 30
  process()
}, 1000)

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    process()
  })
}

module.exports = { enqueue, queue }

