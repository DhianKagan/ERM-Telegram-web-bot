// Назначение файла: вкладка настроек задач в разделе настроек.
// Основные модули: React, Spinner, Button, Input.

import React from "react";

import Spinner from "../../components/Spinner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { CollectionItem } from "../../services/collections";

type TaskFieldItem = CollectionItem & {
  meta?: CollectionItem["meta"] & {
    defaultLabel?: string;
    fieldType?: string;
    required?: boolean;
    order?: number;
    virtual?: boolean;
  };
};

type TaskTypeItem = CollectionItem & {
  meta?: CollectionItem["meta"] & {
    defaultLabel?: string;
    order?: number;
    virtual?: boolean;
    tg_theme_url?: string;
    tg_chat_id?: string;
    tg_topic_id?: number;
    tg_photos_url?: string;
    tg_photos_chat_id?: string;
    tg_photos_topic_id?: number;
  };
};

interface TaskSettingsTabProps {
  fields: TaskFieldItem[];
  types: TaskTypeItem[];
  loading: boolean;
  onSaveField: (item: TaskFieldItem, label: string) => Promise<void>;
  onResetField: (item: TaskFieldItem) => Promise<void>;
  onSaveType: (
    item: TaskTypeItem,
    payload: { label: string; tg_theme_url: string; tg_photos_url: string },
  ) => Promise<void>;
  onResetType: (item: TaskTypeItem) => Promise<void>;
}

const CARD_CLASS =
  "rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900";

const SECTION_GAP = "space-y-4";

