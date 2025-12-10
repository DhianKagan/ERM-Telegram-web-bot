// Назначение файла: компонент выбора списка пользователей.
// Модули: React, react-select
import { useId, useMemo } from 'react';
import Select, { type MultiValue } from 'react-select';

interface Props {
  label: string;
  users: {
    telegram_id: number;
    name?: string;
    username?: string;
    telegram_username?: string | null;
  }[];
  value: number[];
  onChange: (v: number[]) => void;
  onBlur?: () => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  error?: string | null;
  placeholder?: string;
}

export default function MultiUserSelect({
  label,
  users,
  value,
  onChange,
  onBlur,
  disabled,
  required,
  hint,
  error,
  placeholder,
}: Props) {
  const options = useMemo(
    () =>
      users.map((u) => ({
        value: u.telegram_id,
        label:
          u.name || u.telegram_username || u.username || String(u.telegram_id),
      })),
    [users],
  );
  const selectId = useId();
  const selected = options.filter((o) => value.includes(o.value));
  const helperId = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;
  return (
    <div>
      <label className="block text-sm font-medium" htmlFor={selectId}>
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </label>
      <Select
        isMulti
        isDisabled={disabled}
        options={options}
        value={selected}
        inputId={selectId}
        placeholder={placeholder ?? 'Выберите'}
        onChange={(val) => {
          const list = (val as MultiValue<{ value: number }>).map(
            (item) => item.value,
          );
          onChange(list);
        }}
        onBlur={onBlur}
        className="mt-1"
        classNamePrefix="select"
        aria-invalid={Boolean(error)}
        aria-describedby={helperId}
        aria-required={required}
        noOptionsMessage={() => 'Нет совпадений'}
      />
      {hint && !error ? (
        <p id={helperId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={helperId} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
