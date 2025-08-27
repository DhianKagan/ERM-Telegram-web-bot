// Общая форма создания и редактирования задач
// Модули: React, DOMPurify, контексты, сервисы задач, shared и логов
import React, { useContext } from "react";
import DOMPurify from "dompurify";
import CKEditorPopup from "./CKEditorPopup";
import MultiUserSelect from "./MultiUserSelect";
import { AuthContext } from "../context/AuthContext";
import { taskFields as fields } from "shared";
import {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
} from "../services/tasks";
import authFetch from "../utils/authFetch";
import parseGoogleAddress from "../utils/parseGoogleAddress";
import { validateURL } from "../utils/validation";
import extractCoords from "../utils/extractCoords";
import { expandLink } from "../services/maps";
import {
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import fetchRoute from "../services/route";
import createRouteLink from "../utils/createRouteLink";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FileUploader from "./FileUploader";
import type { Attachment, HistoryItem, UserBrief } from "../types/task";

interface Props {
  onClose: () => void;
  onSave?: (data: any) => void;
  id?: string;
}

export default function TaskDialog({ onClose, onSave, id }: Props) {
  const isEdit = Boolean(id);
  const { user } = useContext(AuthContext);
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const initialRef = React.useRef<any>(null);
  const [requestId, setRequestId] = React.useState("");
  const [created, setCreated] = React.useState("");
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const taskSchema = z.object({
    title: z.string().min(1, "Название обязательно"),
    description: z.string().optional(),
    controllers: z.array(z.string()).default([]),
    assignees: z.array(z.string()).default([]),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
  });
  type TaskFormValues = z.infer<typeof taskSchema>;
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      controllers: [],
      assignees: [],
      startDate: "",
      dueDate: "",
    },
  });
  const DEFAULT_TASK_TYPE =
    fields.find((f) => f.name === "task_type")?.default || "";
  const DEFAULT_PRIORITY =
    fields.find((f) => f.name === "priority")?.default || "";
  const DEFAULT_TRANSPORT =
    fields.find((f) => f.name === "transport_type")?.default || "";
  const DEFAULT_PAYMENT =
    fields.find((f) => f.name === "payment_method")?.default || "";
  const DEFAULT_STATUS = fields.find((f) => f.name === "status")?.default || "";

  const makeDefaultDate = (h: number) => {
    const d = new Date();
    d.setHours(h, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  };
  const DEFAULT_START_DATE = makeDefaultDate(8);
  const DEFAULT_DUE_DATE = makeDefaultDate(18);

  const [taskType, setTaskType] = React.useState(DEFAULT_TASK_TYPE);
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState(DEFAULT_PRIORITY);
  const [transportType, setTransportType] = React.useState(DEFAULT_TRANSPORT);
  const [paymentMethod, setPaymentMethod] = React.useState(DEFAULT_PAYMENT);
  const [status, setStatus] = React.useState(DEFAULT_STATUS);
  const [creator, setCreator] = React.useState("");
  const [start, setStart] = React.useState("");
  const [startLink, setStartLink] = React.useState("");
  const [startCoordinates, setStartCoordinates] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [end, setEnd] = React.useState("");
  const [endLink, setEndLink] = React.useState("");
  const [finishCoordinates, setFinishCoordinates] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const types = fields.find((f) => f.name === "task_type")?.options || [];
  const priorities = fields.find((f) => f.name === "priority")?.options || [];
  const transports =
    fields.find((f) => f.name === "transport_type")?.options || [];
  const payments =
    fields.find((f) => f.name === "payment_method")?.options || [];
  const statuses = fields.find((f) => f.name === "status")?.options || [];
  const [users, setUsers] = React.useState<UserBrief[]>([]);
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [distanceKm, setDistanceKm] = React.useState<number | null>(null);
  const [routeLink, setRouteLink] = React.useState("");
  const doneOptions = [
    { value: "full", label: "Задача выполнена полностью" },
    { value: "partial", label: "Задача выполнена частично" },
    { value: "changed", label: "Задача выполнена с изменениями" },
  ];
  const [showDoneSelect, setShowDoneSelect] = React.useState(false);
  // выбранная кнопка действия
  const [selectedAction, setSelectedAction] = React.useState("");
  const titleValue = watch("title");
  const removeAttachment = (a: Attachment) => {
    setAttachments((prev) => prev.filter((p) => p.url !== a.url));
  };

  React.useEffect(() => {
    setEditing(true);
    if (isEdit && id) {
      authFetch(`/api/v1/tasks/${id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) return;
          const t = d.task || d;
          setUsers((p) => {
            const list = [...p];
            const uMap = (d.users || {}) as Record<string, UserBrief>;
            Object.values(uMap).forEach((u) => {
              if (!list.some((v) => v.telegram_id === u.telegram_id))
                list.push(u);
            });
            return list;
          });
          setRequestId(t.task_number || t.request_id);
          setCreated(new Date(t.createdAt).toISOString().slice(0, 10));
          setHistory((t.history as HistoryItem[]) || []);
        });
    } else {
      setCreated(new Date().toISOString().slice(0, 10));
      setHistory([]);
      authFetch("/api/v1/tasks/report/summary")
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((s) => {
          const num = String((s.count || 0) + 1).padStart(6, "0");
          setRequestId(`ERM_${num}`);
        });
      initialRef.current = {
        title: "",
        taskType: DEFAULT_TASK_TYPE,
        description: "",
        comment: "",
        priority: DEFAULT_PRIORITY,
        transportType: DEFAULT_TRANSPORT,
        paymentMethod: DEFAULT_PAYMENT,
        status: DEFAULT_STATUS,
        creator: user ? String(user.telegram_id) : "",
        assignees: [],
        start: "",
        startLink: "",
        end: "",
        endLink: "",
        startDate: DEFAULT_START_DATE,
        dueDate: DEFAULT_DUE_DATE,
        controllers: [],
        attachments: [],
        distanceKm: null,
      };
      reset({
        title: "",
        description: "",
        assignees: [],
        controllers: [],
        startDate: DEFAULT_START_DATE,
        dueDate: DEFAULT_DUE_DATE,
      });
    }
  }, [
    id,
    isEdit,
    user,
    DEFAULT_TASK_TYPE,
    DEFAULT_PRIORITY,
    DEFAULT_TRANSPORT,
    DEFAULT_PAYMENT,
    DEFAULT_STATUS,
    DEFAULT_START_DATE,
    DEFAULT_DUE_DATE,
    reset,
  ]);

  React.useEffect(() => {
    if (isAdmin) {
      authFetch("/api/v1/users")
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          setUsers(list as UserBrief[]);
          if (user) setCreator(String((user as UserBrief).telegram_id));
        });
    } else if (user) {
      setCreator(String((user as UserBrief).telegram_id));
      setUsers([user as UserBrief]);
    }
  }, [user, isAdmin]);

  React.useEffect(() => {
    if (!isEdit || !id) return;
    authFetch(`/api/v1/tasks/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const t = d.task || d;
        const curTaskType = t.task_type || DEFAULT_TASK_TYPE;
        const curPriority = t.priority || DEFAULT_PRIORITY;
        const curTransport = t.transport_type || DEFAULT_TRANSPORT;
        const curPayment = t.payment_method || DEFAULT_PAYMENT;
        const curStatus = t.status || DEFAULT_STATUS;
        const formValues = {
          title: t.title || "",
          description: t.task_description || "",
          assignees: t.assignees || [],
          controllers: t.controllers || [],
          startDate: t.start_date
            ? new Date(t.start_date).toISOString().slice(0, 16)
            : "",
          dueDate: t.due_date
            ? new Date(t.due_date).toISOString().slice(0, 16)
            : "",
        };
        reset(formValues);
        setTaskType(curTaskType);
        setComment(t.comment || "");
        setPriority(curPriority);
        setTransportType(curTransport);
        setPaymentMethod(curPayment);
        setStatus(curStatus);
        setCreator(String(t.created_by || ""));
        setStart(t.start_location || "");
        setStartLink(t.start_location_link || "");
        setEnd(t.end_location || "");
        setEndLink(t.end_location_link || "");
        setAttachments((t.attachments as Attachment[]) || []);
        setUsers((p) => {
          const list = [...p];
          Object.values(d.users || {}).forEach((u) => {
            if (!list.some((v) => v.telegram_id === u.telegram_id))
              list.push(u);
          });
          return list;
        });
        setDistanceKm(
          typeof t.route_distance_km === "number" ? t.route_distance_km : null,
        );
        initialRef.current = {
          title: formValues.title,
          taskType: curTaskType,
          description: formValues.description,
          comment: t.comment || "",
          priority: curPriority,
          transportType: curTransport,
          paymentMethod: curPayment,
          status: curStatus,
          creator: String(t.created_by || ""),
          assignees: formValues.assignees,
          start: t.start_location || "",
          startLink: t.start_location_link || "",
          end: t.end_location || "",
          endLink: t.end_location_link || "",
          startDate: formValues.startDate,
          dueDate: formValues.dueDate,
          controllers: formValues.controllers,
          attachments: t.attachments || [],
          distanceKm:
            typeof t.route_distance_km === "number"
              ? t.route_distance_km
              : null,
        };
      });
  }, [
    id,
    isEdit,
    DEFAULT_TASK_TYPE,
    DEFAULT_PRIORITY,
    DEFAULT_TRANSPORT,
    DEFAULT_PAYMENT,
    DEFAULT_STATUS,
    reset,
  ]);

  const handleStartLink = async (v: string) => {
    setStartLink(v);
    const url = validateURL(v);
    // Разрешены только ссылки с протоколом HTTP(S)
    if (url && /^(https?:\/\/)/i.test(url)) {
      let link = url;
      if (/^https?:\/\/maps\.app\.goo\.gl\//i.test(url)) {
        const data = await expandLink(url);
        if (data) {
          link = data.url;
        }
      }
      setStart(parseGoogleAddress(link));
      setStartCoordinates(extractCoords(link));
      setStartLink(link);
    } else {
      setStart("");
      setStartCoordinates(null);
      setStartLink("");
    }
  };

  const handleEndLink = async (v: string) => {
    setEndLink(v);
    const url = validateURL(v);
    if (url) {
      let link = url;
      if (/^https?:\/\/maps\.app\.goo\.gl\//i.test(url)) {
        const data = await expandLink(url);
        if (data) {
          link = data.url;
        }
      }
      setEnd(parseGoogleAddress(link));
      setFinishCoordinates(extractCoords(link));
      setEndLink(link);
    } else {
      setEnd("");
      setFinishCoordinates(null);
    }
  };

  React.useEffect(() => {
    if (startCoordinates && finishCoordinates) {
      setRouteLink(createRouteLink(startCoordinates, finishCoordinates));
      fetchRoute(startCoordinates, finishCoordinates).then((r) => {
        if (r) {
          setDistanceKm(Number((r.distance / 1000).toFixed(1)));
        }
      });
    } else {
      setDistanceKm(null);
      setRouteLink("");
    }
  }, [startCoordinates, finishCoordinates]);

  const submit = handleSubmit(async (formData) => {
    const payload: { [key: string]: any } = {
      title: formData.title,
      task_type: taskType,
      task_description: formData.description,
      comment,
      priority,
      transport_type: transportType,
      payment_method: paymentMethod,
      status,
      created_by: creator,
      assignees: formData.assignees,
      controllers: formData.controllers,
      start_location: start,
      start_location_link: startLink,
      end_location: end,
      end_location_link: endLink,
      start_date: formData.startDate || DEFAULT_START_DATE,
      due_date: formData.dueDate || DEFAULT_DUE_DATE,
    };
    if (startCoordinates) payload.startCoordinates = startCoordinates;
    if (finishCoordinates) payload.finishCoordinates = finishCoordinates;
    if (distanceKm !== null) payload.route_distance_km = distanceKm;
    if (routeLink) payload.google_route_url = routeLink;
    let data;
    const sendPayload = { ...payload, attachments };
    if (isEdit && id) {
      data = await updateTask(id, sendPayload);
    } else {
      data = await createTask(sendPayload);
    }
    if (data && data._id) {
      authFetch(`/api/v1/tasks/${data._id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            const t = d.task || d;
            reset({
              title: t.title || "",
              description: t.task_description || "",
              assignees: t.assignees || [],
              controllers: t.controllers || [],
              startDate: t.start_date
                ? new Date(t.start_date).toISOString().slice(0, 16)
                : "",
              dueDate: t.due_date
                ? new Date(t.due_date).toISOString().slice(0, 16)
                : "",
            });
            setCreator(String(t.created_by || ""));
            setAttachments((t.attachments as Attachment[]) || []);
            setUsers((p) => {
              const list = [...p];
              Object.values(d.users || {}).forEach((u) => {
                if (!list.some((v) => v.telegram_id === u.telegram_id))
                  list.push(u);
              });
              return list;
            });
          }
        });
    }
    if (data) window.alert(isEdit ? "Задача обновлена" : "Задача создана");
    if (data && onSave) onSave(data);
    setAttachments([]);
  });

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("Вы точно хотите удалить задачу?")) return;
    await deleteTask(id);
    if (onSave) onSave(null);
    onClose();
    window.alert("Задача удалена");
  };

  const resetForm = () => {
    const d = initialRef.current;
    if (!d) return;
    reset({
      title: d.title,
      description: d.description,
      assignees: d.assignees,
      controllers: d.controllers,
      startDate: d.startDate,
      dueDate: d.dueDate,
    });
    setTaskType(d.taskType);
    setComment(d.comment);
    setPriority(d.priority);
    setTransportType(d.transportType);
    setPaymentMethod(d.paymentMethod);
    setStatus(d.status);
    setCreator(d.creator);
    setStart(d.start);
    setStartLink(d.startLink);
    setEnd(d.end);
    setEndLink(d.endLink);
    setAttachments(d.attachments as Attachment[]);
    setDistanceKm(d.distanceKm);
  };

  const acceptTask = async () => {
    if (!id) return;
    const data = await updateTask(id, { status: "В работе" });
    if (data) {
      setStatus("В работе");
      if (onSave) onSave(data);
    }
    await updateTaskStatus(id, "В работе");
    setSelectedAction("accept");
  };

  const completeTask = async (opt: string) => {
    if (!id) return;
    const data = await updateTask(id, {
      status: "Выполнена",
      completed_at: new Date().toISOString(),
      completion_result: opt,
    });
    if (data) {
      setStatus("Выполнена");
      if (onSave) onSave(data);
    }
    setShowDoneSelect(false);
    await updateTaskStatus(id, "Выполнена");
    setSelectedAction("done");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div
        className={`w-full ${expanded ? "max-w-screen-xl" : "max-w-screen-md"} mx-auto space-y-2 rounded-xl bg-white p-4 shadow-lg`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Задача</h3>
          <div className="flex space-x-2">
            {isEdit && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="p-1"
                title="Редактировать"
              >
                ✎
              </button>
            )}
            <button onClick={resetForm} className="p-1" title="Сбросить">
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1"
              title="Развернуть"
            >
              {expanded ? (
                <ArrowsPointingInIcon className="h-5 w-5" />
              ) : (
                <ArrowsPointingOutIcon className="h-5 w-5" />
              )}
            </button>
            <button onClick={onClose} className="p-1" title="Закрыть">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Номер задачи</label>
              <input
                value={requestId}
                disabled
                className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-lg border bg-gray-100 px-3 py-2 text-sm focus:ring focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Дата создания</label>
              <input
                value={created}
                disabled
                className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-lg border bg-gray-100 px-3 py-2 text-sm focus:ring focus:outline-none"
              />
            </div>
          </div>
          {isEdit && history.length > 0 && (
            <button
              type="button"
              className="btn-red mt-2 rounded-full"
              onClick={() => setShowHistory(true)}
            >
              История изменений
            </button>
          )}
          <div>
            <label className="block text-sm font-medium">Название задачи</label>
            <input
              {...register("title")}
              placeholder="Название"
              className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-lg border bg-gray-100 px-3 py-2 text-sm focus:ring focus:outline-none"
              disabled={!editing}
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Дата начала</label>
              <input
                type="datetime-local"
                {...register("startDate")}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                Срок выполнения
              </label>
              <input
                type="datetime-local"
                {...register("dueDate")}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Статус</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Приоритет</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Тип задачи</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Задачу создал</label>
              <select
                value={creator}
                onChange={(e) => setCreator(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                <option value="">автор</option>
                {users.map((u) => (
                  <option key={u.telegram_id} value={u.telegram_id}>
                    {u.name || u.telegram_username || u.username}
                  </option>
                ))}
              </select>
            </div>
            <Controller
              name="assignees"
              control={control}
              render={({ field }) => (
                <MultiUserSelect
                  label="Исполнител(и)ь"
                  users={users}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!editing}
                />
              )}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Старт точка</label>
              {startLink ? (
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col">
                    <a
                      href={DOMPurify.sanitize(startLink)}
                      target="_blank"
                      rel="noopener"
                      className="text-accentPrimary underline"
                    >
                      {start || "ссылка"}
                    </a>
                    {startCoordinates && (
                      <span className="text-xs text-gray-600">
                        {startCoordinates.lat},{startCoordinates.lng}
                      </span>
                    )}
                  </div>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => handleStartLink("")}
                      className="text-red-600"
                    >
                      ✖
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex space-x-2">
                  <input
                    value={startLink}
                    onChange={(e) => handleStartLink(e.target.value)}
                    placeholder="Ссылка из Google Maps"
                    className="flex-1 rounded border px-2 py-1"
                    disabled={!editing}
                  />
                  <a
                    href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                    target="_blank"
                    rel="noopener"
                    className="btn-blue rounded-2xl px-3"
                  >
                    Карта
                  </a>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">
                Финальная точка
              </label>
              {endLink ? (
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col">
                    <a
                      href={DOMPurify.sanitize(endLink)}
                      target="_blank"
                      rel="noopener"
                      className="text-accentPrimary underline"
                    >
                      {end || "ссылка"}
                    </a>
                    {finishCoordinates && (
                      <span className="text-xs text-gray-600">
                        {finishCoordinates.lat},{finishCoordinates.lng}
                      </span>
                    )}
                  </div>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => handleEndLink("")}
                      className="text-red-600"
                    >
                      ✖
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-1 flex space-x-2">
                  <input
                    value={endLink}
                    onChange={(e) => handleEndLink(e.target.value)}
                    placeholder="Ссылка из Google Maps"
                    className="flex-1 rounded border px-2 py-1"
                    disabled={!editing}
                  />
                  <a
                    href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                    target="_blank"
                    rel="noopener"
                    className="btn-blue rounded-2xl px-3"
                  >
                    Карта
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">
                Тип транспорта
              </label>
              <select
                value={transportType}
                onChange={(e) => setTransportType(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                {transports.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Способ оплаты</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded border px-2 py-1"
                disabled={!editing}
              >
                {payments.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {distanceKm !== null && (
              <div>
                <label className="block text-sm font-medium">Расстояние</label>
                <p>{distanceKm} км</p>
              </div>
            )}
            {routeLink && (
              <div>
                <label className="block text-sm font-medium">Маршрут</label>
                <a
                  href={routeLink}
                  target="_blank"
                  rel="noopener"
                  className="text-accentPrimary underline"
                >
                  ссылка
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">🔨 Задача</label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <CKEditorPopup
                  value={field.value}
                  onChange={field.onChange}
                  readOnly={!editing}
                />
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Комментарий</label>
            <CKEditorPopup
              value={comment}
              onChange={setComment}
              readOnly={!editing}
            />
          </div>
          <Controller
            name="controllers"
            control={control}
            render={({ field }) => (
              <MultiUserSelect
                label="Контролёр"
                users={users}
                value={field.value}
                onChange={field.onChange}
                disabled={!editing}
              />
            )}
          />
          {attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium">Вложения</label>
              <ul className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <li key={a.url} className="flex items-center gap-2">
                    {/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.url) ? (
                      <img src={a.url} alt={a.name} className="h-16 rounded" />
                    ) : (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener"
                        className="text-accentPrimary underline"
                      >
                        {a.name}
                      </a>
                    )}
                    <button
                      type="button"
                      className="text-red-500"
                      onClick={() => removeAttachment(a)}
                    >
                      Удалить
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <FileUploader
            disabled={!editing || !titleValue.trim()}
            onUploaded={(a) => setAttachments((p) => [...p, a])}
            onRemove={(a) => removeAttachment(a)}
          />
          <div className="flex justify-end space-x-2">
            {isEdit && isAdmin && editing && (
              <button className="btn-red rounded-full" onClick={handleDelete}>
                Удалить
              </button>
            )}
            {editing && (
              <button
                className="btn-blue rounded-full"
                onClick={() => {
                  if (
                    window.confirm(
                      isEdit ? "Сохранить изменения?" : "Создать задачу?",
                    )
                  ) {
                    submit();
                  }
                }}
              >
                {isEdit ? "Сохранить" : "Создать"}
              </button>
            )}
          </div>
          {isEdit && !editing && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className={`rounded-lg btn-${status === "В работе" ? "green" : "blue"} ${selectedAction === "accept" ? "ring-accentPrimary ring-2" : ""}`}
                  onClick={acceptTask}
                >
                  Принять
                </button>
                <button
                  className={`rounded-lg btn-${status === "Выполнена" ? "green" : "blue"} ${selectedAction === "done" ? "ring-accentPrimary ring-2" : ""}`}
                  onClick={() => setShowDoneSelect((v) => !v)}
                >
                  Выполнено
                </button>
              </div>
              {showDoneSelect && (
                <select
                  onChange={(e) =>
                    e.target.value && completeTask(e.target.value)
                  }
                  className="mt-1 mb-2 w-full rounded border px-2 py-1"
                >
                  <option value="">Выберите вариант</option>
                  {doneOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </>
      </div>
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded border-2 border-red-500 bg-white p-4">
            <h4 className="mb-2 font-semibold">История изменений</h4>
            <ul className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {new Date(h.changed_at).toLocaleString()}
                  </span>
                  <pre className="break-all whitespace-pre-wrap">
                    {JSON.stringify(h.changes)}
                  </pre>
                </li>
              ))}
            </ul>
            <button
              className="btn-blue mt-2 rounded-lg"
              onClick={() => setShowHistory(false)}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
