// Страница редактирования справочников значений
import React from "react";
import Breadcrumbs from "../components/Breadcrumbs";
import {
  fetchDefaults,
  updateDefaults,
  fetchDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../services/dicts";
import { AuthContext } from "../context/AuthContext";

export default function Defaults() {
  const [name, setName] = React.useState("task_type");
  const [values, setValues] = React.useState<string[]>([]);
  const [departments, setDepartments] = React.useState<{ _id?: string; name: string }[]>([]);
  const { user } = React.useContext(AuthContext);

  React.useEffect(() => {
    if (name === "department") {
      fetchDepartments().then(setDepartments);
    } else {
      fetchDefaults(name).then(setValues);
    }
  }, [name]);

  const save = async () => {
    if (name === "department") {
      for (const d of departments) {
        if (d._id) {
          await updateDepartment(d._id, d.name);
        } else {
          await createDepartment(d.name);
        }
      }
      fetchDepartments().then(setDepartments);
    } else {
      await updateDefaults(name, values);
    }
  };

  if (user?.roleId?.name !== "admin") return <div className="p-4">Доступ запрещён</div>;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Справочники" }]} />
      <h2 className="text-xl font-semibold">Справочники</h2>
      <select value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-2 py-1">
        <option value="task_type">Тип задачи</option>
        <option value="priority">Приоритет</option>
        <option value="status">Статус</option>
        <option value="transport_type">Тип транспорта</option>
        <option value="payment_method">Способ оплаты</option>
        <option value="department">Отдел</option>
      </select>
      <ul className="space-y-2">
        {name === "department"
          ? departments.map((d, i) => (
              <li key={d._id || i} className="flex gap-2">
                <input
                  value={d.name}
                  onChange={(e) => {
                    const arr = [...departments];
                    arr[i] = { ...arr[i], name: e.target.value };
                    setDepartments(arr);
                  }}
                  className="border px-2 py-1 rounded"
                />
                <button
                  onClick={() => {
                    if (d._id) deleteDepartment(d._id);
                    setDepartments(departments.filter((_, idx) => idx !== i));
                  }}
                  className="btn"
                >
                  Удалить
                </button>
              </li>
            ))
          : values.map((v, i) => (
              <li key={i} className="flex gap-2">
                <input
                  value={v}
                  onChange={(e) => {
                    const copy = [...values];
                    copy[i] = e.target.value;
                    setValues(copy);
                  }}
                  className="border px-2 py-1 rounded"
                />
                <button
                  onClick={() => setValues(values.filter((_, idx) => idx !== i))}
                  className="btn"
                >
                  Удалить
                </button>
              </li>
            ))}
      </ul>
      <button
        onClick={() =>
          name === "department"
            ? setDepartments([...departments, { name: "" }])
            : setValues([...values, ""])
        }
        className="btn"
      >
        Добавить
      </button>
      <button onClick={save} className="btn btn-blue">Сохранить</button>
    </div>
  );
}
