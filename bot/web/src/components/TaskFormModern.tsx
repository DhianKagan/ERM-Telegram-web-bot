// Современная форма задачи, генерируемая по схеме
// Модули: React
import React, { useState } from "react";
import formSchema from "../../../src/form/taskForm.schema.json";
import type { Field } from "../../../src/form";

export type TaskFormModernProps = {
  defaultValues?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
};

const renderField = (
  field: Field,
  value: string,
  setValue: (v: string) => void,
) => {
  switch (field.type) {
    case "text":
      return (
        <input
          className="h-10 w-full rounded border px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={field.required}
        />
      );
    case "textarea":
      return (
        <textarea
          className="w-full rounded border px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="h-10 w-full rounded border px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={field.required}
        />
      );
    case "segment":
      return (
        <div className="flex gap-2">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1">
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={value === opt.value}
                onChange={() => setValue(opt.value)}
                required={field.required}
              />
              {opt.label}
            </label>
          ))}
        </div>
      );
    default:
      return null;
  }
};

const TaskFormModern: React.FC<TaskFormModernProps> = ({
  defaultValues = {},
  onSubmit,
  onCancel,
}) => {
  const [data, setData] = useState<Record<string, string>>(defaultValues);
  const setField = (name: string, v: string) =>
    setData((d) => ({ ...d, [name]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formSchema.sections.map((section) => (
        <div key={section.name} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.label}</h2>
          {section.fields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="block text-sm font-medium">{field.label}</label>
              {renderField(field, data[field.name] ?? "", (v) =>
                setField(field.name, v),
              )}
            </div>
          ))}
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded bg-slate-200 px-4 py-2"
        >
          Отмена
        </button>
        <button
          type="submit"
          className="rounded bg-indigo-600 px-4 py-2 text-white"
        >
          Сохранить
        </button>
      </div>
    </form>
  );
};

export default TaskFormModern;
