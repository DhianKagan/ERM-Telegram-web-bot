// Компонент выбора нескольких пользователей с ленивой загрузкой react-select
import React from "react";
const Select = React.lazy(() => import("react-select"));

interface Props {
  label: string;
  users: { telegram_id: number; name?: string; username?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
}

export default function MultiUserSelect({
  label,
  users,
  value,
  onChange,
  disabled,
}: Props) {
  const options = React.useMemo(
    () =>
      users.map((u) => ({
        value: String(u.telegram_id),
        label: u.name || u.telegram_username || u.username,
      })),
    [users],
  );
  const selected = options.filter((o) => value.includes(o.value));
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <React.Suspense fallback={<div>Загрузка...</div>}>
        <Select
          isMulti
          isDisabled={disabled}
          options={options}
          value={selected}
          placeholder="Выбрать"
          onChange={(vals) => onChange((vals as any[]).map((v) => v.value))}
          className="mt-1"
          classNamePrefix="select"
        />
      </React.Suspense>
    </div>
  );
}
