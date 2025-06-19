import addFormatsPlugin from 'ajv-formats';
import { AjvValidator, Model } from 'objection';

const addFormats = addFormatsPlugin.default;

/**
 * Класс добавляет поддержку форматов даты в JSONSchema и обновляет метки
 * времени перед сохранением моделей. Это необходимо для корректной работы
 * AdminJS с Objection.js.
 */
export abstract class BaseModel extends Model {
  createdAt: string;

  updatedAt: string;

  static createValidator(): AjvValidator {
    return new AjvValidator({
      onCreateAjv: (ajv) => {
        addFormats(ajv);
      },
      options: {
        allErrors: true,
        validateSchema: false,
        ownProperties: true,
      },
    });
  }

  $beforeInsert(): void {
    this.createdAt = new Date().toISOString();
  }

  $beforeUpdate(): void {
    this.updatedAt = new Date().toISOString();
  }
}
