// Компонент управления сотрудником, содержит форму с селекторами
// Модули: React, services/collections
import React from "react";
import {
  fetchCollectionItems,
  type CollectionItem,
} from "../services/collections";

export type EmployeeManagerProps = {
  onSubmit: (data: {
    name: string;
    departmentId?: string;
    divisionId?: string;
    positionId?: string;
  }) => void;
};

type EmployeeManagerComponent = React.FC<EmployeeManagerProps> & {
  selectors: {
    form: string;
    nameInput: string;
    departmentSelect: string;
    divisionSelect: string;
    positionSelect: string;
  };
};

const EmployeeManager: EmployeeManagerComponent = ({ onSubmit }) => {
  const [name, setName] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [divisionId, setDivisionId] = React.useState("");
  const [positionId, setPositionId] = React.useState("");
  const [departments, setDepartments] = React.useState<CollectionItem[]>([]);
  const [divisions, setDivisions] = React.useState<CollectionItem[]>([]);
  const [positions, setPositions] = React.useState<CollectionItem[]>([]);

  React.useEffect(() => {
    if (typeof fetch === "undefined") return;
    fetchCollectionItems("departments", "", 1, 100).then((d) =>
      setDepartments(d.items),
    );
    fetchCollectionItems("divisions", "", 1, 100).then((d) =>
      setDivisions(d.items),
    );
    fetchCollectionItems("positions", "", 1, 100).then((d) =>
      setPositions(d.items),
    );
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, departmentId, divisionId, positionId });
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
      <label className="block text-sm font-medium" htmlFor="employee-dept">
        Департамент
      </label>
      <select
        id="employee-dept"
        className="h-10 w-full rounded border px-3"
        value={departmentId}
        onChange={(e) => setDepartmentId(e.target.value)}
      >
        <option value=""></option>
        {departments.map((d) => (
          <option key={d._id} value={d._id}>
            {d.name}
          </option>
        ))}
      </select>
      <label className="block text-sm font-medium" htmlFor="employee-div">
        Отдел
      </label>
      <select
        id="employee-div"
        className="h-10 w-full rounded border px-3"
        value={divisionId}
        onChange={(e) => setDivisionId(e.target.value)}
      >
        <option value=""></option>
        {divisions.map((d) => (
          <option key={d._id} value={d._id}>
            {d.name}
          </option>
        ))}
      </select>
      <label className="block text-sm font-medium" htmlFor="employee-pos">
        Должность
      </label>
      <select
        id="employee-pos"
        className="h-10 w-full rounded border px-3"
        value={positionId}
        onChange={(e) => setPositionId(e.target.value)}
      >
        <option value=""></option>
        {positions.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>
      <button type="submit" className="h-8 rounded bg-blue-600 px-3 text-white">
        Сохранить
      </button>
    </form>
  );
};

EmployeeManager.selectors = {
  form: '[data-testid="employee-form"]',
  nameInput: '[data-testid="employee-name"]',
  departmentSelect: "#employee-dept",
  divisionSelect: "#employee-div",
  positionSelect: "#employee-pos",
};

export default EmployeeManager;
