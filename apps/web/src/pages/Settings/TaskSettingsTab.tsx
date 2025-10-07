// Назначение: вкладка настроек задач в панели администратора
// Основные модули: React, сервис taskSettings, ui/button, ui/input
import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Spinner from "../../components/Spinner";
import type {
  TaskFieldDisplaySetting,
  TaskTypeSetting,
  TaskSettingsResponse,
} from "shared";
import {
  fetchTaskSettings,
  updateTaskFieldLabel,
  updateTaskTypeSettings,
} from "../../services/taskSettings";

type FieldDrafts = Record<string, string>;
type TypeDraft = { label: string; tg_theme_url: string };
type TypeDrafts = Record<string, TypeDraft>;

const containerClass =
  "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900";

const sectionTitleClass =
  "text-lg font-semibold text-slate-900 dark:text-slate-50";

const descriptionClass = "mt-1 text-sm text-slate-600 dark:text-slate-300";

const labelClass = "text-sm font-medium text-slate-700 dark:text-slate-200";

const helperClass = "text-xs text-slate-500 dark:text-slate-400";

const inputClass = "h-10 w-full rounded border px-3 text-sm";

const actionRowClass = "flex flex-wrap items-center gap-2";

const errorBoxClass =
  "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200";

export default function TaskSettingsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<TaskFieldDisplaySetting[]>([]);
  const [types, setTypes] = useState<TaskTypeSetting[]>([]);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDrafts>({});
  const [typeDrafts, setTypeDrafts] = useState<TypeDrafts>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data: TaskSettingsResponse = await fetchTaskSettings();
        if (!mounted) return;
        setFields(data.fields);
        setTypes(data.types);
        const nextFieldDrafts: FieldDrafts = {};
        data.fields.forEach((field) => {
          nextFieldDrafts[field.name] = field.label;
        });
        const nextTypeDrafts: TypeDrafts = {};
        data.types.forEach((type) => {
          nextTypeDrafts[type.name] = {
            label: type.label,
            tg_theme_url: type.tg_theme_url ?? "",
          };
        });
        setFieldDrafts(nextFieldDrafts);
        setTypeDrafts(nextTypeDrafts);
        setError("");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Не удалось загрузить данные";
        setError(message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const sortedFields = useMemo(
    () =>
      [...fields].sort((a, b) => a.name.localeCompare(b.name, "ru", { sensitivity: "base" })),
    [fields],
  );

  const handleFieldDraftChange = (name: string, value: string) => {
    setFieldDrafts((prev) => ({ ...prev, [name]: value }));
  };

  const handleTypeDraftChange = (
    name: string,
    key: keyof TypeDraft,
    value: string,
  ) => {
    setTypeDrafts((prev) => ({
      ...prev,
      [name]: {
        ...(prev[name] ?? { label: "", tg_theme_url: "" }),
        [key]: value,
      },
    }));
  };

  const saveField = async (field: TaskFieldDisplaySetting) => {
    const draft = fieldDrafts[field.name]?.trim();
    if (!draft) {
      setError("Название поля не может быть пустым");
      return;
    }
    setSavingField(field.name);
    try {
      const updated = await updateTaskFieldLabel(field.name, draft);
      setFields((prev) =>
        prev.map((item) => (item.name === updated.name ? updated : item)),
      );
      setFieldDrafts((prev) => ({ ...prev, [field.name]: updated.label }));
      setError("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить поле";
      setError(message);
    } finally {
      setSavingField(null);
    }
  };

  const resetFieldToDefault = (field: TaskFieldDisplaySetting) => {
    handleFieldDraftChange(field.name, field.defaultLabel);
  };

  const saveType = async (type: TaskTypeSetting) => {
    const draft = typeDrafts[type.name] ?? { label: type.label, tg_theme_url: type.tg_theme_url ?? "" };
    const label = draft.label.trim();
    const tgThemeUrl = draft.tg_theme_url.trim();
    if (!label) {
      setError("Название типа задачи не может быть пустым");
      return;
    }
    setSavingType(type.name);
    try {
      const updated = await updateTaskTypeSettings(type.name, {
        label,
        tg_theme_url: tgThemeUrl ? tgThemeUrl : null,
      });
      setTypes((prev) =>
        prev.map((item) => (item.name === updated.name ? updated : item)),
      );
      setTypeDrafts((prev) => ({
        ...prev,
        [type.name]: {
          label: updated.label,
          tg_theme_url: updated.tg_theme_url ?? "",
        },
      }));
      setError("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось сохранить тип задачи";
      setError(message);
    } finally {
      setSavingType(null);
    }
  };

  const resetTypeLabel = (type: TaskTypeSetting) => {
    setTypeDrafts((prev) => ({
      ...prev,
      [type.name]: {
        label: type.defaultLabel,
        tg_theme_url: prev[type.name]?.tg_theme_url ?? type.tg_theme_url ?? "",
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <div className={errorBoxClass}>{error}</div> : null}
      <section className={containerClass}>
        <header className="space-y-1">
          <h2 className={sectionTitleClass}>Поля задачи</h2>
          <p className={descriptionClass}>
            Здесь можно задать отображаемые названия свойств задачи для интерфейса проекта.
          </p>
        </header>
        <div className="mt-4 space-y-4">
          {sortedFields.map((field) => (
            <article
              key={field.name}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Свойство {field.name}</span>
                    <Input
                      value={fieldDrafts[field.name] ?? field.label}
                      onChange={(event) =>
                        handleFieldDraftChange(field.name, event.target.value)
                      }
                      className={inputClass}
                      placeholder="Подпись"
                    />
                    <span className={helperClass}>
                      По умолчанию: {field.defaultLabel}
                    </span>
                  </div>
                </div>
                <div className={actionRowClass}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resetFieldToDefault(field)}
                    className="h-9"
                  >
                    По умолчанию
                  </Button>
                  <Button
                    type="button"
                    onClick={() => saveField(field)}
                    disabled={savingField === field.name}
                    className="h-9"
                  >
                    {savingField === field.name ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {sortedFields.length === 0 ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Поля задачи не обнаружены.
            </p>
          ) : null}
        </div>
      </section>
      <section className={containerClass}>
        <header className="space-y-1">
          <h2 className={sectionTitleClass}>Типы задач</h2>
          <p className={descriptionClass}>
            Для каждого типа задачи укажите отображаемое имя и ссылку на тему в Telegram, куда будут публиковаться сообщения.
            Пример ссылки: <code className="rounded bg-slate-100 px-1 py-0.5 dark:bg-slate-800">https://t.me/c/2705661520/627</code>.
          </p>
        </header>
        <div className="mt-4 space-y-4">
          {types.map((type) => {
            const draft = typeDrafts[type.name] ?? {
              label: type.label,
              tg_theme_url: type.tg_theme_url ?? "",
            };
            return (
              <article
                key={type.name}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Тип {type.name}</span>
                    <Input
                      value={draft.label}
                      onChange={(event) =>
                        handleTypeDraftChange(type.name, "label", event.target.value)
                      }
                      className={inputClass}
                      placeholder="Название"
                    />
                    <span className={helperClass}>
                      По умолчанию: {type.defaultLabel}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={labelClass}>Ссылка на тему Telegram</span>
                    <Input
                      value={draft.tg_theme_url}
                      onChange={(event) =>
                        handleTypeDraftChange(type.name, "tg_theme_url", event.target.value)
                      }
                      className={inputClass}
                      placeholder="https://t.me/c/..."
                    />
                    <span className={helperClass}>
                      Укажите ссылку на сообщение внутри нужной темы. Ссылка может быть пустой, чтобы отключить привязку.
                    </span>
                  </div>
                  <div className={actionRowClass}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => resetTypeLabel(type)}
                      className="h-9"
                    >
                      По умолчанию
                    </Button>
                    <Button
                      type="button"
                      onClick={() => saveType(type)}
                      disabled={savingType === type.name}
                      className="h-9"
                    >
                      {savingType === type.name ? "Сохранение..." : "Сохранить"}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

