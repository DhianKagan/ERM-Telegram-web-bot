// Назначение файла: установка cookie token
// Основные модули: config
module.exports = function setTokenCookie(res, token, config) {
  const secure = process.env.NODE_ENV === 'production'
  const cookieOpts = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
  if (secure) {
    cookieOpts.domain = config.cookieDomain || new URL(config.appUrl).hostname
  }
  res.cookie('token', token, cookieOpts)
  const preview = token.slice(0, 8)
  console.log(`Установлена cookie token:${preview} domain:${cookieOpts.domain || 'none'}`)
}
