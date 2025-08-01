// Назначение файла: middleware для проверки DTO
// Основные модули: express-validator
import { validationResult } from 'express-validator'

export default function validateDto(Dto) {
  return [
    ...Dto.rules(),
    (req, res, next) => {
      const errors = validationResult(req)
      if (errors.isEmpty()) return next()
      res.status(400).json({ errors: errors.array() })
    },
  ]
}
module.exports = validateDto
