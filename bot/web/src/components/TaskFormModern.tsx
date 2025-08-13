// Современная форма задачи
// Модули: React, clsx, Tailwind
import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

/**
 * TaskFormModern — компактная, современная форма задачи.
 *
 * Цели:
 * - Чистая сетка 12 колонок, одинаковые отступы и размеры контролов
 * - Явная иерархия кнопок (primary / secondary / ghost / danger)
 * - Сегментные переключатели для Статуса/Приоритета/Типа
 * - Понятные подписи, валидация, подсказки, быстрые шорткаты (Ctrl+S, Esc)
 * - Поле "Google Maps" с кнопками: «Вставить», «Открыть», «Парсить»
 * - Липкий футер с действиями, превентивное подтверждение при незаполненных полях
 *
 * Зависимости: только React + Tailwind + clsx (clsx можно убрать).
 * Без react-hook-form, чтобы подключалось без доп. пакетов. При желании
 * замените локальную валидацию на RHF + Zod.
 */

// ====== Типы данных (адаптируйте под ваши интерфейсы) ======
export type TaskFormData = {
  title: string;
  startDate?: string; // ISO yyyy-mm-ddThh:mm
  dueDate?: string; // ISO
  status: "new" | "in_day" | "overdue" | "no_due";
  priority: "low" | "normal" | "high" | "urgent";
  taskType: "deliver" | "pickup" | "visit" | "other";
  creator?: string; // user id/display
  assignees: string[]; // user ids
  startLink?: string; // Google Maps URL
  endLink?: string; // Google Maps URL
  transport: "auto" | "foot" | "bike" | "other";
  payment: "cash" | "card" | "none";
  note?: string;
};

export type TaskFormModernProps = {
  // начальные данные формы
  defaultValues?: Partial<TaskFormData>;
  // список исполнителей для автокомплита
  assigneeOptions?: { id: string; name: string }[];
  // создать/сохранить
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  // отмена (закрыть модалку)
  onCancel: () => void;
  // можно показать прелоадер при сабмите
  submitting?: boolean;
  // необязательная кастомизация заголовка
  title?: string;
};

// ====== Кнопка с вариантами ======
const Btn: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "ghost" | "danger";
    size?: "md" | "lg";
  }
> = ({ variant = "primary", size = "md", className, ...props }) => (
  <button
    {...props}
    className={clsx(
      "inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
      size === "lg" ? "h-11 px-5 text-[15px]" : "h-10 px-4 text-[14px]",
      variant === "primary" &&
        "bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-600",
      variant === "secondary" &&
        "bg-slate-100 text-slate-900 hover:bg-slate-200 focus-visible:ring-slate-400 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
      variant === "ghost" &&
        "bg-transparent text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
      variant === "danger" &&
        "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-600",
      className,
    )}
  />
);

// ====== Сегментный контрол ======
const Segment: React.FC<{
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; hint?: string }[];
}> = ({ value, onChange, items }) => (
  <div
    className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
    role="tablist"
    aria-label="Toggle group"
  >
    {items.map((it) => (
      <button
        key={it.value}
        type="button"
        aria-pressed={value === it.value}
        onClick={() => onChange(it.value)}
        className={clsx(
          "h-9 rounded-lg px-3 text-[13px] font-medium shadow-sm transition",
          value === it.value
            ? "bg-white text-slate-900 dark:bg-slate-700 dark:text-slate-100"
            : "text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/60",
        )}
        title={it.hint}
      >
        {it.label}
      </button>
    ))}
  </div>
);

// ====== Поле ввода (label + input + error) ======
const Field: React.FC<{
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  required?: boolean;
}> = ({ label, hint, error, required, children }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline gap-2">
      <label className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
        {label}
        {required && <span className="text-rose-600"> *</span>}
      </label>
      {hint && <span className="text-[12px] text-slate-500">{hint}</span>}
    </div>
    {children}
    {error && <p className="text-[12px] text-rose-600">{error}</p>}
  </div>
);

