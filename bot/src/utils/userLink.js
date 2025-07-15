// Формирует ссылку tg://user для MarkdownV2
// Модули: отсутствуют
function mdEscape(str) {
  // eslint-disable-next-line no-useless-escape
  return String(str).replace(/[\\_*\[\]()~`>#+\-=|{}.!]/g, '\\$&')
}

module.exports = function userLink(id, name) {
  const text = name || String(id)
  return `[${mdEscape(text)}](tg://user?id=${id})`
}
