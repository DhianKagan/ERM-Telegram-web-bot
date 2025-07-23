// Назначение: движок WG Log Engine для централизованного логирования
// Модули: mongoose, модель Log
const { Log } = require('../db/model');

async function writeLog(message, level = 'info') {
  return Log.create({ message, level });
}

async function listLogs() {
  return Log.find().sort({ createdAt: -1 }).limit(100);
}

module.exports = { writeLog, listLogs };
