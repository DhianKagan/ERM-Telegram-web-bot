// Валидация запросов через express-validator
// Модули: express-validator
const { validationResult } = require('express-validator')

function handleValidation(req, res, next) {
  const errors = validationResult(req)
  if (errors.isEmpty()) return next()
  res.status(400).json({ errors: errors.array() })
}

function validate(rules) {
  return [...rules, handleValidation]
}

module.exports = validate
module.exports.handleValidation = handleValidation
