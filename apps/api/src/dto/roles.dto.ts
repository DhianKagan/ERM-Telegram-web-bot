// Назначение файла: DTO для ролей
// Основные модули: routes, middleware
import { body } from 'express-validator';

export class UpdateRoleDto {
  static rules() {
    return [
      body('permissions')
        .isArray()
        .custom((arr: unknown[]) =>
          arr.every(
            (item) => typeof item === 'string' || typeof item === 'number',
          ),
        ),
    ];
  }
}

export default { UpdateRoleDto };
