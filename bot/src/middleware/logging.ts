// Назначение: логирование HTTP запросов и ответов
// Основные модули: wgLogEngine
const { writeLog } = require('../services/service');

function logging(req, res, next) {
  const { method, originalUrl, headers, cookies } = req;
  const tokenVal =
    cookies && cookies.token ? String(cookies.token).slice(0, 8) : 'no-token';
  const csrfVal = headers['x-xsrf-token']
    ? String(headers['x-xsrf-token']).slice(0, 8)
    : 'no-csrf';
  writeLog(
    `Запрос ${method} ${originalUrl} token:${tokenVal} csrf:${csrfVal}`,
  ).catch(() => {});
  res.on('finish', () => {
    writeLog(`Ответ ${method} ${originalUrl} ${res.statusCode}`).catch(
      () => {},
    );
  });
  next();
}

module.exports = logging;