// ====== Утилиты ======
function parseGMapsLatLng(url?: string): { lat: number; lng: number } | null {
  if (!url) return null;
  try {
    // поддержка форматов: .../@lat,lng, ...?q=lat,lng, .../place/..@lat,lng
    const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return { lat: parseFloat(at[1]), lng: parseFloat(at[2]) };
    const q = url.match(/[?&](q|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (q) return { lat: parseFloat(q[2]), lng: parseFloat(q[3]) };
  } catch {
    // игнорируем ошибки парсинга
  }
  return null;
}

function openInNew(url?: string) {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

function isoLocal(date?: string) {
  if (!date) return "";
  // нормализуем до input[type=datetime-local]
  return date.slice(0, 16);
}

// ====== Компонент формы ======
const empty: TaskFormData = {
  title: "",
  status: "new",
  priority: "normal",
  taskType: "deliver",
  assignees: [],
  transport: "auto",
  payment: "none",
};

export default function TaskFormModern({
  defaultValues,
  assigneeOptions = [],
  onSubmit,
  onCancel,
  submitting,
  title: heading = "Задача",
}: TaskFormModernProps) {
  const [data, setData] = useState<TaskFormData>({
    ...empty,
    ...defaultValues,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirtyRef = useRef(false);

  // Помечаем «грязную» форму
  useEffect(() => {
    dirtyRef.current = true;
  }, [data]);

  // Шорткаты: Ctrl+S = save, Esc = cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [data]);

  const assigneeNames = useMemo(
    () => new Map(assigneeOptions.map((a) => [a.id, a.name])),
    [assigneeOptions],
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!data.title?.trim()) next.title = "Укажите название";
    if (data.startLink && !parseGMapsLatLng(data.startLink))
      next.startLink = "Некорректная ссылка Google Maps";
    if (data.endLink && !parseGMapsLatLng(data.endLink))
      next.endLink = "Некорректная ссылка Google Maps";
    if (
      data.dueDate &&
      data.startDate &&
      new Date(data.dueDate) < new Date(data.startDate)
    )
      next.dueDate = "Срок раньше начала";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    dirtyRef.current = false;
    await onSubmit(data);
  }

  function set<K extends keyof TaskFormData>(key: K, value: TaskFormData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  // ====== Разметка ======
  return (
    <div className="flex h-full max-h-[88vh] flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {heading}
          </h2>
          <p className="text-[13px] text-slate-500">
            Создайте задачу с адресами Google Maps и назначьте исполнителей.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Btn variant="ghost" onClick={onCancel}>
            Закрыть
          </Btn>
          <Btn onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Сохранение…" : "Сохранить"}
          </Btn>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-12 gap-x-5 gap-y-6">
          {/* Название */}
          <div className="col-span-12">
            <Field label="Название задачи" required error={errors.title}>
              <input
                type="text"
                placeholder="Напр.: Доставить документы"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                value={data.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </Field>
          </div>

          {/* Даты */}
          <div className="col-span-12 md:col-span-6">
            <Field label="Дата начала" hint="Локальное время">
              <input
                type="datetime-local"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                value={isoLocal(data.startDate)}
                onChange={(e) =>
                  set(
                    "startDate",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  )
                }
              />
            </Field>
          </div>
          <div className="col-span-12 md:col-span-6">
            <Field label="Срок выполнения" error={errors.dueDate}>
              <input
                type="datetime-local"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                value={isoLocal(data.dueDate)}
                onChange={(e) =>
                  set(
                    "dueDate",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  )
                }
              />
            </Field>
          </div>

          {/* Сегменты */}
          <div className="col-span-12 md:col-span-6">
            <Field label="Статус">
              <Segment
                value={data.status}
                onChange={(v) => set("status", v as TaskFormData["status"])}
                items={[
                  { value: "new", label: "Новая" },
                  { value: "in_day", label: "В течение дня" },
                  { value: "overdue", label: "Просрочено" },
                  { value: "no_due", label: "Бессрочно" },
                ]}
              />
            </Field>
          </div>
          <div className="col-span-12 md:col-span-6">
            <Field label="Приоритет">
              <Segment
                value={data.priority}
                onChange={(v) => set("priority", v as TaskFormData["priority"])}
                items={[
                  { value: "low", label: "Низкий" },
                  { value: "normal", label: "Обычный" },
                  { value: "high", label: "Высокий" },
                  { value: "urgent", label: "Срочный" },
                ]}
              />
            </Field>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Field label="Тип задачи">
              <Segment
                value={data.taskType}
                onChange={(v) => set("taskType", v as TaskFormData["taskType"])}
                items={[
                  { value: "deliver", label: "Доставить" },
                  { value: "pickup", label: "Забрать" },
                  { value: "visit", label: "Визит" },
                  { value: "other", label: "Другое" },
                ]}
              />
            </Field>
          </div>

          {/* Исполнители */}
          <div className="col-span-12 md:col-span-6">
            <Field label="Исполнители" hint="Можно выбрать нескольких">
              <div className="flex gap-2">
                <select
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                  onChange={(e) => {
                    const id = e.target.value;
                    if (id && !data.assignees.includes(id))
                      set("assignees", [...data.assignees, id]);
                    e.currentTarget.selectedIndex = 0; // сбрасываем выбор
                  }}
                >
                  <option value="">Добавить исполнителя…</option>
                  {assigneeOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              {data.assignees.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.assignees.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-[12px] dark:bg-slate-800"
                    >
                      {assigneeNames.get(id) ?? id}
                      <button
                        type="button"
                        className="-mr-1 rounded-md px-1 text-slate-500 hover:text-slate-800"
                        onClick={() =>
                          set(
                            "assignees",
                            data.assignees.filter((x) => x !== id),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </div>

          {/* Адреса */}
          <div className="col-span-12 md:col-span-6">
            <Field
              label="Стартовая точка"
              hint="Ссылка Google Maps"
              error={errors.startLink}
            >
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                  value={data.startLink ?? ""}
                  onChange={(e) => set("startLink", e.target.value)}
                />
                <Btn
                  variant="secondary"
                  type="button"
                  onClick={() => openInNew(data.startLink)}
                >
                  Открыть
                </Btn>
                <Btn
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    const coords = parseGMapsLatLng(data.startLink);
                    if (!coords)
                      return alert("Не удалось распознать координаты");
                    alert(
                      `Старт: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
                    );
                  }}
                >
                  Парсить
                </Btn>
              </div>
            </Field>
          </div>

          <div className="col-span-12 md:col-span-6">
            <Field
              label="Финальная точка"
              hint="Ссылка Google Maps"
              error={errors.endLink}
            >
              <div className="flex items-center gap-2">
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                  value={data.endLink ?? ""}
                  onChange={(e) => set("endLink", e.target.value)}
                />
                <Btn
                  variant="secondary"
                  type="button"
                  onClick={() => openInNew(data.endLink)}
                >
                  Открыть
                </Btn>
                <Btn
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    const coords = parseGMapsLatLng(data.endLink);
                    if (!coords)
                      return alert("Не удалось распознать координаты");
                    alert(
                      `Финиш: ${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`,
                    );
                  }}
                >
                  Парсить
                </Btn>
              </div>
            </Field>
          </div>

          {/* Прочее */}
          <div className="col-span-12 md:col-span-6">
            <Field label="Тип транспорта">
              <Segment
                value={data.transport}
                onChange={(v) =>
                  set("transport", v as TaskFormData["transport"])
                }
                items={[
                  { value: "auto", label: "Авто" },
                  { value: "foot", label: "Пешком" },
                  { value: "bike", label: "Вело" },
                  { value: "other", label: "Другое" },
                ]}
              />
            </Field>
          </div>
          <div className="col-span-12 md:col-span-6">
            <Field label="Способ оплаты">
              <Segment
                value={data.payment}
                onChange={(v) => set("payment", v as TaskFormData["payment"])}
                items={[
                  { value: "card", label: "Карта" },
                  { value: "cash", label: "Наличные" },
                  { value: "none", label: "Нет" },
                ]}
              />
            </Field>
          </div>

          <div className="col-span-12">
            <Field label="Задача / комментарий">
              <textarea
                placeholder="Краткая формулировка, детали, контакты"
                className="min-h-[96px] w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[14px] shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-900"
                value={data.note ?? ""}
                onChange={(e) => set("note", e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 border-t border-slate-200 bg-white/70 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <div className="order-2 flex gap-2 sm:order-1">
            <Btn variant="ghost" onClick={onCancel}>
              Отмена
            </Btn>
          </div>
          <div className="order-1 flex gap-2 sm:order-2">
            <Btn
              variant="secondary"
              onClick={() => {
                set("title", data.title + " (черновик)");
              }}
            >
              Сохранить как черновик
            </Btn>
            <Btn onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Сохранение…" : "Сохранить"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/*
Встройка:

<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="p-0 max-w-4xl">
    <TaskFormModern
      defaultValues={...}
      assigneeOptions={users}
      onSubmit={saveTask}
      onCancel={() => setOpen(false)}
    />
  </DialogContent>
</Dialog>

*/
