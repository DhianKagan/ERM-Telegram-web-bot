// Поле формы с уникальным идентификатором
// Модули: React
import React from "react";

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
};

export function FormField({
  label,
  children,
  hint,
  className = "",
}: FieldProps) {
  const id = React.useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children != null ? (
        React.isValidElement(children) ? (
          React.cloneElement(children, { id })
        ) : (
          children
        )
      ) : (
        <span data-testid="empty-field" />
      )}
      {hint && <span className="text-xs text-gray-500">{hint}</span>}
    </div>
  );
}

export default FormField;
