// Назначение файла: вкладка настроек задач в разделе Settings.
// Основные модули: React, компоненты Button и Input, сервисные типы taskSettings.
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  TaskFieldSettingDto,
  TaskTypeSettingDto,
} from "../../services/taskSettings";

interface TaskSettingsTabProps {
  loading: boolean;
  fields: TaskFieldSettingDto[];
  types: TaskTypeSettingDto[];
  onFieldSubmit: (name: string, label: string) => Promise<void>;
  onTypeSubmit: (taskType: string, url: string | null) => Promise<void>;
}

type FieldDrafts = Record<string, string>;
type TypeDrafts = Record<string, string>;

export default function TaskSettingsTab({
  loading,
  fields,
  types,
  onFieldSubmit,
  onTypeSubmit,
}: TaskSettingsTabProps) {
  const [fieldDrafts, setFieldDrafts] = React.useState<FieldDrafts>({});
  const [typeDrafts, setTypeDrafts] = React.useState<TypeDrafts>({});
  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [savingType, setSavingType] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string>("");

  React.useEffect(() => {
    const nextFieldDrafts: FieldDrafts = {};
    fields.forEach((field) => {
      nextFieldDrafts[field.name] = field.label;
    });
    setFieldDrafts(nextFieldDrafts);
    const nextTypeDrafts: TypeDrafts = {};
    types.forEach((type) => {
      nextTypeDrafts[type.taskType] = type.tg_theme_url ?? "";
    });
    setTypeDrafts(nextTypeDrafts);
  }, [fields, types]);

  const handleFieldSubmit = async (
    event: React.FormEvent,
    name: string,
  ) => {
    event.preventDefault();
    const value = fieldDrafts[name] ?? "";
    setSavingField(name);
    setError("");
    try {
      await onFieldSubmit(name, value);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSavingField(null);
    }
  };

  const handleTypeSubmit = async (
    event: React.FormEvent,
    taskType: string,
  ) => {
    event.preventDefault();
    const value = typeDrafts[taskType]?.trim() ?? "";
    setSavingType(taskType);
    setError("");
    try {
      await onTypeSubmit(taskType, value.length ? value : null);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setSavingType(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="space-y-2">
          <h3 className="text-lg font-semibold">Названия полей задач</h3>
          <p className="text-sm text-slate-600">
            Измените отображаемые подписи стандартных полей формы задачи. Значения
            используются в веб-приложении и в отчётах.
          </p>
        </header>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Данные загружаются…</p>
        ) : (
          <div className="mt-4 space-y-4">
            {fields.map((field) => (
              <form
                key={field.name}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between"
                onSubmit={(event) => handleFieldSubmit(event, field.name)}
              >
                <label className="flex-1">
                  <span className="text-sm font-medium text-slate-700">
                    {field.defaultLabel}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    Системное имя: <code>{field.name}</code>
                  </span>
                  <Input
                    value={fieldDrafts[field.name] ?? ""}
                    onChange={(event) =>
                      setFieldDrafts((prev) => ({
                        ...prev,
                        [field.name]: event.target.value,
                      }))
                    }
                    className="mt-2"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Значение по умолчанию: {field.defaultLabel}
                  </span>
                </label>
                <Button
                  type="submit"
                  className="sm:ml-4 sm:w-36"
                  disabled={savingField === field.name}
                >
                  {savingField === field.name ? "Сохраняем…" : "Сохранить"}
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="space-y-2">
          <h3 className="text-lg font-semibold">Темы Telegram по типу задачи</h3>
          <p className="text-sm text-slate-600">
            Укажите ссылку на тему чата, куда будут отправляться уведомления о
            задачах соответствующего типа. Оставьте поле пустым, чтобы использовать
            общий канал без тем.
          </p>
        </header>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Данные загружаются…</p>
        ) : (
          <div className="mt-4 space-y-4">
            {types.map((item) => (
              <form
                key={item.taskType}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-end sm:justify-between"
                onSubmit={(event) => handleTypeSubmit(event, item.taskType)}
              >
                <label className="flex-1">
                  <span className="text-sm font-medium text-slate-700">
                    {item.taskType}
                  </span>
                  <Input
                    value={typeDrafts[item.taskType] ?? ""}
                    onChange={(event) =>
                      setTypeDrafts((prev) => ({
                        ...prev,
                        [item.taskType]: event.target.value,
                      }))
                    }
                    placeholder="https://t.me/c/..."
                    className="mt-2"
                  />
                  {item.topicId ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      Текущий идентификатор темы: {item.topicId}
                    </span>
                  ) : null}
                </label>
                <Button
                  type="submit"
                  className="sm:ml-4 sm:w-36"
                  disabled={savingType === item.taskType}
                >
                  {savingType === item.taskType ? "Сохраняем…" : "Сохранить"}
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
