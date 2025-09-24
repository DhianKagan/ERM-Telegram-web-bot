// Современная форма задачи, генерируемая по схеме
// Модули: React, shared
import React, { useState, useEffect } from "react";
import { taskFormSchema as formSchema } from "shared";
import type { Field } from "../../../api/src/form";
import authFetch from "../utils/authFetch";

type Template = { _id: string; name: string; data: Record<string, string> };
export type TaskFormModernProps = {
  defaultValues?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => void;
  onCancel: () => void;
  customFields?: Field[];
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
          className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={field.required}
        />
      );
    case "textarea":
      return (
        <textarea
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3"
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
  customFields = [],
}) => {
  const [data, setData] = useState<Record<string, string>>(defaultValues);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const setField = (name: string, v: string) =>
    setData((d) => ({ ...d, [name]: v }));
  useEffect(() => {
    const make = (h: number) => {
      const d = new Date();
      d.setHours(h, 0, 0, 0);
      return d.toISOString().slice(0, 16);
    };
    setData((d) => ({
      ...d,
      startDate: d.startDate || make(8),
      dueDate: d.dueDate || make(18),
    }));
  }, []);
  useEffect(() => {
    authFetch("/api/v1/task-templates")
      .then((r) => r.json())
      .then((t: Template[]) => setTemplates(t))
      .catch(() => setTemplates([]));
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tplId = params.get("template");
    if (tplId) {
      const tpl = templates.find((t) => t._id === tplId);
      if (tpl) {
        setSelectedTemplate(tplId);
        setData({ ...defaultValues, ...tpl.data });
      }
    }
  }, [templates, defaultValues]);
  const handleTemplateChange = (id: string) => {
    setSelectedTemplate(id);
    const tpl = templates.find((t) => t._id === id);
    setData(tpl ? { ...defaultValues, ...tpl.data } : defaultValues);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ formVersion: (formSchema as any).formVersion, ...data });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {templates.length > 0 && (
        <div className="space-y-1">
          <label className="block text-sm font-medium">Шаблон</label>
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3"
            value={selectedTemplate}
            onChange={(e) => handleTemplateChange(e.target.value)}
          >
            <option value="">Без шаблона</option>
            {templates.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
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
      {customFields.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Дополнительно</h2>
          {customFields.map((field) => (
            <div key={field.name} className="space-y-1">
              <label className="block text-sm font-medium">{field.label}</label>
              {renderField(field, data[field.name] ?? "", (v) =>
                setField(field.name, v),
              )}
            </div>
          ))}
        </div>
      )}
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
