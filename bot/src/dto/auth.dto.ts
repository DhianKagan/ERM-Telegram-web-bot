// Назначение файла: DTO запросов авторизации
// Основные модули: routes, middleware
const { body } = require('express-validator')

class SendCodeDto {
  static rules() {
    return [body('telegramId').isInt()]
  }
}

class VerifyCodeDto {
  static rules() {
    return [body('telegramId').isInt(), body('code').isLength({ min: 4 })]
  }
}

class VerifyInitDto {
  static rules() {
    return [body('initData').isString()]
  }
}

class UpdateProfileDto {
  static rules() {
    return [
      body('name').optional().isString().notEmpty(),
      body('phone').optional().isMobilePhone('any'),
      body('mobNumber').optional().isMobilePhone('any'),
    ]
  }
}

module.exports = {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
}
