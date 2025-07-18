// Сервис прямых вызовов Telegram Bot API. Модули: node.js fetch, config
const { botToken, botApiUrl } = require('../config');
const BASE = `${botApiUrl || 'https://api.telegram.org'}/bot${botToken}/`;

async function call(method, params = {}, attempt = 0) {
  try {
    const res = await fetch(BASE + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    return data.result;
  } catch (err) {
    if (attempt < 3) {
      const delay = 2 ** attempt * 500;
      await new Promise((r) => setTimeout(r, delay));
      return call(method, params, attempt + 1);
    }
    throw err;
  }
}

module.exports = { call };
