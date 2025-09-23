// Назначение: кнопка-ссылка для открытия карточки сотрудника в модальном окне.
// Основные модули: React, clsx, useEmployeeDialog.
import React from "react";
import clsx from "clsx";
import useEmployeeDialog from "../hooks/useEmployeeDialog";

type EmployeeLinkProps = {
  employeeId: number | string;
  stopPropagation?: boolean;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick">;

const baseClassName =
  "inline-flex cursor-pointer items-center text-accentPrimary transition-colors duration-150 hover:text-accentPrimary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accentPrimary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const EmployeeLink: React.FC<EmployeeLinkProps> = ({
  employeeId,
  children,
  className,
  stopPropagation = false,
  ...rest
}) => {
  const { open } = useEmployeeDialog();
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (stopPropagation) {
        event.stopPropagation();
      }
      open(employeeId);
    },
    [employeeId, open, stopPropagation],
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(baseClassName, className)}
      {...rest}
    >
      {children}
    </button>
  );
};

export default EmployeeLink;
