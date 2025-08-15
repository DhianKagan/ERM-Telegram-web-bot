// Форма задачи с адаптивной сеткой, генерируемая по схеме
// Модули: React
import React from "react";
import formSchema from "../../../src/form/taskForm.schema.json";
import type { Field } from "../../../src/form";

type TaskFormProps = { customFields?: Field[] };

export function TaskForm({ customFields = [] }: TaskFormProps) {
  return (
    <form id="task-form" className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {formSchema.sections.map((section) =>
        section.fields.map((field) => (
          <FormField key={field.name} label={field.label}>
            {renderField(field)}
          </FormField>
        )),
      )}
      {customFields.map((field) => (
        <FormField key={field.name} label={field.label}>
          {renderField(field)}
        </FormField>
      ))}
    </form>
  );
}

const renderField = (field: Field) => {
  switch (field.type) {
    case "text":
      return <input className="input" name={field.name} required={field.required} />;
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="input"
          name={field.name}
          required={field.required}
        />
      );
    case "segment":
      return (
        <select
          className="input select"
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
    case "textarea":
      return <textarea className="input min-h-[120px]" name={field.name} />;
    default:
      return null;
  }
};

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
};

function FormField({ label, children, hint, className = "" }: FieldProps) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

export default TaskForm;
