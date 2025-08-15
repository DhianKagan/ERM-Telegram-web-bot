// Модуль форм. Назначение: загрузка схемы формы и серверная валидация.
// Модули: fs, express-validator
import { body, ValidationChain } from 'express-validator';
import schemaJson from './taskForm.schema.json';

export type FieldOption = { value: string; label: string };
export type Field = {
  name: string;
  type: 'text' | 'datetime' | 'segment' | 'textarea';
  label: string;
  required?: boolean;
  options?: FieldOption[];
};
export type Section = { name: string; label: string; fields: Field[] };
export type FormSchema = { sections: Section[] };

export const formSchema: FormSchema = schemaJson as FormSchema;

export const buildValidators = (schema: FormSchema): ValidationChain[] => {
  const chains: ValidationChain[] = [];
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
