// Современная форма задачи, генерируемая по схеме
// Модули: React, shared
import React, { useState, useEffect } from "react";
import { taskFormSchema as formSchema } from "shared";
import type { Field, FormSchema } from "../../../api/src/form";
import authFetch from "../utils/authFetch";
import { updateTaskStatus } from "../services/tasks";

type Template = { _id: string; name: string; data: Record<string, string> };
const formSchemaTyped = formSchema as FormSchema;
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
  inputId: string,
) => {
  switch (field.type) {
    case "text":
      return (
        <input
          id={inputId}
          name={field.name}
          className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={field.required}
        />
      );
    case "textarea":
      return (
        <textarea
          id={inputId}
          name={field.name}
          className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          id={inputId}
          name={field.name}
          className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 px-3"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required={field.required}
        />
      );
    case "segment":
      return (
        <div className="flex gap-2">
          {field.options?.map((opt) => {
            const optionId = `${inputId}-${String(opt.value)
              .toLowerCase()
              .replace(/[^a-z0-9а-яё]+/gi, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "")}`;
            return (
              <label
                key={opt.value}
                className="flex items-center gap-1"
                htmlFor={optionId}
              >
                <input
                  type="radio"
                  name={field.name}
                  id={optionId}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => setValue(opt.value)}
                  required={field.required}
                />
                {opt.label}
              </label>
            );
          })}
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
  const [statusLoading, setStatusLoading] = useState<"В работе" | "Выполнена" | null>(
    null,
  );
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
    onSubmit({ formVersion: formSchemaTyped.formVersion, ...data });
  };

  const taskId =
    data._id || data.id || defaultValues._id || defaultValues.id || "";

  const handleStatusClick = async (nextStatus: "В работе" | "Выполнена") => {
    if (!taskId) return;
    setStatusLoading(nextStatus);
    try {
      const response = await updateTaskStatus(taskId, nextStatus);
      if (!response.ok) throw new Error("STATUS_UPDATE_FAILED");
      setData((prev) => ({ ...prev, status: nextStatus }));
    } catch (error) {
      console.error("Не удалось обновить статус задачи", error);
    } finally {
      setStatusLoading(null);
    }
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
      {formSchemaTyped.sections.map((section) => (
        <div key={section.name} className="space-y-4">
          <h2 className="text-lg font-semibold">{section.label}</h2>
          {section.fields.map((field) => {
            const fieldId = `task-${field.name}`;
            return (
              <div key={field.name} className="space-y-1">
                <label className="block text-sm font-medium" htmlFor={fieldId}>
                  {field.label}
                </label>
                {renderField(field, data[field.name] ?? "", (v) =>
                  setField(field.name, v),
                  fieldId,
                )}
              </div>
            );
          })}
        </div>
      ))}
      {customFields.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Дополнительно</h2>
          {customFields.map((field) => {
            const fieldId = `task-${field.name}`;
            return (
              <div key={field.name} className="space-y-1">
                <label className="block text-sm font-medium" htmlFor={fieldId}>
                  {field.label}
                </label>
                {renderField(field, data[field.name] ?? "", (v) =>
                  setField(field.name, v),
                  fieldId,
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {taskId && (
          <>
            <button
              type="button"
              onClick={() => handleStatusClick("В работе")}
              disabled={statusLoading !== null}
              className="rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-60"
            >
              Начать задачу
            </button>
            <button
              type="button"
              onClick={() => handleStatusClick("Выполнена")}
              disabled={statusLoading !== null}
              className="rounded bg-lime-600 px-4 py-2 text-white disabled:opacity-60"
            >
              Задача выполнена
            </button>
          </>
        )}
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
