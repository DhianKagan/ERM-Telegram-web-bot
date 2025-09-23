// Общая форма создания и редактирования задач
// Модули: React, DOMPurify, контексты, сервисы задач, shared, EmployeeLink и логов
import React from "react";
import DOMPurify from "dompurify";
import CKEditorPopup from "./CKEditorPopup";
import MultiUserSelect from "./MultiUserSelect";
import ConfirmDialog from "./ConfirmDialog";
import AlertDialog from "./AlertDialog";
import { useAuth } from "../context/useAuth";
import { useTranslation } from "react-i18next";
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
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import fetchRoute from "../services/route";
import createRouteLink from "../utils/createRouteLink";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import FileUploader from "./FileUploader";
import Spinner from "./Spinner";
import type { Attachment, HistoryItem, UserBrief } from "../types/task";
import type { Task } from "shared";
import EmployeeLink from "./EmployeeLink";

interface Props {
  onClose: () => void;
  onSave?: (data: Task | null) => void;
  id?: string;
}

interface InitialValues {
  title: string;
  taskType: string;
  description: string;
  comment: string;
  priority: string;
  transportType: string;
  paymentMethod: string;
  status: string;
  creator: string;
  assignees: string[];
  start: string;
  startLink: string;
  end: string;
  endLink: string;
  startDate: string;
  dueDate: string;
  attachments: Attachment[];
  distanceKm: number | null;
  cargoLength: string;
  cargoWidth: string;
  cargoHeight: string;
  cargoVolume: string;
  cargoWeight: string;
  showDimensions: boolean;
}

const historyDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const normalizePriorityOption = (value?: string | null) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return /^бессроч/i.test(trimmed) ? "До выполнения" : trimmed;
};

const parseMetricInput = (value: string): number | null => {
  const normalized = value.trim().replace(/\s+/g, "").replace(/,/g, ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed >= 0 ? parsed : null;
};

const formatMetricValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
};

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? "" : fromNumber.toISOString();
  }
  if (value && typeof value === "object" && "$date" in (value as Record<string, unknown>)) {
    const raw = (value as Record<string, unknown>).$date;
    return typeof raw === "string" ? raw : "";
  }
  if (typeof value === "string") return value;
  return "";
};

const normalizeHistory = (raw: unknown): HistoryItem[] => {
  if (!raw) return [];
  const source = Array.isArray(raw)
    ? raw
    : typeof raw === "object"
    ? Object.values(raw as Record<string, unknown>)
    : [];
  return source
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === "object")
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const changes = toRecord(record.changes);
      const from = toRecord(changes.from);
      const to = toRecord(changes.to);
      const changedByRaw = record.changed_by;
      const changedBy =
        typeof changedByRaw === "number"
          ? changedByRaw
          : Number(changedByRaw) || 0;
      return {
        changed_at: toIsoString(record.changed_at),
        changed_by: changedBy,
        changes: { from, to },
      } satisfies HistoryItem;
    })
    .sort((a, b) => {
      const aTime = Date.parse(a.changed_at);
      const bTime = Date.parse(b.changed_at);
      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return bTime - aTime;
    });
};

const formatHistoryDate = (value: string): string => {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value || "";
  return historyDateFormatter.format(new Date(parsed));
};

const formatHistoryValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return historyDateFormatter.format(value);
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const hasDimensionValues = (
  length: string,
  width: string,
  height: string,
  volume: string,
  weight: string,
) =>
  [length, width, height, volume, weight].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );

