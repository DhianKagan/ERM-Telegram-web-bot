// Валидация запросов через express-validator
// Модули: express-validator
const { validationResult } = require('express-validator')

function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req)
      if (errors.isEmpty()) return next()
      res.status(400).json({ errors: errors.array() })
    }
  ]
}

module.exports = validate
