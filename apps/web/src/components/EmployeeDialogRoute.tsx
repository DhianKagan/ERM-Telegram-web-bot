// Назначение: отображение карточки сотрудника в модальном окне по query-параметру.
// Основные модули: React, React Router, Modal, EmployeeCardForm, useEmployeeDialog.
import React, { Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import Modal from "./Modal";
import useEmployeeDialog from "../hooks/useEmployeeDialog";

const EmployeeCardFormLazy = React.lazy(() => import("./EmployeeCardForm"));

export default function EmployeeDialogRoute() {
  const [params] = useSearchParams();
  const { close } = useEmployeeDialog();
  const employeeId = params.get("employee");

  if (!employeeId) {
    return null;
  }

  return (
    <Modal open onClose={close}>
      <Suspense fallback={<div>Загрузка карточки сотрудника...</div>}>
        <EmployeeCardFormLazy
          telegramId={employeeId}
          className="mx-auto max-w-3xl"
          mode="update"
          onClose={close}
        />
      </Suspense>
    </Modal>
  );
}
