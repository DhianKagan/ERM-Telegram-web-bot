// Компонент управления сотрудником, содержит форму с селекторами
// Модули: React
import React from "react";

export type EmployeeManagerProps = {
  onSubmit: (data: { name: string }) => void;
};

type EmployeeManagerComponent = React.FC<EmployeeManagerProps> & {
  selectors: {
    form: string;
    nameInput: string;
  };
};

const EmployeeManager: EmployeeManagerComponent = ({ onSubmit }) => {
  const [name, setName] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="employee-form"
      className="space-y-2"
    >
      <label className="block text-sm font-medium" htmlFor="employee-name">
        Имя сотрудника
      </label>
      <input
        id="employee-name"
        data-testid="employee-name"
        className="h-10 w-full rounded border px-3"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <button type="submit" className="h-8 rounded bg-blue-600 px-3 text-white">
        Сохранить
      </button>
    </form>
  );
};

EmployeeManager.selectors = {
  form: '[data-testid="employee-form"]',
  nameInput: '[data-testid="employee-name"]',
};

export default EmployeeManager;
