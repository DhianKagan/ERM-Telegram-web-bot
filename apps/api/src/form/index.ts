// Модуль форм. Назначение: загрузка схемы формы и серверная валидация.
// Модули: express-validator, shared
import { body, ValidationChain } from 'express-validator';
import { taskFormSchema } from 'shared';

export type FieldOption = { value: string; label: string };
export type Field = {
  name: string;
  type: 'text' | 'datetime' | 'segment' | 'textarea';
  label: string;
  required?: boolean;
  options?: FieldOption[];
};
export type Section = { name: string; label: string; fields: Field[] };
export type FormSchema = { formVersion: number; sections: Section[] };

export const formSchema: FormSchema = taskFormSchema as FormSchema;

export const buildValidators = (schema: FormSchema): ValidationChain[] => {
  const chains: ValidationChain[] = [
    body('formVersion')
      .equals(String(schema.formVersion))
      .withMessage('Неизвестная версия формы'),
  ];
  for (const section of schema.sections) {
    for (const field of section.fields) {
      let chain = body(field.name);
      if (field.required) chain = chain.notEmpty();
      else chain = chain.optional();
      switch (field.type) {
        case 'datetime':
          chain = chain.isISO8601().withMessage('Неверная дата');
          break;
        case 'segment':
        case 'text':
        case 'textarea':
        default:
          chain = chain.isString();
      }
      chains.push(chain);
    }
  }
  return chains;
};

export const taskFormValidators = buildValidators(formSchema);
