// Конфигурация колонок задач для AG Grid
// Модули: ag-grid, userLink
import type { ColDef } from "ag-grid-community";
import userLink from "../utils/userLink";

type Task = {
  _id: string;
  request_id?: string;
  title: string;
  status?: string;
  priority?: string;
  start_date?: string;
  due_date?: string;
  task_type?: string;
  assignees?: number[];
  assigned_user_id?: number;
  startCoordinates?: { lat: number; lng: number };
  finishCoordinates?: { lat: number; lng: number };
  route_distance_km?: number;
  createdAt?: string;
};

export default function taskColumns(
  selectable: boolean,
  users: Record<number, any>,
): ColDef<Task>[] {
  return [
    {
      headerName: "Задача",
      field: "title",
      checkboxSelection: selectable,
      headerCheckboxSelection: selectable,
      valueGetter: (p) =>
        `${p.data.request_id || ""} ${p.data.createdAt?.slice(0, 10) || ""} ${
          p.data.title?.replace(/^ERM_\d+\s*/, "") || ""
        }`,
    },
    { headerName: "Статус", field: "status" },
    { headerName: "Приоритет", field: "priority" },
    { headerName: "Начало", field: "start_date" },
    { headerName: "Срок", field: "due_date" },
    { headerName: "Тип", field: "task_type" },
    {
      headerName: "Старт",
      field: "startCoordinates",
      valueGetter: (p) =>
        p.data.startCoordinates
          ? `${p.data.startCoordinates.lat}, ${p.data.startCoordinates.lng}`
          : "",
    },
    {
      headerName: "Финиш",
      field: "finishCoordinates",
      valueGetter: (p) =>
        p.data.finishCoordinates
          ? `${p.data.finishCoordinates.lat}, ${p.data.finishCoordinates.lng}`
          : "",
    },
    { headerName: "Км", field: "route_distance_km" },
    {
      headerName: "Исполнители",
      field: "assignees",
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
