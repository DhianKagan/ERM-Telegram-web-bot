// Конфигурация колонок задач для AG Grid
// Модули: ag-grid, userLink
import type { ColDef } from "ag-grid-community";
import userLink from "../utils/userLink";
import type { Task } from "shared";

type TaskRow = Task & Record<string, any>;

export default function taskColumns(
  _selectable: boolean,
  users: Record<number, any>,
): ColDef<TaskRow>[] {
  return [
    { headerName: "Номер", field: "task_number" },
    {
      headerName: "Дата создания",
      field: "createdAt",
      valueFormatter: (p) => (p.value ? p.value.slice(0, 10) : ""),
    },
    { headerName: "Название", field: "title" },
    { headerName: "Статус", field: "status" },
    { headerName: "Приоритет", field: "priority" },
    { headerName: "Начало", field: "start_date" },
    { headerName: "Срок", field: "due_date" },
    { headerName: "Тип", field: "task_type" },
    {
      headerName: "Старт",
      field: "startCoordinates",
      valueFormatter: (p) => (p.value ? `${p.value.lat}, ${p.value.lng}` : ""),
    },
    {
      headerName: "Финиш",
      field: "finishCoordinates",
      valueFormatter: (p) => (p.value ? `${p.value.lat}, ${p.value.lng}` : ""),
    },
    { headerName: "Км", field: "route_distance_km" },
    {
      headerName: "Исполнители",
      field: "assignees",
      valueFormatter: (p) => (p.value ? (p.value as number[]).join(", ") : ""),
      cellRenderer: (p: any) => {
        const ids =
          p.data.assignees ||
          (p.data.assigned_user_id ? [p.data.assigned_user_id] : []);
        return ids.map((id: number) => (
          <span
            key={id}
            dangerouslySetInnerHTML={{
              __html: userLink(
                id,
                users[id]?.name ||
                  users[id]?.telegram_username ||
                  users[id]?.username ||
                  String(id),
              ),
            }}
            className="mr-1"
          />
        ));
      },
    },
  ];
}
