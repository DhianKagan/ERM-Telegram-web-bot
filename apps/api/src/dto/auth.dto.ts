// Назначение файла: DTO запросов авторизации
// Основные модули: routes, middleware
import { body } from 'express-validator';

export class SendCodeDto {
  static rules() {
    return [body('telegramId').isInt()];
  }
}

export class VerifyCodeDto {
  static rules() {
    return [body('telegramId').isInt(), body('code').isLength({ min: 4 })];
  }
}

export class VerifyInitDto {
  static rules() {
    return [body('initData').isString()];
  }
}

export class UpdateProfileDto {
  static rules() {
    return [
      body('name').optional().isString().notEmpty(),
      body('phone').optional().isMobilePhone('any'),
      body('mobNumber').optional().isMobilePhone('any'),
      body('email').optional().isEmail(),
    ];
  }
}

export default {
  SendCodeDto,
  VerifyCodeDto,
  VerifyInitDto,
  UpdateProfileDto,
};