const FieldCard: React.FC<{
  item: TaskFieldItem;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  onReset: () => Promise<void>;
  saving: boolean;
  error?: string;
}> = ({ item, value, onChange, onSave, onReset, saving, error }) => {
  const [localError, setLocalError] = React.useState<string | undefined>(
    error,
  );

  React.useEffect(() => {
    setLocalError(error);
  }, [error]);

  const defaultLabel = item.meta?.defaultLabel ?? item.name;
  const storedLabel = item.value?.trim() || defaultLabel;
  const trimmedValue = value.trim();
  const dirty = trimmedValue !== storedLabel;

  const handleSave = async () => {
    setLocalError(undefined);
    try {
      await onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  };

  const handleReset = async () => {
    setLocalError(undefined);
    try {
      await onReset();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  };

  return (
    <article className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {defaultLabel}
              {item.meta?.required ? " *" : ""}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Поле: <span className="font-mono">{item.name}</span>
              {item.meta?.fieldType ? ` • Тип: ${item.meta.fieldType}` : ""}
            </p>
          </div>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Отображаемое название
          </span>
          <Input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={defaultLabel}
            aria-label={`Название поля ${defaultLabel}`}
          />
        </label>
        {localError ? (
          <p className="text-sm text-rose-600" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !dirty || !trimmedValue}
          >
            {saving ? <Spinner /> : "Сохранить"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={saving || Boolean(item.meta?.virtual)}
          >
            Сбросить
          </Button>
        </div>
      </div>
    </article>
  );
};

const TypeCard: React.FC<{
  item: TaskTypeItem;
  label: string;
  url: string;
  photosUrl: string;
  onChangeLabel: (value: string) => void;
  onChangeUrl: (value: string) => void;
  onChangePhotosUrl: (value: string) => void;
  onSave: () => Promise<void>;
  onReset: () => Promise<void>;
  saving: boolean;
  error?: string;
}> = ({
  item,
  label,
  url,
  photosUrl,
  onChangeLabel,
  onChangeUrl,
  onChangePhotosUrl,
  onSave,
  onReset,
  saving,
  error,
}) => {
  const [localError, setLocalError] = React.useState<string | undefined>(
    error,
  );

  React.useEffect(() => {
    setLocalError(error);
  }, [error]);

  const defaultLabel = item.meta?.defaultLabel ?? item.name;
  const storedLabel = item.value?.trim() || defaultLabel;
  const storedUrl = typeof item.meta?.tg_theme_url === "string"
    ? item.meta.tg_theme_url
    : "";
  const storedPhotosUrl =
    typeof item.meta?.tg_photos_url === "string"
      ? item.meta.tg_photos_url
      : "";
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  const trimmedPhotosUrl = photosUrl.trim();
  const dirty =
    trimmedLabel !== storedLabel ||
    trimmedUrl !== (storedUrl || "") ||
    trimmedPhotosUrl !== (storedPhotosUrl || "");

  const handleSave = async () => {
    setLocalError(undefined);
    try {
      await onSave();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  };

  const handleReset = async () => {
    setLocalError(undefined);
    try {
      await onReset();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLocalError(message);
    }
  };

  return (
    <article className={CARD_CLASS}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {defaultLabel}
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Тип задачи: <span className="font-mono">{item.name}</span>
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Отображаемое название
            </span>
            <Input
              value={label}
              onChange={(event) => onChangeLabel(event.target.value)}
              placeholder={defaultLabel}
              aria-label={`Название типа ${defaultLabel}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Ссылка на тему Telegram
            </span>
            <Input
              value={url}
              onChange={(event) => onChangeUrl(event.target.value)}
              placeholder="https://t.me/c/..."
              aria-label={`Ссылка темы для типа ${defaultLabel}`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Тема для фото
            </span>
            <Input
              value={photosUrl}
              onChange={(event) => onChangePhotosUrl(event.target.value)}
              placeholder="https://t.me/c/..."
              aria-label={`Ссылка темы для фото ${defaultLabel}`}
            />
          </label>
        </div>
        {item.meta?.tg_chat_id ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Чат: {item.meta.tg_chat_id}
          </p>
        ) : null}
        {item.meta?.tg_topic_id ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Тема: {item.meta.tg_topic_id}
          </p>
        ) : null}
        {item.meta?.tg_photos_chat_id ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Чат фото: {item.meta.tg_photos_chat_id}
          </p>
        ) : null}
        {item.meta?.tg_photos_topic_id ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Тема фото: {item.meta.tg_photos_topic_id}
          </p>
        ) : null}
        {localError ? (
          <p className="text-sm text-rose-600" role="alert">
            {localError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !trimmedLabel || !dirty}
          >
            {saving ? <Spinner /> : "Сохранить"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReset}
            disabled={saving || Boolean(item.meta?.virtual)}
          >
            Сбросить
          </Button>
        </div>
      </div>
    </article>
  );
};

const sortByOrder = <T extends { meta?: { order?: number } }>(items: T[]): T[] =>
  [...items].sort((a, b) => {
    const left = typeof a.meta?.order === "number" ? a.meta.order : 0;
    const right = typeof b.meta?.order === "number" ? b.meta.order : 0;
    return left - right;
  });

const useDraftMap = <TItem extends CollectionItem, TDraft>(
  items: TItem[],
  selector: (item: TItem) => TDraft,
) => {
  const [draft, setDraft] = React.useState<Record<string, TDraft>>({});

  React.useEffect(() => {
    setDraft((prev) => {
      let changed = false;
      const next: Record<string, TDraft> = { ...prev };
      const itemNames = new Set(items.map((item) => item.name));

      items.forEach((item) => {
        const key = item.name;
        if (!(key in prev)) {
          next[key] = selector(item);
          changed = true;
        }
      });

      Object.keys(prev).forEach((key) => {
        if (!itemNames.has(key)) {
          delete next[key];
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [items, selector]);

  return [draft, setDraft] as const;
};

const TaskSettingsTab: React.FC<TaskSettingsTabProps> = ({
  fields,
  types,
  loading,
  onSaveField,
  onResetField,
  onSaveType,
  onResetType,
}) => {
  const selectFieldDraft = React.useCallback(
    (item: TaskFieldItem) =>
      item.value?.trim() || item.meta?.defaultLabel || item.name,
    [],
  );
  const selectTypeDraft = React.useCallback(
    (item: TaskTypeItem) => ({
      label: item.value?.trim() || item.meta?.defaultLabel || item.name,
      url:
        typeof item.meta?.tg_theme_url === "string"
          ? item.meta.tg_theme_url
          : "",
      photosUrl:
        typeof item.meta?.tg_photos_url === "string"
          ? item.meta.tg_photos_url
          : "",
    }),
    [],
  );

  const [fieldDrafts, setFieldDrafts] = useDraftMap(fields, selectFieldDraft);
  const [typeDrafts, setTypeDrafts] = useDraftMap(types, selectTypeDraft);
  const [savingField, setSavingField] = React.useState<string | null>(null);
  const [savingType, setSavingType] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [typeErrors, setTypeErrors] = React.useState<Record<string, string>>({});

  const sortedFields = React.useMemo(() => sortByOrder(fields), [fields]);
  const sortedTypes = React.useMemo(() => sortByOrder(types), [types]);

  const handleFieldChange = (name: string, value: string) => {
    setFieldDrafts((prev) => ({ ...prev, [name]: value }));
    setFieldErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleTypeChange = (
    name: string,
    patch: Partial<{ label: string; url: string; photosUrl: string }>,
  ) => {
    setTypeDrafts((prev) => ({
      ...prev,
      [name]: {
        label: prev[name]?.label ?? "",
        url: prev[name]?.url ?? "",
        photosUrl: prev[name]?.photosUrl ?? "",
        ...patch,
      },
    }));
    setTypeErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const saveField = async (item: TaskFieldItem) => {
    const value = fieldDrafts[item.name] ?? "";
    setSavingField(item.name);
    setFieldErrors((prev) => ({ ...prev, [item.name]: "" }));
    try {
      await onSaveField(item, value);
      setFieldDrafts((prev) => ({
        ...prev,
        [item.name]: value,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFieldErrors((prev) => ({ ...prev, [item.name]: message }));
      throw err;
    } finally {
      setSavingField((prev) => (prev === item.name ? null : prev));
    }
  };

  const resetField = async (item: TaskFieldItem) => {
    setSavingField(item.name);
    setFieldErrors((prev) => ({ ...prev, [item.name]: "" }));
    try {
      await onResetField(item);
      setFieldDrafts((prev) => ({
        ...prev,
        [item.name]: item.meta?.defaultLabel ?? item.name,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setFieldErrors((prev) => ({ ...prev, [item.name]: message }));
      throw err;
    } finally {
      setSavingField((prev) => (prev === item.name ? null : prev));
    }
  };

  const saveType = async (item: TaskTypeItem) => {
    const draft = typeDrafts[item.name] ?? {
      label: "",
      url: "",
      photosUrl: "",
    };
    setSavingType(item.name);
    setTypeErrors((prev) => ({ ...prev, [item.name]: "" }));
    try {
      await onSaveType(item, {
        label: draft.label,
        tg_theme_url: draft.url,
        tg_photos_url: draft.photosUrl,
      });
      setTypeDrafts((prev) => ({
        ...prev,
        [item.name]: {
          label: draft.label,
          url: draft.url,
          photosUrl: draft.photosUrl,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTypeErrors((prev) => ({ ...prev, [item.name]: message }));
      throw err;
    } finally {
      setSavingType((prev) => (prev === item.name ? null : prev));
    }
  };

  const resetType = async (item: TaskTypeItem) => {
    setSavingType(item.name);
    setTypeErrors((prev) => ({ ...prev, [item.name]: "" }));
    try {
      await onResetType(item);
      setTypeDrafts((prev) => ({
        ...prev,
        [item.name]: {
          label: item.meta?.defaultLabel ?? item.name,
          url: "",
          photosUrl: "",
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTypeErrors((prev) => ({ ...prev, [item.name]: message }));
      throw err;
    } finally {
      setSavingType((prev) => (prev === item.name ? null : prev));
    }
  };

  return (
    <div className="space-y-6">
      <section className={SECTION_GAP}>
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Поля задачи
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Настройте названия полей, которые видят пользователи в карточке
            задачи.
          </p>
        </header>
        {loading && !sortedFields.length ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedFields.map((item) => (
              <FieldCard
                key={item._id}
                item={item}
                value={fieldDrafts[item.name] ?? ""}
                onChange={(value) => handleFieldChange(item.name, value)}
                onSave={() => saveField(item)}
                onReset={() => resetField(item)}
                saving={savingField === item.name}
                error={fieldErrors[item.name]}
              />
            ))}
          </div>
        )}
      </section>
      <section className={SECTION_GAP}>
        <header className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Типы задач и темы Telegram
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Для каждого типа задачи можно задать отображаемое название,
            основную тему чата Telegram и отдельную тему для альбома фото.
          </p>
        </header>
        {loading && !sortedTypes.length ? (
          <div className="flex items-center justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTypes.map((item) => (
              <TypeCard
                key={item._id}
                item={item}
                label={typeDrafts[item.name]?.label ?? ""}
                url={typeDrafts[item.name]?.url ?? ""}
                photosUrl={typeDrafts[item.name]?.photosUrl ?? ""}
                onChangeLabel={(value) =>
                  handleTypeChange(item.name, { label: value })
                }
                onChangeUrl={(value) =>
                  handleTypeChange(item.name, { url: value })
                }
                onChangePhotosUrl={(value) =>
                  handleTypeChange(item.name, { photosUrl: value })
                }
                onSave={() => saveType(item)}
                onReset={() => resetType(item)}
                saving={savingType === item.name}
                error={typeErrors[item.name]}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default TaskSettingsTab;
