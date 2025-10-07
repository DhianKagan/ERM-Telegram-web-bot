// Компонент управления департаментом, содержит форму с селекторами
// Модули: React
import React from "react";

export type DepartmentManagerProps = {
  onSubmit: (data: { name: string }) => void;
};

type DepartmentManagerComponent = React.FC<DepartmentManagerProps> & {
  selectors: {
    form: string;
    nameInput: string;
  };
};

const DepartmentManager: DepartmentManagerComponent = ({ onSubmit }) => {
  const [name, setName] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name });
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="department-form"
      className="space-y-2"
    >
      <label className="block text-sm font-medium" htmlFor="department-name">
        Название департамента
      </label>
      <input
        id="department-name"
        name="departmentName"
        data-testid="department-name"
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

DepartmentManager.selectors = {
  form: '[data-testid="department-form"]',
  nameInput: '[data-testid="department-name"]',
};

export default DepartmentManager;
