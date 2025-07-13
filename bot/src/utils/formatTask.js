// Форматирование задачи для вывода в Telegram
// Модули: Intl.DateTimeFormat
module.exports = function formatTask(task) {
  const parts = []
  if (task.request_id) parts.push(task.request_id)
  const title = task.title ? task.title.replace(/^ERM_\d+\s*/, '') : ''
  if (title) parts.push(title)
  if (task.due_date) {
    const d = new Date(task.due_date)
    parts.push('до ' + new Intl.DateTimeFormat('ru-RU').format(d))
  }
  if (task.priority) parts.push('приоритет: ' + task.priority)
  if (task.status) parts.push('статус: ' + task.status)
  return parts.join(' | ')
}
