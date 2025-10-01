// Назначение файла: компонент выбора одного пользователя.
// Модули: React, react-select
import { useMemo } from "react";
import Select from "react-select";

interface Props {
  label: string;
  users: {
    telegram_id: number;
    name?: string;
    username?: string;
    telegram_username?: string | null;
  }[];
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}

export default function MultiUserSelect({
  label,
  users,
  value,
  onChange,
  disabled,
}: Props) {
  const options = useMemo(
    () =>
      users.map((u) => ({
        value: String(u.telegram_id),
        label: u.name || u.telegram_username || u.username,
      })),
    [users],
  );
  const selected = options.find((o) => o.value === value) ?? null;
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <Select
        isDisabled={disabled}
        options={options}
        value={selected}
        placeholder="Выбрать"
        onChange={(val) => {
          if (!val) {
            onChange(null);
            return;
          }
          const item = val as { value?: string } | null;
          onChange(item?.value ?? null);
        }}
        className="mt-1"
        classNamePrefix="select"
      />
    </div>
  );
}
