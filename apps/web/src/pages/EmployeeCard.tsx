// Назначение: страница карточки сотрудника с формой редактирования
// Основные модули: React Router, компоненты EmployeeCardForm и Breadcrumbs
import { useParams } from "react-router-dom";
import Breadcrumbs from "../components/Breadcrumbs";
import EmployeeCardForm from "../components/EmployeeCardForm";

export default function EmployeeCard() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-6 p-4">
      <Breadcrumbs
        items={[
          { label: "Задачи", href: "/tasks" },
          { label: "Сотрудники", href: "/cp/settings" },
          { label: id ? `ID ${id}` : "Карточка" },
        ]}
      />
      <EmployeeCardForm telegramId={id} className="mx-auto max-w-3xl" />
    </div>
  );
}