export default function TaskDialog({ onClose, onSave, id }: Props) {
  const isEdit = Boolean(id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canEditAll = isAdmin || user?.role === "manager";
  const { t } = useTranslation();
  const [editing, setEditing] = React.useState(true);
  const initialRef = React.useRef<InitialValues | null>(null);
  const [requestId, setRequestId] = React.useState("");
  const [created, setCreated] = React.useState("");
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const taskSchema = z
    .object({
      title: z.string().min(1, t("titleRequired")),
      description: z.string().optional(),
      assignees: z.array(z.string()).default([]),
      startDate: z.string().optional(),
      dueDate: z.string().optional(),
    })
    .refine(
      (d) =>
        !d.startDate ||
        !d.dueDate ||
        new Date(d.dueDate) >= new Date(d.startDate),
      {
        message: t("dueBeforeStart"),
        path: ["dueDate"],
      },
    );
  type TaskFormValues = z.infer<typeof taskSchema>;
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
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
  const DEFAULT_DUE_DATE = new Date(
    new Date(DEFAULT_START_DATE).getTime() + 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 16);

  const [dueOffset, setDueOffset] = React.useState(24 * 60 * 60 * 1000);
  const startDateValue = watch("startDate");

  // При изменении даты начала автоматически пересчитываем срок
  React.useEffect(() => {
    if (!startDateValue) return;
    const newDue = new Date(new Date(startDateValue).getTime() + dueOffset)
      .toISOString()
      .slice(0, 16);
    setValue("dueDate", newDue);
  }, [startDateValue, dueOffset, setValue]);

  // Позволяет вручную редактировать срок и запоминает смещение
  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setValue("dueDate", value);
    if (startDateValue) {
      setDueOffset(
        new Date(value).getTime() - new Date(startDateValue).getTime(),
      );
    }
  };

  const [taskType, setTaskType] = React.useState(DEFAULT_TASK_TYPE);
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState(DEFAULT_PRIORITY);
  const [transportType, setTransportType] = React.useState(DEFAULT_TRANSPORT);
  const [paymentMethod, setPaymentMethod] = React.useState(DEFAULT_PAYMENT);
  const [status, setStatus] = React.useState(DEFAULT_STATUS);
  const [cargoLength, setCargoLength] = React.useState("");
  const [cargoWidth, setCargoWidth] = React.useState("");
  const [cargoHeight, setCargoHeight] = React.useState("");
  const [cargoVolume, setCargoVolume] = React.useState("");
  const [cargoWeight, setCargoWeight] = React.useState("");
  const [showDimensions, setShowDimensions] = React.useState(false);
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
    { value: "full", label: t("doneFull") },
    { value: "partial", label: t("donePartial") },
    { value: "changed", label: t("doneChanged") },
  ];
  const [showDoneSelect, setShowDoneSelect] = React.useState(false);
  // выбранная кнопка действия
  const [selectedAction, setSelectedAction] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const { ref: titleFieldRef, ...titleFieldRest } = register("title");
  const titleValue = watch("title");
  const titleRef = React.useRef<HTMLTextAreaElement | null>(null);
  const handleTitleRef = React.useCallback(
    (node: HTMLTextAreaElement | null) => {
      titleRef.current = node;
      titleFieldRef(node);
    },
    [titleFieldRef],
  );
  React.useEffect(() => {
    const node = titleRef.current;
    if (!node) return;
    node.style.height = "";
    node.style.height = `${node.scrollHeight}px`;
  }, [titleValue]);
  const resolveUserName = React.useCallback(
    (id: number) => {
      const person = users.find((u) => u.telegram_id === id);
      return (
        person?.name ||
        person?.telegram_username ||
        person?.username ||
        String(id)
      );
    },
    [users],
  );
  const removeAttachment = (a: Attachment) => {
    setAttachments((prev) => prev.filter((p) => p.url !== a.url));
  };

  const applyTaskDetails = React.useCallback(
    (
      taskData: Partial<Task> & Record<string, unknown>,
      usersMap?: Record<string, UserBrief>,
    ) => {
      const curTaskType = (taskData.task_type as string) || DEFAULT_TASK_TYPE;
      const curPriority =
        normalizePriorityOption(taskData.priority as string) || DEFAULT_PRIORITY;
      const curTransport =
        (taskData.transport_type as string) || DEFAULT_TRANSPORT;
      const curPayment =
        (taskData.payment_method as string) || DEFAULT_PAYMENT;
      const curStatus = (taskData.status as string) || DEFAULT_STATUS;
      const assignees = Array.isArray(taskData.assignees)
        ? (taskData.assignees as (string | number)[]).map(String)
        : [];
      const startDate = taskData.start_date
        ? new Date(taskData.start_date as string)
            .toISOString()
            .slice(0, 16)
        : "";
      const dueDate = taskData.due_date
        ? new Date(taskData.due_date as string)
            .toISOString()
            .slice(0, 16)
        : "";
      const diff =
        startDate && dueDate
          ? new Date(dueDate).getTime() - new Date(startDate).getTime()
          : 24 * 60 * 60 * 1000;
      setDueOffset(diff);
      reset({
        title: (taskData.title as string) || "",
        description: (taskData.task_description as string) || "",
        assignees,
        startDate,
        dueDate,
      });
      setTaskType(curTaskType);
      setComment((taskData.comment as string) || "");
      setPriority(curPriority);
      setTransportType(curTransport);
      setPaymentMethod(curPayment);
      setStatus(curStatus);
      const lengthValue = formatMetricValue(taskData.cargo_length_m);
      const widthValue = formatMetricValue(taskData.cargo_width_m);
      const heightValue = formatMetricValue(taskData.cargo_height_m);
      const weightValue = formatMetricValue(taskData.cargo_weight_kg);
      const volumeValue =
        typeof taskData.cargo_volume_m3 === "number"
          ? String(taskData.cargo_volume_m3)
          : formatMetricValue(taskData.cargo_volume_m3);
      setCargoLength(lengthValue);
      setCargoWidth(widthValue);
      setCargoHeight(heightValue);
      setCargoWeight(weightValue);
      setCargoVolume(volumeValue);
      const hasDims = hasDimensionValues(
        lengthValue,
        widthValue,
        heightValue,
        volumeValue,
        weightValue,
      );
      setShowDimensions(hasDims);
      setCreator(String((taskData.created_by as unknown) || ""));
      setStart((taskData.start_location as string) || "");
      setStartLink((taskData.start_location_link as string) || "");
      setEnd((taskData.end_location as string) || "");
      setEndLink((taskData.end_location_link as string) || "");
      setAttachments(((taskData.attachments as Attachment[]) || []) as Attachment[]);
      if (usersMap) {
        setUsers((prev) => {
          const list = [...prev];
          Object.values(usersMap).forEach((userItem) => {
            if (!list.some((u) => u.telegram_id === userItem.telegram_id)) {
              list.push(userItem);
            }
          });
          return list;
        });
      }
      setDistanceKm(
        typeof taskData.route_distance_km === "number"
          ? taskData.route_distance_km
          : null,
      );
      initialRef.current = {
        title: (taskData.title as string) || "",
        taskType: curTaskType,
        description: (taskData.task_description as string) || "",
        comment: (taskData.comment as string) || "",
        priority: curPriority,
        transportType: curTransport,
        paymentMethod: curPayment,
        status: curStatus,
        creator: String((taskData.created_by as unknown) || ""),
        assignees,
        start: (taskData.start_location as string) || "",
        startLink: (taskData.start_location_link as string) || "",
        end: (taskData.end_location as string) || "",
        endLink: (taskData.end_location_link as string) || "",
        startDate,
        dueDate,
        attachments: ((taskData.attachments as Attachment[]) || []) as Attachment[],
        distanceKm:
          typeof taskData.route_distance_km === "number"
            ? taskData.route_distance_km
            : null,
        cargoLength: lengthValue,
        cargoWidth: widthValue,
        cargoHeight: heightValue,
        cargoVolume: volumeValue,
        cargoWeight: weightValue,
        showDimensions: hasDims,
      };
    },
    [
      DEFAULT_TASK_TYPE,
      DEFAULT_PRIORITY,
      DEFAULT_TRANSPORT,
      DEFAULT_PAYMENT,
      DEFAULT_STATUS,
      reset,
    ],
  );

  const handleDimensionsToggle = (checked: boolean) => {
    if (!checked) {
      setCargoLength("");
      setCargoWidth("");
      setCargoHeight("");
      setCargoVolume("");
      setCargoWeight("");
    }
    setShowDimensions(checked);
  };

  React.useEffect(() => {
    const lengthValue = parseMetricInput(cargoLength);
    const widthValue = parseMetricInput(cargoWidth);
    const heightValue = parseMetricInput(cargoHeight);
    if (
      lengthValue !== null &&
      widthValue !== null &&
      heightValue !== null
    ) {
      const computed = lengthValue * widthValue * heightValue;
      if (Number.isFinite(computed)) {
        const formatted = computed.toFixed(3);
        if (formatted !== cargoVolume) setCargoVolume(formatted);
      } else if (cargoVolume !== '') {
        setCargoVolume('');
      }
      return;
    }
    if (
      (cargoLength.trim() || cargoWidth.trim() || cargoHeight.trim()) &&
      cargoVolume !== ''
    ) {
      setCargoVolume('');
    }
  }, [cargoLength, cargoWidth, cargoHeight, cargoVolume]);

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
          setHistory(normalizeHistory(t.history));
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
        attachments: [],
        distanceKm: null,
        cargoLength: "",
        cargoWidth: "",
        cargoHeight: "",
        cargoVolume: "",
        cargoWeight: "",
        showDimensions: false,
      };
      reset({
        title: "",
        description: "",
        assignees: [],
        startDate: DEFAULT_START_DATE,
        dueDate: DEFAULT_DUE_DATE,
      });
      setCargoLength("");
      setCargoWidth("");
      setCargoHeight("");
      setCargoVolume("");
      setCargoWeight("");
      setShowDimensions(false);
      setDueOffset(24 * 60 * 60 * 1000);
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
    if (canEditAll) {
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
  }, [user, canEditAll]);

  React.useEffect(() => {
    if (!isEdit || !id) return;
    authFetch(`/api/v1/tasks/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        const t = d.task || d;
        applyTaskDetails(t, d.users as Record<string, UserBrief>);
      });
  }, [id, isEdit, applyTaskDetails]);

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
    try {
      const payload: Record<string, unknown> = {
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
        start_location: start,
        start_location_link: startLink,
        end_location: end,
        end_location_link: endLink,
        start_date: formData.startDate || DEFAULT_START_DATE,
        due_date: formData.dueDate || DEFAULT_DUE_DATE,
      };
      const lengthValue = parseMetricInput(cargoLength);
      const widthValue = parseMetricInput(cargoWidth);
      const heightValue = parseMetricInput(cargoHeight);
      const weightValue = parseMetricInput(cargoWeight);
      const volumeValue =
        lengthValue !== null && widthValue !== null && heightValue !== null
          ? lengthValue * widthValue * heightValue
          : parseMetricInput(cargoVolume);
      if (lengthValue !== null) payload.cargo_length_m = lengthValue;
      else if (isEdit) payload.cargo_length_m = "";
      if (widthValue !== null) payload.cargo_width_m = widthValue;
      else if (isEdit) payload.cargo_width_m = "";
      if (heightValue !== null) payload.cargo_height_m = heightValue;
      else if (isEdit) payload.cargo_height_m = "";
      if (volumeValue !== null) payload.cargo_volume_m3 = volumeValue;
      else if (isEdit) payload.cargo_volume_m3 = "";
      if (weightValue !== null) payload.cargo_weight_kg = weightValue;
      else if (isEdit) payload.cargo_weight_kg = "";
      if (startCoordinates) payload.startCoordinates = startCoordinates;
      if (finishCoordinates) payload.finishCoordinates = finishCoordinates;
      if (distanceKm !== null) payload.route_distance_km = distanceKm;
      if (routeLink) payload.google_route_url = routeLink;
      const sendPayload = { ...payload, attachments };
      let savedTask: (Partial<Task> & Record<string, unknown>) | null = null;
      let savedId = id || "";
      if (isEdit && id) {
        const response = await updateTask(id, sendPayload);
        if (!response.ok) throw new Error("SAVE_FAILED");
        const updated = (await response.json()) as
          | (Partial<Task> & Record<string, unknown>)
          | null;
        savedTask = updated;
        savedId = (updated?._id as string) || id;
      } else {
        const created = await createTask(sendPayload);
        if (!created) throw new Error("SAVE_FAILED");
        savedTask = created as Partial<Task> & Record<string, unknown>;
        savedId =
          ((created as Record<string, unknown>)._id as string) ||
          ((created as Record<string, unknown>).id as string) ||
          savedId;
      }
      let detail: {
        task?: Record<string, unknown>;
        users?: Record<string, UserBrief>;
      } | null = null;
      if (savedId) {
        try {
          detail = await authFetch(`/api/v1/tasks/${savedId}`).then((r) =>
            r.ok ? r.json() : null,
          );
        } catch {
          detail = null;
        }
      }
      const taskData = (detail?.task || detail || savedTask) as
        | (Partial<Task> & Record<string, unknown>)
        | null;
      if (taskData) {
        applyTaskDetails(taskData, detail?.users as Record<string, UserBrief> | undefined);
        const createdAtRaw =
          (taskData.createdAt as string | undefined) ||
          ((detail?.task as Record<string, unknown>)?.createdAt as string | undefined);
        if (createdAtRaw) {
          const createdDate = new Date(createdAtRaw);
          if (!Number.isNaN(createdDate.getTime())) {
            setCreated(createdDate.toISOString().slice(0, 10));
          }
        }
        const detailTask = detail?.task as Record<string, unknown> | undefined;
        if (detailTask?.history) {
          setHistory(normalizeHistory(detailTask.history));
        }
        const requestLabel =
          (detailTask?.task_number as string | undefined) ||
          (detailTask?.request_id as string | undefined) ||
          (taskData.task_number as string | undefined) ||
          (taskData.request_id as string | undefined);
        if (requestLabel) setRequestId(requestLabel);
      }
      setAlertMsg(isEdit ? t("taskUpdated") : t("taskCreated"));
      if (taskData && onSave) onSave(taskData as Task);
    } catch (e) {
      console.error(e);
      setAlertMsg(t("taskSaveFailed"));
    } finally {
      setIsSubmitting(false);
    }
  });

  const [alertMsg, setAlertMsg] = React.useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = React.useState(false);
  const [showDoneConfirm, setShowDoneConfirm] = React.useState(false);
  const [pendingDoneOption, setPendingDoneOption] = React.useState("");

  const handleDelete = async () => {
    if (!id) return;
    await deleteTask(id);
    if (onSave) onSave(null);
    onClose();
    setAlertMsg(t("taskDeleted"));
  };

  const resetForm = () => {
    const d = initialRef.current;
    if (!d) return;
    reset({
      title: d.title,
      description: d.description,
      assignees: d.assignees,
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
    setCargoLength(d.cargoLength);
    setCargoWidth(d.cargoWidth);
    setCargoHeight(d.cargoHeight);
    setCargoVolume(d.cargoVolume);
    setCargoWeight(d.cargoWeight);
    setStart(d.start);
    setStartLink(d.startLink);
    setEnd(d.end);
    setEndLink(d.endLink);
    setAttachments(d.attachments as Attachment[]);
    setDistanceKm(d.distanceKm);
    setShowDimensions(d.showDimensions);
  };

  const acceptTask = async () => {
    if (!id) return;
    const prev = status;
    setStatus("В работе");
    const [data] = await Promise.all([
      updateTask(id, { status: "В работе" }).then((r) =>
        r.ok ? r.json() : null,
      ),
      updateTaskStatus(id, "В работе"),
    ]);
    if (data) {
      if (onSave) onSave(data);
    } else {
      setStatus(prev);
      setAlertMsg(t("taskSaveFailed"));
    }
    setSelectedAction("accept");
  };

  const completeTask = async (opt: string) => {
    if (!id) return;
    const prev = status;
    setStatus("Выполнена");
    const [data] = await Promise.all([
      updateTask(id, {
        status: "Выполнена",
        completed_at: new Date().toISOString(),
        completion_result: opt,
      }).then((r) => (r.ok ? r.json() : null)),
      updateTaskStatus(id, "Выполнена"),
    ]);
    if (data) {
      if (onSave) onSave(data);
    } else {
      setStatus(prev);
      setAlertMsg(t("taskSaveFailed"));
    }
    setShowDoneSelect(false);
    setSelectedAction("done");
  };

  const creatorId = Number(creator);
  const hasCreator = Number.isFinite(creatorId) && creator.trim().length > 0;
  const creatorName = hasCreator ? resolveUserName(creatorId) : "";
  const headerLabel = React.useMemo(() => {
    const parts: string[] = [t("task")];
    if (requestId) parts.push(requestId);
    if (created) parts.push(created);
    return parts.join(" ").trim();
  }, [created, requestId, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
      <div className="relative mx-auto w-full max-w-screen-md space-y-4 rounded-xl bg-white p-4 shadow-lg">
        <div className="pr-16">
          <h3
            className="text-lg font-semibold leading-snug text-gray-900 break-words sm:whitespace-nowrap sm:overflow-hidden sm:text-ellipsis"
          >
            {headerLabel}
          </h3>
          {hasCreator ? (
            <p className="mt-1 text-sm text-gray-600">
              {t("taskCreatedBy")} {" "}
              <EmployeeLink
                employeeId={creatorId}
                className="font-medium underline decoration-1 underline-offset-2"
              >
                {creatorName}
              </EmployeeLink>
            </p>
          ) : (
            <span className="mt-1 block text-sm text-gray-500">{t("taskCreatorUnknown")}</span>
          )}
        </div>
        <div className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
          {isEdit && !editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-gray-600 transition hover:bg-gray-100"
              title={t("edit")}
              aria-label={t("edit")}
            >
              ✎
            </button>
          )}
          <button
            type="button"
            onClick={resetForm}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            title={t("reset")}
            aria-label={t("reset")}
          >
            <ArrowPathIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100"
            title={t("close")}
            aria-label={t("close")}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <>
          <div>
            <label className="block text-sm font-medium">
              {t("taskTitle")}
            </label>
            <textarea
              {...titleFieldRest}
              ref={handleTitleRef}
              rows={1}
              placeholder={t("title")}
              className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border bg-gray-100 px-2.5 py-1.5 text-[0.95rem] font-semibold focus:outline-none focus:ring min-h-[44px] resize-none sm:text-base"
              disabled={!editing}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
            />
            {errors.title && (
              <p className="text-sm text-red-600">{errors.title.message}</p>
            )}
          </div>
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <div>
              <label className="block text-sm font-medium">
                {t("startDate")}
              </label>
              <input
                type="datetime-local"
                {...register("startDate")}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                disabled={!editing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                {t("dueDate")}
              </label>
              <input
                type="datetime-local"
                {...register("dueDate", { onChange: handleDueDateChange })}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                disabled={!editing}
              />
            </div>
          </div>
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <div>
              <label className="block text-sm font-medium">{t("status")}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
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
              <label className="block text-sm font-medium">
                {t("priority")}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
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
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <div>
              <label className="block text-sm font-medium">
                {t("taskType")}
              </label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
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
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <Controller
              name="assignees"
              control={control}
              render={({ field }) => (
                <MultiUserSelect
                  label={t("assignees")}
                  users={users}
                  value={(field.value || []).map(String)}
                  onChange={(v) => field.onChange(v.map(String))}
                  disabled={!editing}
                />
              )}
            />
          </div>
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <div>
              <label className="block text-sm font-medium">
                {t("startPoint")}
              </label>
              {startLink ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <a
                      href={DOMPurify.sanitize(startLink)}
                      target="_blank"
                      rel="noopener"
                      className="text-accentPrimary underline"
                    >
                      {start || t("link")}
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
                <div className="mt-1 flex gap-2">
                    <input
                      value={startLink}
                      onChange={(e) => handleStartLink(e.target.value)}
                      placeholder={t("googleMapsLink")}
                      className="flex-1 rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      disabled={!editing}
                    />
                  <a
                    href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                    target="_blank"
                    rel="noopener"
                    className="btn-blue rounded-2xl px-3"
                  >
                    {t("map")}
                  </a>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium">
                {t("endPoint")}
              </label>
              {endLink ? (
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <a
                      href={DOMPurify.sanitize(endLink)}
                      target="_blank"
                      rel="noopener"
                      className="text-accentPrimary underline"
                    >
                      {end || t("link")}
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
                <div className="mt-1 flex gap-2">
                    <input
                      value={endLink}
                      onChange={(e) => handleEndLink(e.target.value)}
                      placeholder={t("googleMapsLink")}
                      className="flex-1 rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      disabled={!editing}
                    />
                  <a
                    href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                    target="_blank"
                    rel="noopener"
                    className="btn-blue rounded-2xl px-3"
                  >
                    {t("map")}
                  </a>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            <div>
              <label className="block text-sm font-medium">
                {t("transportType")}
              </label>
              <select
                value={transportType}
                onChange={(e) => setTransportType(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
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
              <label className="block text-sm font-medium">
                {t("paymentMethod")}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
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
          <div className="space-y-3 rounded-md border border-dashed border-gray-300 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showDimensions}
                onChange={(e) => handleDimensionsToggle(e.target.checked)}
                disabled={!editing}
              />
              {t("enterDimensions")}
            </label>
            {showDimensions && (
              <div className="space-y-3">
                <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <div>
                    <label className="block text-sm font-medium">
                      {t("cargoLength")}
                    </label>
                    <input
                      value={cargoLength}
                      onChange={(e) => setCargoLength(e.target.value)}
                      className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!editing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      {t("cargoWidth")}
                    </label>
                    <input
                      value={cargoWidth}
                      onChange={(e) => setCargoWidth(e.target.value)}
                      className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!editing}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      {t("cargoHeight")}
                    </label>
                    <input
                      value={cargoHeight}
                      onChange={(e) => setCargoHeight(e.target.value)}
                      className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!editing}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                  <div>
                    <label className="block text-sm font-medium">
                      {t("cargoVolume")}
                    </label>
                    <input
                      value={cargoVolume}
                      readOnly
                      className="w-full rounded-md border bg-gray-100 px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium">
                      {t("cargoWeight")}
                    </label>
                    <input
                      value={cargoWeight}
                      onChange={(e) => setCargoWeight(e.target.value)}
                      className="w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                      placeholder="0"
                      inputMode="decimal"
                      disabled={!editing}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {distanceKm !== null && (
              <div>
                <label className="block text-sm font-medium">
                  {t("distance")}
                </label>
                <p>
                  {distanceKm} {t("km")}
                </p>
              </div>
            )}
            {routeLink && (
              <div>
                <label className="block text-sm font-medium">
                  {t("route")}
                </label>
                <a
                  href={routeLink}
                  target="_blank"
                  rel="noopener"
                  className="text-accentPrimary underline"
                >
                  {t("link")}
                </a>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium">
              {t("taskSection")}
            </label>
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <CKEditorPopup
                  value={field.value || ""}
                  onChange={field.onChange}
                  readOnly={!editing}
                />
              )}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{t("comment")}</label>
            <CKEditorPopup
              value={comment}
              onChange={setComment}
              readOnly={!editing}
            />
          </div>
          {attachments.length > 0 && (
            <div>
              <label className="block text-sm font-medium">
                {t("attachments")}
              </label>
              <ul className="flex flex-wrap gap-2">
                {attachments.map((a) => (
                  <li key={a.url} className="flex items-center gap-2">
                    {/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.url) ? (
                      <img
                        srcSet={`${a.thumbnailUrl || a.url} 1x, ${a.url} 2x`}
                        sizes="64px"
                        src={a.thumbnailUrl || a.url}
                        alt={a.name}
                        className="h-16 rounded"
                      />
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
                      {t("delete")}
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
          {isEdit && history.length > 0 && (
            <div className="mt-2 flex justify-start">
              <button
                type="button"
                className="btn-red rounded-full"
                onClick={() => setShowHistory(true)}
              >
                {t("history")}
              </button>
            </div>
          )}
          {isEdit && isAdmin && editing && (
            <div className="mt-2 flex justify-start">
              <button
                className="btn-red rounded-full"
                onClick={() => setShowDeleteConfirm(true)}
              >
                {t("delete")}
              </button>
            </div>
          )}
          {editing && (
            <div className="mt-2 flex justify-end">
              <button
                className="btn-blue flex items-center justify-center rounded-full"
                disabled={isSubmitting}
                onClick={() => setShowSaveConfirm(true)}
              >
                {isSubmitting ? <Spinner /> : isEdit ? t("save") : t("create")}
              </button>
              <ConfirmDialog
                open={showSaveConfirm}
                message={
                  isEdit ? t("saveChangesQuestion") : t("createTaskQuestion")
                }
                confirmText={isEdit ? t("save") : t("create")}
                cancelText={t("cancel")}
                onConfirm={() => {
                  setShowSaveConfirm(false);
                  setIsSubmitting(true);
                  submit();
                }}
                onCancel={() => setShowSaveConfirm(false)}
              />
            </div>
          )}
          {isAdmin && (
            <ConfirmDialog
              open={showDeleteConfirm}
              message={t("deleteTaskQuestion")}
              confirmText={t("delete")}
              cancelText={t("cancel")}
              onConfirm={() => {
                setShowDeleteConfirm(false);
                handleDelete();
              }}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          )}
          {isEdit && !editing && (
            <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className={`rounded-lg btn-${status === "В работе" ? "green" : "blue"} ${selectedAction === "accept" ? "ring-accentPrimary ring-2" : ""}`}
                  onClick={() => setShowAcceptConfirm(true)}
                >
                  {t("accept")}
                </button>
                <button
                  className={`rounded-lg btn-${status === "Выполнена" ? "green" : "blue"} ${selectedAction === "done" ? "ring-accentPrimary ring-2" : ""}`}
                  onClick={() => setShowDoneSelect((v) => !v)}
                >
                  {t("done")}
                </button>
              </div>
              {showDoneSelect && (
                <>
                  <select
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) {
                        setPendingDoneOption(v);
                        setShowDoneConfirm(true);
                      }
                    }}
                    className="mt-1 mb-2 w-full rounded-md border px-2.5 py-1.5 text-sm focus:outline-none focus:ring focus:ring-brand-200 focus:border-accentPrimary"
                  >
                    <option value="">{t("selectOption")}</option>
                    {doneOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <ConfirmDialog
                open={showAcceptConfirm}
                message={t("acceptTaskQuestion")}
                confirmText={t("accept")}
                cancelText={t("cancel")}
                onConfirm={() => {
                  setShowAcceptConfirm(false);
                  acceptTask();
                }}
                onCancel={() => setShowAcceptConfirm(false)}
              />
              <ConfirmDialog
                open={showDoneConfirm}
                message={t("completeTaskQuestion")}
                confirmText={t("done")}
                cancelText={t("cancel")}
                onConfirm={() => {
                  setShowDoneConfirm(false);
                  completeTask(pendingDoneOption);
                }}
                onCancel={() => setShowDoneConfirm(false)}
              />
            </>
          )}
        </>
      </div>
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded border-2 border-red-500 bg-white p-4">
            <h4 className="mb-2 font-semibold">{t("history")}</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              {history.map((entry, index) => {
                const timeLabel = formatHistoryDate(entry.changed_at);
                const author = resolveUserName(entry.changed_by);
                const fromState = entry.changes.from || {};
                const toState = entry.changes.to || {};
                const fromStatusRaw = (fromState as Record<string, unknown>)["status"];
                const toStatusRaw = (toState as Record<string, unknown>)["status"];
                const fromStatus = formatHistoryValue(fromStatusRaw);
                const toStatus = formatHistoryValue(toStatusRaw);
                const showStatusChange =
                  fromStatus !== "—" &&
                  toStatus !== "—" &&
                  fromStatus !== toStatus;
                const keys = Array.from(
                  new Set([
                    ...Object.keys(fromState as Record<string, unknown>),
                    ...Object.keys(toState as Record<string, unknown>),
                  ]),
                );
                const keysToRender = showStatusChange
                  ? keys.filter((key) => key !== "status")
                  : keys;
                const hasDetailedChanges = keysToRender.some((key) => {
                  const prevValue = formatHistoryValue(
                    (fromState as Record<string, unknown>)[key],
                  );
                  const nextValue = formatHistoryValue(
                    (toState as Record<string, unknown>)[key],
                  );
                  return prevValue !== nextValue;
                });
                return (
                  <li
                    key={`${entry.changed_at}-${entry.changed_by}-${index}`}
                    className="rounded border border-gray-200 bg-white p-2 shadow-sm"
                  >
                    <div className="flex flex-wrap items-baseline gap-1 text-xs font-medium text-gray-700 sm:text-sm">
                      <span>{timeLabel || "—"}</span>
                      <span className="text-gray-500">{author}</span>
                    </div>
                    {showStatusChange && (
                      <p className="mt-1 text-xs text-gray-700 sm:text-sm">
                        Изменил статус с {fromStatus} на {toStatus}
                      </p>
                    )}
                    {keysToRender.length > 0 && (
                      <ul className="mt-1 space-y-0.5 text-xs text-gray-700 sm:text-sm">
                        {keysToRender.map((key) => {
                          const prevValue = formatHistoryValue(
                            (fromState as Record<string, unknown>)[key],
                          );
                          const nextValue = formatHistoryValue(
                            (toState as Record<string, unknown>)[key],
                          );
                          if (prevValue === nextValue) return null;
                          return (
                            <li
                              key={key}
                              className="flex flex-wrap items-baseline gap-1"
                            >
                              <span className="font-medium text-gray-600">
                                {key}:
                              </span>
                              <span className="text-gray-500 line-through decoration-gray-400">
                                {prevValue}
                              </span>
                              <span className="text-gray-400">→</span>
                              <span className="font-semibold text-gray-900">
                                {nextValue}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {!showStatusChange && !hasDetailedChanges && (
                      <p className="mt-1 text-xs text-gray-500 sm:text-sm">
                        Детали изменений отсутствуют
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            <button
              className="btn-blue mt-2 rounded-lg"
              onClick={() => setShowHistory(false)}
            >
              {t("close")}
            </button>
          </div>
        </div>
      )}
      <AlertDialog
        open={alertMsg !== null}
        message={alertMsg || ""}
        onClose={() => setAlertMsg(null)}
        closeText={t("close")}
      />
    </div>
  );
}
