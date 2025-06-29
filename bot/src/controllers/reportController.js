// Контроллер отчётов KPI. Функция summary агрегирует данные задач
// с учётом параметров фильтрации по дате.
const q = require('../db/queries')

exports.summary = async (req, res) => {
  const { from, to } = req.query
  const result = await q.summary({ from, to })
  res.json(result)
}
