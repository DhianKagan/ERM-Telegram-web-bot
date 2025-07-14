// Форматирование задачи в виде компактного блока MarkdownV2
// Модули: Intl.DateTimeFormat

function mdEscape(str) {
  // eslint-disable-next-line no-useless-escape
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

module.exports = function formatTask(task) {
  const lines = []
  const idTitle = [task.request_id,
    task.title ? task.title.replace(/^ERM_\d+\s*/, '') : '']
    .filter(Boolean)
    .join(' ')
  if (idTitle) lines.push(`📌 *Задача:* _${mdEscape(idTitle)}_`)

  if (task.due_date) {
    const d = new Date(task.due_date)
    lines.push(`⏰ *Срок:* \`${mdEscape(new Intl.DateTimeFormat('ru-RU').format(d))}\``)
  }

  const start = task.start_location ? mdEscape(task.start_location) : ''
  const end = task.end_location ? mdEscape(task.end_location) : ''
  const startLink = task.start_location_link
    ? `[${start}](${mdEscape(task.start_location_link)})`
    : start
  const endLink = task.end_location_link
    ? `[${end}](${mdEscape(task.end_location_link)})`
    : end
  if (start || end) lines.push(`📍 ${startLink}${start && end ? ' → ' : ''}${endLink}`)

  const extra = []
  if (task.transport_type) extra.push(`🚗 ${mdEscape(task.transport_type)}`)
  if (task.payment_method) extra.push(`💰 ${mdEscape(task.payment_method)}`)
  if (extra.length) lines.push(extra.join(' • '))

  const ps = []
  if (task.priority) ps.push(`*Приоритет:* _${mdEscape(task.priority)}_`)
  if (task.status) ps.push(`🛠 *Статус:* _${mdEscape(task.status)}_`)
  if (ps.length) lines.push(`🔁 ${ps.join(' • ')}`)

  if (task.route_distance_km) {
    lines.push(`🗺 *Расстояние:* ${mdEscape(String(task.route_distance_km))} км`)
  }

  return lines.join('\n')
}
