// Назначение файла: универсальный селект с одиночным выбором для форм
// Основные модули: React, react-select
import { useId, useMemo } from "react";
import Select from "react-select";

export type SingleSelectOption = {
  value: string;
  label: string;
};

interface Props {
  label: string;
  options: SingleSelectOption[];
  value: string | null;
  onChange: (option: SingleSelectOption | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
}

export default function SingleSelect({
  label,
  options,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  hint,
  error,
  required,
}: Props) {
  const selectId = useId();
  const normalizedOptions = useMemo(
    () => options.map((option) => ({ ...option })),
    [options],
  );
  const selectedOption =
    value !== null
      ? normalizedOptions.find((option) => option.value === value) ?? null
      : null;
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
        options={normalizedOptions}
        value={selectedOption}
        inputId={selectId}
        isDisabled={disabled}
        placeholder={placeholder ?? "Выберите"}
        onChange={(option) =>
          onChange(option ? (option as SingleSelectOption) : null)
        }
        onBlur={onBlur}
        className="mt-1"
        classNamePrefix="select"
        aria-invalid={Boolean(error)}
        aria-describedby={helperId}
        aria-required={required}
        noOptionsMessage={() => "Нет совпадений"}
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
