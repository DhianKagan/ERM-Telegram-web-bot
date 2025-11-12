// Форма задачи с адаптивной сеткой, генерируемая по схеме
// Модули: React, shared
import React from 'react';
import { taskFormSchema as formSchema } from 'shared';
import type { Field, FormSchema } from '../../../api/src/form';
import { FormField } from './FormField';

const formSchemaTyped = formSchema as FormSchema;

type TaskFormProps = { customFields?: Field[] };

export function TaskForm({ customFields = [] }: TaskFormProps) {
  return (
    <form id="task-form" className="flex flex-col gap-6">
      <input
        type="hidden"
        name="formVersion"
        value={formSchemaTyped.formVersion}
      />
      {formSchemaTyped.sections.map((section) => (
        <div
          key={section.name}
          className="xsm:grid-cols-2 grid grid-cols-1 gap-4"
        >
          <h2 className="col-span-full text-lg font-semibold">
            {section.title}
          </h2>
          {section.fields.map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              className={field.type === 'textarea' ? 'md:col-span-2' : ''}
            >
              {renderField(field)}
            </FormField>
          ))}
        </div>
      ))}
      {customFields.length > 0 && (
        <div className="xsm:grid-cols-2 grid grid-cols-1 gap-4">
          {customFields.map((field) => (
            <FormField
              key={field.name}
              label={field.label}
              className={field.type === 'textarea' ? 'md:col-span-2' : ''}
            >
              {renderField(field)}
            </FormField>
          ))}
        </div>
      )}
    </form>
  );
}

const renderField = (field: Field) => {
  const fieldId = `task-form-${field.name}`;
  switch (field.type) {
    case 'text':
      return (
        <input
          id={fieldId}
          className="input"
          name={field.name}
          required={field.required}
        />
      );
    case 'datetime':
      return (
        <input
          type="datetime-local"
          className="input"
          id={fieldId}
          name={field.name}
          required={field.required}
        />
      );
    case 'segment':
      return (
        <select
          className="input select"
          id={fieldId}
          name={field.name}
          required={field.required}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'textarea':
      return (
        <textarea
          className="input min-h-[120px]"
          id={fieldId}
          name={field.name}
        />
      );
    default:
      return null;
  }
};

export default TaskForm;
