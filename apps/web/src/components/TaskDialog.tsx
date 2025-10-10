// Общая форма создания и редактирования задач
// Модули: React, ReactDOM, контексты, сервисы задач, shared, EmployeeLink, логирование, coerceTaskId
import React from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CKEditorPopup from "./CKEditorPopup";
import MultiUserSelect from "./MultiUserSelect";
import ConfirmDialog from "./ConfirmDialog";
import AlertDialog from "./AlertDialog";
import { useAuth } from "../context/useAuth";
import { useTranslation } from "react-i18next";
import {
  PROJECT_TIMEZONE,
  PROJECT_TIMEZONE_LABEL,
  taskFields as fields,
} from "shared";
import {
  createTask,
  createRequest,
  updateTask,
  deleteTask,
  updateTaskStatus,
  TaskRequestError,
  fetchRequestExecutors,
} from "../services/tasks";
import authFetch from "../utils/authFetch";
import parseGoogleAddress from "../utils/parseGoogleAddress";
import { validateURL } from "../utils/validation";
import extractCoords from "../utils/extractCoords";
import { expandLink } from "../services/maps";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import fetchRoute from "../services/route";
import createRouteLink from "../utils/createRouteLink";
import {
  useForm,
  Controller,
  type Resolver,
  type FieldErrors,
} from "react-hook-form";
import FileUploader from "./FileUploader";
import Spinner from "./Spinner";
import type { Attachment, HistoryItem, UserBrief } from "../types/task";
import type { Task } from "shared";
import EmployeeLink from "./EmployeeLink";
import useDueDateOffset from "../hooks/useDueDateOffset";
import coerceTaskId from "../utils/coerceTaskId";

interface Props {
  onClose: () => void;
  onSave?: (data: Task | null) => void;
  id?: string;
  kind?: "task" | "request";
}

interface InitialValues {
  title: string;
  taskType: string;
  description: string;
  comment: string;
  priority: string;
  transportType: string;
  paymentMethod: string;
  paymentAmount: string;
  status: string;
  completedAt: string;
  creator: string;
  assigneeId: string;
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
  showLogistics: boolean;
}

const historyDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: PROJECT_TIMEZONE,
});

const formatHistoryInstant = (date: Date): string =>
  `${historyDateFormatter.format(date).replace(", ", " ")} ${PROJECT_TIMEZONE_LABEL}`;

const creatorBadgeClass =
  "inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2.5 py-1 text-sm font-semibold text-indigo-900 no-underline transition-colors hover:bg-indigo-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-indigo-400/20 dark:text-indigo-100 dark:hover:bg-indigo-400/30 dark:focus-visible:ring-indigo-200";

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

const REQUEST_TYPE_NAME = "Заявка";

const detectTaskKind = (
  task?: Partial<Task> & Record<string, unknown>,
): "task" | "request" => {
  if (!task) return "task";
  const rawKind =
    typeof task.kind === "string" ? task.kind.trim().toLowerCase() : "";
  if (rawKind === "request") return "request";
  const typeValue =
    typeof task.task_type === "string" ? task.task_type.trim() : "";
  return typeValue === REQUEST_TYPE_NAME ? "request" : "task";
};

const currencyFormatter = new Intl.NumberFormat("uk-UA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const parseCurrencyInput = (value: string): number | null => {
  if (!value.trim()) return 0;
  const sanitized = value.replace(/\s*грн\.?/gi, "").trim();
  const parsed = parseMetricInput(sanitized);
  if (parsed === null) return null;
  if (!Number.isFinite(parsed)) return null;
  return Number(parsed.toFixed(2));
};

const formatCurrencyDisplay = (value: unknown): string => {
  if (value === null || value === undefined) return currencyFormatter.format(0);
  if (typeof value === "number") return currencyFormatter.format(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return currencyFormatter.format(0);
    const parsed = parseCurrencyInput(trimmed);
    if (parsed === null) {
      const sanitized = trimmed.replace(/\s*грн\.?/gi, "").trim();
      return sanitized || currencyFormatter.format(0);
    }
    return currencyFormatter.format(parsed);
  }
  return currencyFormatter.format(0);
};

const formatCreatedLabel = (value: string): string => {
  if (!value) return "";
  const parsed = parseIsoDate(value);
  if (!parsed) return value;
  return formatHistoryInstant(parsed);
};

const parseIsoDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatCoords = (coords: { lat: number; lng: number } | null): string => {
  if (!coords) return "";
  const lat = Number.isFinite(coords.lat)
    ? coords.lat.toFixed(6)
    : String(coords.lat);
  const lng = Number.isFinite(coords.lng)
    ? coords.lng.toFixed(6)
    : String(coords.lng);
  return `${lat}, ${lng}`;
};

const sanitizeLocationLink = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const normalized = validateURL(value);
  if (!normalized) {
    return "";
  }
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
};

const toIsoString = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") {
    const fromNumber = new Date(value);
    return Number.isNaN(fromNumber.getTime()) ? "" : fromNumber.toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "$date" in (value as Record<string, unknown>)
  ) {
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
    .filter(
      (entry): entry is Record<string, unknown> =>
        entry !== null && typeof entry === "object",
    )
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
  return formatHistoryInstant(new Date(parsed));
};

const formatHistoryValue = (value: unknown): string => {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return formatHistoryInstant(value);
  if (typeof value === "string") {
    const parsed = parseIsoDate(value);
    return parsed ? formatHistoryInstant(parsed) : value;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
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

const START_OFFSET_MS = 60 * 60 * 1000;
const ACCESS_TASK_DELETE = 8;

export default function TaskDialog({ onClose, onSave, id, kind }: Props) {
  const [resolvedTaskId, setResolvedTaskId] = React.useState<string | null>(
    () => id ?? null,
  );
  const commitResolvedTaskId = React.useCallback(
    (candidate?: string | null) => {
      setResolvedTaskId((prev) => {
        const canonical = coerceTaskId(candidate);
        if (canonical) return canonical;
        if (prev) return prev;
        return candidate ?? null;
      });
    },
    [],
  );
  const effectiveTaskId = React.useMemo(
    () =>
      coerceTaskId(resolvedTaskId ?? id ?? null) ??
      resolvedTaskId ??
      id ??
      null,
    [resolvedTaskId, id],
  );
  const isEdit = Boolean(effectiveTaskId);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const canDeleteTask =
    typeof user?.access === "number" &&
    (user.access & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE;
  const canEditAll = isAdmin || user?.role === "manager";
  const { t: rawT } = useTranslation();
  const initialKind = React.useMemo(() => kind ?? "task", [kind]);
  const [entityKind, setEntityKind] = React.useState<"task" | "request">(
    initialKind,
  );
  const adaptTaskText = React.useCallback(
    (input: string): string => {
      if (entityKind !== "request") return input;
      const replacements: [RegExp, string][] = [
        [/\bЗадачи\b/g, "Заявки"],
        [/\bзадачи\b/g, "заявки"],
        [/\bЗадачу\b/g, "Заявку"],
        [/\bзадачу\b/g, "заявку"],
        [/\bЗадаче\b/g, "Заявке"],
        [/\bзадаче\b/g, "заявке"],
        [/\bЗадачей\b/g, "Заявкой"],
        [/\bзадачей\b/g, "заявкой"],
        [/\bЗадача\b/g, "Заявка"],
        [/\bзадача\b/g, "заявка"],
      ];
      return replacements.reduce(
        (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
        input,
      );
    },
    [entityKind],
  );
  const t = React.useCallback(
    (...args: Parameters<typeof rawT>): string =>
      adaptTaskText(String(rawT(...args))),
    [rawT, adaptTaskText],
  );
  React.useEffect(() => {
    if (kind && kind !== entityKind) {
      setEntityKind(kind);
    }
  }, [kind, entityKind]);
  const [editing, setEditing] = React.useState(true);
  const initialRef = React.useRef<InitialValues | null>(null);
  const hasAutofilledAssignee = React.useRef(false);
  const [initialDates, setInitialDates] = React.useState<{
    start: string;
    due: string;
  }>({ start: "", due: "" });
  const [requestId, setRequestId] = React.useState("");
  const [created, setCreated] = React.useState("");
  const [completedAt, setCompletedAt] = React.useState("");
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = React.useState(false);
  const dialogTitleId = React.useId();
  type TaskFormValues = {
    title: string;
    description?: string;
    assigneeId: string;
    startDate?: string;
    dueDate?: string;
  };
  const taskFormResolver = React.useCallback<Resolver<TaskFormValues>>(
    async (values) => {
      const normalizedTitle =
        typeof values.title === "string" ? values.title.trim() : "";
      const normalizedDescription =
        typeof values.description === "string" ? values.description : "";
      const normalizedAssignee =
        typeof values.assigneeId === "string" ? values.assigneeId.trim() : "";
      const normalizedStartRaw =
        typeof values.startDate === "string" ? values.startDate.trim() : "";
      const normalizedDueRaw =
        typeof values.dueDate === "string" ? values.dueDate.trim() : "";
      const normalized: TaskFormValues = {
        title: normalizedTitle,
        description: normalizedDescription,
        assigneeId: normalizedAssignee,
        startDate: normalizedStartRaw || undefined,
        dueDate: normalizedDueRaw || undefined,
      };
      const fieldErrors: FieldErrors<TaskFormValues> = {};
      if (!normalizedTitle) {
        fieldErrors.title = {
          type: "required",
          message: t("titleRequired"),
        };
      }
      if (!normalizedAssignee) {
        fieldErrors.assigneeId = {
          type: "required",
          message: t("assigneeRequiredError"),
        };
      }
      if (normalized.startDate && normalized.dueDate) {
        const startTime = new Date(normalized.startDate).getTime();
        const dueTime = new Date(normalized.dueDate).getTime();
        if (
          Number.isFinite(startTime) &&
          Number.isFinite(dueTime) &&
          dueTime < startTime
        ) {
          fieldErrors.dueDate = {
            type: "validate",
            message: t("dueBeforeStart"),
          };
        }
      }
      return {
        values: Object.keys(fieldErrors).length ? {} : normalized,
        errors: fieldErrors,
      };
    },
    [t],
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: taskFormResolver,
    defaultValues: {
      title: "",
      description: "",
      assigneeId: user ? String(user.telegram_id) : "",
      startDate: "",
      dueDate: "",
    },
  });
  const resetRef = React.useRef(reset);
  React.useEffect(() => {
    resetRef.current = reset;
  }, [reset]);
  const stableReset = React.useCallback(
    (...args: Parameters<typeof reset>) => resetRef.current(...args),
    [],
  );
  const RAW_DEFAULT_TASK_TYPE =
    fields.find((f) => f.name === "task_type")?.default || "";
  const DEFAULT_PRIORITY =
    fields.find((f) => f.name === "priority")?.default || "";
  const DEFAULT_TRANSPORT =
    fields.find((f) => f.name === "transport_type")?.default || "";
  const DEFAULT_PAYMENT =
    fields.find((f) => f.name === "payment_method")?.default || "";
  const DEFAULT_PAYMENT_AMOUNT =
    fields.find((f) => f.name === "payment_amount")?.default || "0";
  const DEFAULT_STATUS = fields.find((f) => f.name === "status")?.default || "";
  const { requestTypeOptions, taskTypeOptions } = React.useMemo(() => {
    const source = fields.find((f) => f.name === "task_type")?.options || [];
    return {
      requestTypeOptions: source.filter((type) => type === REQUEST_TYPE_NAME),
      taskTypeOptions: source.filter((type) => type !== REQUEST_TYPE_NAME),
    };
  }, [fields]);
  const DEFAULT_REQUEST_TYPE = requestTypeOptions[0] ?? REQUEST_TYPE_NAME;
  const DEFAULT_TASK_TYPE =
    RAW_DEFAULT_TASK_TYPE && RAW_DEFAULT_TASK_TYPE !== REQUEST_TYPE_NAME
      ? RAW_DEFAULT_TASK_TYPE
      : (taskTypeOptions[0] ?? "");

  const formatInputDate = React.useCallback((value: Date) => {
    const year = value.getFullYear();
    const month = `${value.getMonth() + 1}`.padStart(2, "0");
    const day = `${value.getDate()}`.padStart(2, "0");
    const hours = `${value.getHours()}`.padStart(2, "0");
    const minutes = `${value.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }, []);
  const formatIsoForInput = React.useCallback(
    (value: string) => {
      if (!value) return "";
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) {
        return "";
      }
      return formatInputDate(parsed);
    },
    [formatInputDate],
  );
  const parseIsoDateMemo = React.useCallback(parseIsoDate, []);
  const DEFAULT_DUE_OFFSET_MS = 5 * 60 * 60 * 1000;

  const computeDefaultDates = React.useCallback(
    (base?: Date) => {
      const reference = base ? new Date(base) : new Date();
      const plannedStart = new Date(reference.getTime() + START_OFFSET_MS);
      const dueReference = new Date(
        plannedStart.getTime() + DEFAULT_DUE_OFFSET_MS,
      );
      return {
        start: formatInputDate(plannedStart),
        due: formatInputDate(dueReference),
      };
    },
    [formatInputDate, DEFAULT_DUE_OFFSET_MS],
  );

  const startDateValue = watch("startDate");
  const dueDateValue = watch("dueDate");
  const assigneeValue = watch("assigneeId");
  const shouldAutoSyncDueDate = React.useMemo(() => {
    if (!startDateValue) return false;
    if (!isEdit) return true;
    const currentDue = typeof dueDateValue === "string" ? dueDateValue : "";
    const initialDue = initialDates.due;
    if (!initialDue) {
      return currentDue.trim().length === 0;
    }
    return currentDue === initialDue;
  }, [startDateValue, isEdit, dueDateValue, initialDates.due]);
  const { setDueOffset, handleDueDateChange } = useDueDateOffset({
    startDateValue,
    setValue,
    defaultOffsetMs: DEFAULT_DUE_OFFSET_MS,
    formatInputDate,
    autoSync: shouldAutoSyncDueDate,
  });

  const [taskType, setTaskType] = React.useState(
    initialKind === "request" ? DEFAULT_REQUEST_TYPE : DEFAULT_TASK_TYPE,
  );
  const [comment, setComment] = React.useState("");
  const [priority, setPriority] = React.useState(DEFAULT_PRIORITY);
  const [transportType, setTransportType] = React.useState(DEFAULT_TRANSPORT);
  const [paymentMethod, setPaymentMethod] = React.useState(DEFAULT_PAYMENT);
  const [paymentAmount, setPaymentAmount] = React.useState(() =>
    formatCurrencyDisplay(DEFAULT_PAYMENT_AMOUNT),
  );
  const [status, setStatus] = React.useState(DEFAULT_STATUS);
  const [cargoLength, setCargoLength] = React.useState("");
  const [cargoWidth, setCargoWidth] = React.useState("");
  const [cargoHeight, setCargoHeight] = React.useState("");
  const [cargoVolume, setCargoVolume] = React.useState("");
  const [cargoWeight, setCargoWeight] = React.useState("");
  const [showLogistics, setShowLogistics] = React.useState(false);
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
  const canonicalStartLink = React.useMemo(
    () => sanitizeLocationLink(startLink),
    [startLink],
  );
  const canonicalEndLink = React.useMemo(
    () => sanitizeLocationLink(endLink),
    [endLink],
  );
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
  const [startDateNotice, setStartDateNotice] = React.useState<string | null>(
    null,
  );
  const fetchedTaskIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const { body, documentElement } = document;
    const previousOverflow = body.style.overflow;
    const previousPaddingRight = body.style.paddingRight;
    const scrollbarWidth =
      typeof window !== "undefined"
        ? window.innerWidth - documentElement.clientWidth
        : 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPaddingRight;
    };
  }, []);
  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);
  React.useEffect(() => {
    if (!id) return;
    commitResolvedTaskId(id);
  }, [id, commitResolvedTaskId]);
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
  React.useEffect(() => {
    if (!isEdit && entityKind === "request") {
      setTaskType(DEFAULT_REQUEST_TYPE);
    }
  }, [DEFAULT_REQUEST_TYPE, entityKind, isEdit]);
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
      const detectedKind = detectTaskKind(taskData);
      setEntityKind(detectedKind);
      const rawTaskType =
        typeof taskData.task_type === "string" ? taskData.task_type : "";
      const normalizedTaskType = (() => {
        if (detectedKind === "request") {
          if (rawTaskType === REQUEST_TYPE_NAME) {
            return rawTaskType;
          }
          return DEFAULT_REQUEST_TYPE;
        }
        if (rawTaskType && taskTypeOptions.includes(rawTaskType)) {
          return rawTaskType;
        }
        return DEFAULT_TASK_TYPE;
      })();
      const curPriority =
        normalizePriorityOption(taskData.priority as string) ||
        DEFAULT_PRIORITY;
      const curTransport =
        (taskData.transport_type as string) || DEFAULT_TRANSPORT;
      const curPayment = (taskData.payment_method as string) || DEFAULT_PAYMENT;
      const amountValue = formatCurrencyDisplay(
        (taskData.payment_amount as unknown) ?? DEFAULT_PAYMENT_AMOUNT,
      );
      const curStatus = (taskData.status as string) || DEFAULT_STATUS;
      const rawCompleted =
        (taskData as Record<string, unknown>).completed_at ??
        (taskData as Record<string, unknown>).completedAt;
      const curCompletedAt = toIsoString(rawCompleted);
      const rawAssignee = Array.isArray(taskData.assignees)
        ? (taskData.assignees as (string | number | null | undefined)[])[0]
        : (taskData as Record<string, unknown>).assigned_user_id;
      const assigneeId = (() => {
        if (rawAssignee === null || rawAssignee === undefined) return "";
        if (typeof rawAssignee === "string") {
          const trimmed = rawAssignee.trim();
          return trimmed.length > 0 ? trimmed : "";
        }
        return String(rawAssignee);
      })();
      const rawCreated =
        ((taskData as Record<string, unknown>).createdAt as
          | string
          | undefined) ||
        created ||
        "";
      const createdDateValue = parseIsoDateMemo(rawCreated);
      if (createdDateValue) {
        setCreated(createdDateValue.toISOString());
      }
      const startCandidate = parseIsoDateMemo(
        (taskData.start_date as string | undefined) ?? null,
      );
      const normalizedStartDate = createdDateValue
        ? startCandidate &&
          startCandidate.getTime() >= createdDateValue.getTime()
          ? startCandidate
          : createdDateValue
        : startCandidate;
      const startDate = normalizedStartDate
        ? formatInputDate(normalizedStartDate)
        : createdDateValue
          ? formatInputDate(createdDateValue)
          : "";
      const dueCandidate = parseIsoDateMemo(
        (taskData.due_date as string | undefined) ?? null,
      );
      const normalizedDueDate =
        normalizedStartDate && dueCandidate
          ? dueCandidate.getTime() >= normalizedStartDate.getTime()
            ? dueCandidate
            : normalizedStartDate
          : dueCandidate;
      const dueDate = normalizedDueDate
        ? formatInputDate(normalizedDueDate)
        : normalizedStartDate
          ? formatInputDate(
              new Date(normalizedStartDate.getTime() + DEFAULT_DUE_OFFSET_MS),
            )
          : "";
      const diff =
        startDate && dueDate
          ? new Date(dueDate).getTime() - new Date(startDate).getTime()
          : DEFAULT_DUE_OFFSET_MS;
      setDueOffset(diff);
      setInitialDates({ start: startDate, due: dueDate });
      stableReset({
        title: (taskData.title as string) || "",
        description: (taskData.task_description as string) || "",
        assigneeId,
        startDate,
        dueDate,
      });
      hasAutofilledAssignee.current = true;
      setTaskType(normalizedTaskType);
      setComment((taskData.comment as string) || "");
      setPriority(curPriority);
      setTransportType(curTransport);
      setPaymentMethod(curPayment);
      setPaymentAmount(amountValue);
      setStatus(curStatus);
      setCompletedAt(curCompletedAt);
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
      const startLocationValue = (taskData.start_location as string) || "";
      const endLocationValue = (taskData.end_location as string) || "";
      const startLocationLinkRaw =
        (taskData.start_location_link as string) || "";
      const endLocationLinkRaw = (taskData.end_location_link as string) || "";
      const startLocationLink = sanitizeLocationLink(startLocationLinkRaw);
      const endLocationLink = sanitizeLocationLink(endLocationLinkRaw);
      const distanceValue =
        typeof taskData.route_distance_km === "number"
          ? taskData.route_distance_km
          : null;
      const rawLogisticsEnabled = (taskData as Record<string, unknown>)
        .logistics_enabled;
      const hasLogisticsData = Boolean(
        startLocationValue ||
          endLocationValue ||
          startLocationLink ||
          endLocationLink ||
          distanceValue !== null ||
          curTransport !== DEFAULT_TRANSPORT ||
          hasDims,
      );
      const logisticsEnabled =
        typeof rawLogisticsEnabled === "boolean"
          ? rawLogisticsEnabled
          : hasLogisticsData;
      setShowLogistics(logisticsEnabled);
      setCreator(String((taskData.created_by as unknown) || ""));
      setStart(startLocationValue);
      setStartLink(startLocationLink);
      setStartCoordinates(
        startLocationLink ? extractCoords(startLocationLink) : null,
      );
      setEnd(endLocationValue);
      setEndLink(endLocationLink);
      setFinishCoordinates(
        endLocationLink ? extractCoords(endLocationLink) : null,
      );
      setAttachments(
        ((taskData.attachments as Attachment[]) || []) as Attachment[],
      );
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
      setDistanceKm(distanceValue);
      initialRef.current = {
        title: (taskData.title as string) || "",
        taskType: normalizedTaskType,
        description: (taskData.task_description as string) || "",
        comment: (taskData.comment as string) || "",
        priority: curPriority,
        transportType: curTransport,
        paymentMethod: curPayment,
        paymentAmount: amountValue,
        status: curStatus,
        completedAt: curCompletedAt,
        creator: String((taskData.created_by as unknown) || ""),
        assigneeId,
        start: (taskData.start_location as string) || "",
        startLink: startLocationLink,
        end: (taskData.end_location as string) || "",
        endLink: endLocationLink,
        startDate,
        dueDate,
        attachments: ((taskData.attachments as Attachment[]) ||
          []) as Attachment[],
        distanceKm: typeof distanceValue === "number" ? distanceValue : null,
        cargoLength: lengthValue,
        cargoWidth: widthValue,
        cargoHeight: heightValue,
        cargoVolume: volumeValue,
        cargoWeight: weightValue,
        showLogistics: logisticsEnabled,
      };
      setStartDateNotice(null);
      commitResolvedTaskId(
        ((taskData as Record<string, unknown>)._id as string | undefined) ??
          ((taskData as Record<string, unknown>).id as string | undefined) ??
          null,
      );
    },
    [
      DEFAULT_TASK_TYPE,
      DEFAULT_PRIORITY,
      DEFAULT_TRANSPORT,
      DEFAULT_PAYMENT,
      DEFAULT_PAYMENT_AMOUNT,
      DEFAULT_STATUS,
      DEFAULT_DUE_OFFSET_MS,
      DEFAULT_REQUEST_TYPE,
      taskTypeOptions,
      created,
      formatInputDate,
      parseIsoDateMemo,
      stableReset,
      setDueOffset,
      setInitialDates,
      commitResolvedTaskId,
    ],
  );

  const handleLogisticsToggle = (checked: boolean) => {
    setShowLogistics(checked);
  };

  React.useEffect(() => {
    const lengthValue = parseMetricInput(cargoLength);
    const widthValue = parseMetricInput(cargoWidth);
    const heightValue = parseMetricInput(cargoHeight);
    if (lengthValue !== null && widthValue !== null && heightValue !== null) {
      const computed = lengthValue * widthValue * heightValue;
      if (Number.isFinite(computed)) {
        const formatted = computed.toFixed(3);
        if (formatted !== cargoVolume) setCargoVolume(formatted);
      } else if (cargoVolume !== "") {
        setCargoVolume("");
      }
      return;
    }
    if (
      (cargoLength.trim() || cargoWidth.trim() || cargoHeight.trim()) &&
      cargoVolume !== ""
    ) {
      setCargoVolume("");
    }
  }, [cargoLength, cargoWidth, cargoHeight, cargoVolume]);

  React.useEffect(() => {
    const targetId = effectiveTaskId;
    setEditing(true);
    if (isEdit && targetId) {
      const canonicalTargetId = coerceTaskId(targetId) ?? targetId;
      if (fetchedTaskIdRef.current === canonicalTargetId) {
        return;
      }
      fetchedTaskIdRef.current = canonicalTargetId;
      authFetch(`/api/v1/tasks/${targetId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d) {
            fetchedTaskIdRef.current = null;
            return;
          }
          const t = d.task || d;
          setUsers((p) => {
            const list = [...p];
            const uMap = (d.users || {}) as Record<string, UserBrief>;
            Object.values(uMap).forEach((u) => {
              if (!list.some((v) => v.telegram_id === u.telegram_id)) {
                list.push(u);
              }
            });
            return list;
          });
          setRequestId(t.task_number || t.request_id);
          const createdSource =
            ((t as Record<string, unknown>).createdAt as unknown) ??
            ((t as Record<string, unknown>).created_at as unknown) ??
            null;
          const createdIso = toIsoString(createdSource);
          const createdDate = parseIsoDateMemo(createdIso);
          if (createdDate) {
            setCreated(createdDate.toISOString());
          } else if (createdIso) {
            setCreated(createdIso);
          } else {
            setCreated((prev) => prev || new Date().toISOString());
          }
          setHistory(normalizeHistory(t.history));
          applyTaskDetails(t, d.users as Record<string, UserBrief>);
          const resolvedId =
            coerceTaskId(
              ((t as Record<string, unknown>)._id as string | undefined) ??
                ((t as Record<string, unknown>).id as string | undefined) ??
                null,
            ) ?? null;
          if (resolvedId) {
            fetchedTaskIdRef.current = resolvedId;
          }
        });
      return;
    }
    fetchedTaskIdRef.current = null;
    setEntityKind(initialKind);
    const createdAt = new Date();
    const { start: defaultStartDate, due: defaultDueDate } =
      computeDefaultDates(createdAt);
    setCreated((prev) => prev || createdAt.toISOString());
    setCompletedAt("");
    setHistory([]);
    setResolvedTaskId(null);
    const summaryUrl =
      initialKind === "request"
        ? "/api/v1/tasks/report/summary?kind=request"
        : "/api/v1/tasks/report/summary";
    authFetch(summaryUrl)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((s) => {
        const num = String((s.count || 0) + 1).padStart(6, "0");
        const prefix = initialKind === "request" ? "REQ" : "ERM";
        setRequestId(`${prefix}_${num}`);
      });
    setPaymentAmount(formatCurrencyDisplay(DEFAULT_PAYMENT_AMOUNT));
    const startInstant = parseIsoDate(defaultStartDate);
    setStartDateNotice(
      startInstant ? formatHistoryInstant(startInstant) : null,
    );
    initialRef.current = {
      title: "",
      taskType:
        initialKind === "request" ? DEFAULT_REQUEST_TYPE : DEFAULT_TASK_TYPE,
      description: "",
      comment: "",
      priority: DEFAULT_PRIORITY,
      transportType: DEFAULT_TRANSPORT,
      paymentMethod: DEFAULT_PAYMENT,
      paymentAmount: formatCurrencyDisplay(DEFAULT_PAYMENT_AMOUNT),
      status: DEFAULT_STATUS,
      completedAt: "",
      creator: user ? String(user.telegram_id) : "",
      assigneeId:
        initialKind === "request" ? "" : user ? String(user.telegram_id) : "",
      start: "",
      startLink: "",
      end: "",
      endLink: "",
      startDate: defaultStartDate,
      dueDate: defaultDueDate,
      attachments: [],
      distanceKm: null,
      cargoLength: "",
      cargoWidth: "",
      cargoHeight: "",
      cargoVolume: "",
      cargoWeight: "",
      showLogistics: false,
    };
    setInitialDates({ start: defaultStartDate, due: defaultDueDate });
    stableReset({
      title: "",
      description: "",
      assigneeId:
        initialKind === "request" ? "" : user ? String(user.telegram_id) : "",
      startDate: defaultStartDate,
      dueDate: defaultDueDate,
    });
    hasAutofilledAssignee.current = false;
    setCargoLength("");
    setCargoWidth("");
    setCargoHeight("");
    setCargoVolume("");
    setCargoWeight("");
    setShowLogistics(false);
    setDueOffset(DEFAULT_DUE_OFFSET_MS);
  }, [
    isEdit,
    effectiveTaskId,
    user,
    DEFAULT_TASK_TYPE,
    DEFAULT_REQUEST_TYPE,
    DEFAULT_PRIORITY,
    DEFAULT_TRANSPORT,
    DEFAULT_PAYMENT,
    DEFAULT_PAYMENT_AMOUNT,
    DEFAULT_STATUS,
    DEFAULT_DUE_OFFSET_MS,
    computeDefaultDates,
    parseIsoDateMemo,
    stableReset,
    setDueOffset,
    setInitialDates,
    applyTaskDetails,
    initialKind,
  ]);

  React.useEffect(() => {
    if (isEdit) {
      if (startDateNotice) {
        setStartDateNotice(null);
      }
      return;
    }
    const initialStart = initialRef.current?.startDate;
    if (!initialStart || !startDateNotice) {
      return;
    }
    if (startDateValue && startDateValue !== initialStart) {
      setStartDateNotice(null);
    }
  }, [isEdit, startDateNotice, startDateValue]);

  React.useEffect(() => {
    if (entityKind === "request") {
      if (user) {
        setCreator(String((user as UserBrief).telegram_id));
      }
      fetchRequestExecutors()
        .then((list) => {
          setUsers(list);
        })
        .catch(() => {
          setUsers([]);
        });
      return;
    }
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
  }, [user, canEditAll, entityKind]);

  React.useEffect(() => {
    if (isEdit) return;
    const current =
      typeof assigneeValue === "string" ? assigneeValue.trim() : "";
    const hasCurrentOption =
      current.length > 0 &&
      users.some((candidate) => String(candidate.telegram_id) === current);
    if (current && hasCurrentOption) {
      hasAutofilledAssignee.current = true;
      return;
    }
    if (hasAutofilledAssignee.current) return;
    const preferred =
      (user &&
        users.find(
          (candidate) => candidate.telegram_id === user.telegram_id,
        )) ||
      users[0];
    if (!preferred) return;
    const candidateId = String(preferred.telegram_id);
    if (!candidateId) return;
    setValue("assigneeId", candidateId, {
      shouldDirty: false,
      shouldTouch: false,
    });
    if (initialRef.current) {
      initialRef.current.assigneeId = candidateId;
    }
    hasAutofilledAssignee.current = true;
  }, [assigneeValue, isEdit, user, users, setValue]);

  const handleStartLink = async (value: string) => {
    setStartLink(value);
    const sanitized = sanitizeLocationLink(value);
    if (!sanitized) {
      setStart("");
      setStartCoordinates(null);
      setStartLink("");
      return;
    }
    let link = sanitized;
    if (/^https?:\/\/maps\.app\.goo\.gl\//i.test(sanitized)) {
      const data = await expandLink(sanitized);
      if (data?.url) {
        link = sanitizeLocationLink(data.url) || sanitized;
      }
    }
    setStart(parseGoogleAddress(link));
    setStartCoordinates(extractCoords(link));
    setStartLink(link);
  };

  const handleEndLink = async (value: string) => {
    setEndLink(value);
    const sanitized = sanitizeLocationLink(value);
    if (!sanitized) {
      setEnd("");
      setFinishCoordinates(null);
      setEndLink("");
      return;
    }
    let link = sanitized;
    if (/^https?:\/\/maps\.app\.goo\.gl\//i.test(sanitized)) {
      const data = await expandLink(sanitized);
      if (data?.url) {
        link = sanitizeLocationLink(data.url) || sanitized;
      }
    }
    setEnd(parseGoogleAddress(link));
    setFinishCoordinates(extractCoords(link));
    setEndLink(link);
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

  const toNumericValue = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const submit = handleSubmit(async (formData) => {
    try {
      const creationDate = parseIsoDate(created);
      if (formData.startDate && creationDate) {
        const parsedStart = parseIsoDate(formData.startDate);
        if (parsedStart) {
          const startMinutes = Math.floor(parsedStart.getTime() / 60000);
          const createdMinutes = Math.floor(creationDate.getTime() / 60000);
          if (startMinutes < createdMinutes) {
            setError("startDate", {
              type: "validate",
              message: t("startBeforeCreated"),
            });
            setAlertMsg(t("startBeforeCreated"));
            return;
          }
        }
      }
      const initialValues = initialRef.current;
      const initialStart = initialValues?.startDate || "";
      const initialDue = initialValues?.dueDate || "";
      const startValue = formData.startDate || "";
      const dueValue = formData.dueDate || "";
      const isNewTask = !isEdit;
      let startInputValue = startValue;
      let dueInputValue = dueValue;
      let shouldSetStart = false;
      let shouldSetDue = false;
      let shouldIncludeStart = false;
      let shouldIncludeDue = false;
      if (isNewTask) {
        const defaults = computeDefaultDates(creationDate ?? undefined);
        const startMatchesInitial =
          Boolean(startValue) &&
          Boolean(initialStart) &&
          startValue === initialStart;
        const startCleared = !startValue && Boolean(initialStart);
        startInputValue = startValue || defaults.start;
        if (startMatchesInitial || (!startValue && !initialStart)) {
          startInputValue = formatInputDate(new Date());
        } else if (startCleared) {
          startInputValue = formatInputDate(new Date());
        }
        const dueMatchesInitial =
          Boolean(dueValue) && Boolean(initialDue) && dueValue === initialDue;
        dueInputValue = dueValue || defaults.due;
        const dueUnchanged = (!dueValue && !initialDue) || dueMatchesInitial;
        if (dueUnchanged) {
          const startMs = new Date(startInputValue).getTime();
          const offset =
            initialStart && initialDue
              ? new Date(initialDue).getTime() -
                new Date(initialStart).getTime()
              : DEFAULT_DUE_OFFSET_MS;
          if (Number.isFinite(startMs)) {
            dueInputValue = formatInputDate(new Date(startMs + offset));
          }
        }
        shouldSetStart = true;
        shouldSetDue = true;
        shouldIncludeStart = true;
        shouldIncludeDue = true;
      } else {
        const startChanged = startValue !== initialStart;
        const dueChanged = dueValue !== initialDue;
        if (!startChanged) {
          startInputValue = initialStart;
        }
        if (!dueChanged) {
          dueInputValue = initialDue;
        }
        if (startChanged) {
          shouldSetStart = true;
          shouldIncludeStart = true;
        }
        if (dueChanged) {
          shouldSetDue = true;
          shouldIncludeDue = true;
        }
      }
      let startMs = Number.NaN;
      let dueMs = Number.NaN;
      if (startInputValue) {
        startMs = new Date(startInputValue).getTime();
      }
      if (dueInputValue) {
        dueMs = new Date(dueInputValue).getTime();
      }
      if (!Number.isNaN(startMs) && !Number.isNaN(dueMs) && dueMs < startMs) {
        dueInputValue = formatInputDate(
          new Date(startMs + DEFAULT_DUE_OFFSET_MS),
        );
        shouldSetDue = true;
        shouldIncludeDue = true;
        dueMs = new Date(dueInputValue).getTime();
      }
      if (!Number.isNaN(startMs) && !Number.isNaN(dueMs)) {
        setDueOffset(dueMs - startMs);
      }
      if (shouldSetStart) {
        setValue("startDate", startInputValue);
      }
      if (shouldSetDue) {
        setValue("dueDate", dueInputValue);
      }
      const assignedRaw =
        typeof formData.assigneeId === "string"
          ? formData.assigneeId.trim()
          : "";
      if (!assignedRaw) {
        setError("assigneeId", {
          type: "required",
          message: t("assigneeRequiredError"),
        });
        setAlertMsg(t("assigneeRequiredError"));
        return;
      }
      const assignedNumeric = toNumericValue(assignedRaw);
      const assignedValue =
        assignedNumeric !== null ? assignedNumeric : assignedRaw;
      const resolvedTaskType =
        entityKind === "request" ? DEFAULT_REQUEST_TYPE : taskType;
      const payload: Record<string, unknown> = {
        title: formData.title,
        task_type: resolvedTaskType,
        task_description: formData.description,
        comment,
        priority,
        transport_type: transportType,
        payment_method: paymentMethod,
        status,
        created_by: toNumericValue(creator),
        assigned_user_id: assignedValue,
        start_location: start,
        start_location_link: startLink,
        end_location: end,
        end_location_link: endLink,
        logistics_enabled: showLogistics,
      };
      if (!isNewTask && payload.created_by === null) {
        delete payload.created_by;
      }
      if (shouldIncludeStart) {
        payload.start_date = startInputValue || "";
      }
      if (shouldIncludeDue) {
        payload.due_date = dueInputValue || "";
      }
      const amountValue = parseCurrencyInput(paymentAmount);
      if (amountValue === null) {
        setAlertMsg(t("paymentAmountInvalid"));
        return;
      }
      payload.payment_amount = amountValue;
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
      const currentTaskId = effectiveTaskId ?? "";
      let savedId = currentTaskId;
      if (isEdit && currentTaskId) {
        const response = await updateTask(currentTaskId, sendPayload);
        if (!response.ok) throw new Error("SAVE_FAILED");
        const updated = (await response.json()) as
          | (Partial<Task> & Record<string, unknown>)
          | null;
        savedTask = updated;
        const updatedIdCandidate =
          ((updated as Record<string, unknown>)._id as string | undefined) ??
          ((updated as Record<string, unknown>).id as string | undefined) ??
          currentTaskId;
        savedId = coerceTaskId(updatedIdCandidate) ?? updatedIdCandidate ?? "";
      } else {
        const created = await (entityKind === "request"
          ? createRequest(sendPayload)
          : createTask(sendPayload));
        if (!created) throw new Error("SAVE_FAILED");
        savedTask = created as Partial<Task> & Record<string, unknown>;
        const createdIdCandidate =
          ((created as Record<string, unknown>)._id as string | undefined) ??
          ((created as Record<string, unknown>).id as string | undefined) ??
          savedId;
        savedId = coerceTaskId(createdIdCandidate) ?? createdIdCandidate ?? "";
      }
      let detail: {
        task?: Record<string, unknown>;
        users?: Record<string, UserBrief>;
      } | null = null;
      if (savedId) {
        commitResolvedTaskId(savedId);
        try {
          const fetchId = coerceTaskId(savedId) ?? savedId;
          detail = await authFetch(`/api/v1/tasks/${fetchId}`).then((r) =>
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
        applyTaskDetails(
          taskData,
          detail?.users as Record<string, UserBrief> | undefined,
        );
        const createdAtRaw =
          (taskData.createdAt as string | undefined) ||
          ((detail?.task as Record<string, unknown>)?.createdAt as
            | string
            | undefined);
        if (createdAtRaw) {
          const createdDate = new Date(createdAtRaw);
          if (!Number.isNaN(createdDate.getTime())) {
            setCreated(createdDate.toISOString());
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
      if (e instanceof TaskRequestError) {
        const reason = e.message.trim();
        setAlertMsg(
          reason
            ? t("taskSaveFailedWithReason", { reason })
            : t("taskSaveFailed"),
        );
      } else if (e instanceof Error && e.message) {
        setAlertMsg(t("taskSaveFailedWithReason", { reason: e.message }));
      } else {
        setAlertMsg(t("taskSaveFailed"));
      }
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
    const targetId = effectiveTaskId;
    if (!targetId) return;
    await deleteTask(targetId);
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
      assigneeId: d.assigneeId,
      startDate: d.startDate,
      dueDate: d.dueDate,
    });
    setTaskType(d.taskType);
    setComment(d.comment);
    setPriority(d.priority);
    setTransportType(d.transportType);
    setPaymentMethod(d.paymentMethod);
    setPaymentAmount(d.paymentAmount);
    setStatus(d.status);
    setCompletedAt(d.completedAt);
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
    setShowLogistics(Boolean(d.showLogistics));
  };

  const acceptTask = async () => {
    const targetId = effectiveTaskId;
    if (!targetId) return;
    const prev = status;
    setStatus("В работе");
    try {
      const [data] = await Promise.all([
        updateTask(targetId, { status: "В работе" }).then((r) =>
          r.ok ? r.json() : null,
        ),
        updateTaskStatus(targetId, "В работе"),
      ]);
      if (data) {
        if (onSave) onSave(data);
      } else {
        setStatus(prev);
        setAlertMsg(t("taskSaveFailed"));
      }
    } catch (error) {
      console.error(error);
      setStatus(prev);
      if (error instanceof TaskRequestError) {
        const reason = error.message.trim();
        setAlertMsg(
          reason
            ? t("taskSaveFailedWithReason", { reason })
            : t("taskSaveFailed"),
        );
      } else if (error instanceof Error && error.message) {
        setAlertMsg(t("taskSaveFailedWithReason", { reason: error.message }));
      } else {
        setAlertMsg(t("taskSaveFailed"));
      }
    } finally {
      setSelectedAction("accept");
    }
  };

  const completeTask = async (opt: string) => {
    const targetId = effectiveTaskId;
    if (!targetId) return;
    const prev = status;
    setStatus("Выполнена");
    try {
      const [data] = await Promise.all([
        updateTask(targetId, {
          status: "Выполнена",
          completed_at: new Date().toISOString(),
          completion_result: opt,
        }).then((r) => (r.ok ? r.json() : null)),
        updateTaskStatus(targetId, "Выполнена"),
      ]);
      if (data) {
        const completedValue = toIsoString(
          (data as Record<string, unknown>)?.completed_at ??
            (data as Record<string, unknown>)?.completedAt,
        );
        const fallbackCompleted = new Date().toISOString();
        setCompletedAt(completedValue || fallbackCompleted);
        if (initialRef.current) {
          initialRef.current.status = "Выполнена";
          initialRef.current.completedAt = completedValue || fallbackCompleted;
        }
        if (onSave) onSave(data);
      } else {
        setStatus(prev);
        setAlertMsg(t("taskSaveFailed"));
      }
    } catch (error) {
      console.error(error);
      setStatus(prev);
      if (error instanceof TaskRequestError) {
        const reason = error.message.trim();
        setAlertMsg(
          reason
            ? t("taskSaveFailedWithReason", { reason })
            : t("taskSaveFailed"),
        );
      } else if (error instanceof Error && error.message) {
        setAlertMsg(t("taskSaveFailedWithReason", { reason: error.message }));
      } else {
        setAlertMsg(t("taskSaveFailed"));
      }
    } finally {
      setShowDoneSelect(false);
      setSelectedAction("done");
    }
  };

  const creatorId = Number(creator);
  const hasCreator = Number.isFinite(creatorId) && creator.trim().length > 0;
  const creatorName = hasCreator ? resolveUserName(creatorId) : "";
  const headerLabel = React.useMemo(() => {
    const parts: string[] = [t("task")];
    if (requestId) parts.push(requestId);
    const createdLabel = created ? formatCreatedLabel(created) : "";
    if (createdLabel) parts.push(createdLabel);
    return parts.join(" ").trim();
  }, [created, requestId, t]);
  const handleBackdropClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={handleBackdropClick}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm"
      />
      <div className="pointer-events-none absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
          <div
            className="pointer-events-auto relative mx-auto w-full max-w-screen-md space-y-4 rounded-xl bg-white p-4 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
          >
            <div className="pr-16">
              <h3
                id={dialogTitleId}
                className="text-lg leading-snug font-semibold break-words text-gray-900 sm:overflow-hidden sm:text-ellipsis sm:whitespace-nowrap"
              >
                {headerLabel}
              </h3>
              {hasCreator ? (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-gray-600">
                  <span>{t("taskCreatedBy")}</span>
                  <EmployeeLink
                    employeeId={creatorId}
                    className={creatorBadgeClass}
                  >
                    {creatorName}
                  </EmployeeLink>
                </div>
              ) : (
                <span className="mt-1 block text-sm text-gray-500">
                  {t("taskCreatorUnknown")}
                </span>
              )}
            </div>
            <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2">
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
              <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                <div>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="task-dialog-start-date"
                  >
                    {t("startDate")}
                  </label>
                  <input
                    id="task-dialog-start-date"
                    type="datetime-local"
                    {...register("startDate")}
                    min={formatIsoForInput(created)}
                    className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                    disabled={!editing}
                  />
                  {!isEdit && startDateNotice ? (
                    <p className="mt-1 text-xs font-medium text-amber-600">
                      {t("startDateAutoNotice", { date: startDateNotice })}
                    </p>
                  ) : null}
                </div>
                <div>
                  <label
                    className="block text-sm font-medium"
                    htmlFor="task-dialog-due-date"
                  >
                    {t("dueDate")}
                  </label>
                  <input
                    id="task-dialog-due-date"
                    type="datetime-local"
                    {...register("dueDate", { onChange: handleDueDateChange })}
                    className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                    disabled={!editing}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("taskTitle")}
                </label>
                <textarea
                  {...titleFieldRest}
                  ref={handleTitleRef}
                  rows={1}
                  placeholder={t("title")}
                  className="focus:ring-brand-200 focus:border-accentPrimary min-h-[44px] w-full resize-none rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[0.95rem] font-semibold focus:ring focus:outline-none sm:text-base"
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
              <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                <div>
                  <label className="block text-sm font-medium">
                    {t("taskType")}
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                    disabled={!editing || entityKind === "request"}
                  >
                    {(entityKind === "request"
                      ? requestTypeOptions
                      : taskTypeOptions
                    ).map((t) => (
                      <option key={t} value={t}>
                        {t}
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
                    className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                    disabled={!editing}
                  >
                    {priorities.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">
                    {t("status")}
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
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
                  <label
                    className="block text-sm font-medium"
                    htmlFor="task-dialog-completed-at"
                  >
                    {t("actualTime")}
                  </label>
                  <input
                    type="datetime-local"
                    id="task-dialog-completed-at"
                    name="completedAtDisplay"
                    value={completedAt ? formatIsoForInput(completedAt) : ""}
                    readOnly
                    placeholder="—"
                    className="w-full rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-sm text-slate-700 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                <Controller
                  name="assigneeId"
                  control={control}
                  render={({ field }) => (
                    <MultiUserSelect
                      label={t("assignees")}
                      users={users}
                      value={
                        typeof field.value === "string" &&
                        field.value.trim().length > 0
                          ? field.value.trim()
                          : null
                      }
                      onChange={(val) => field.onChange(val ?? "")}
                      onBlur={field.onBlur}
                      disabled={!editing}
                      required
                      placeholder={t("assigneeSelectPlaceholder")}
                      hint={
                        !errors.assigneeId ? t("assigneeSelectHint") : undefined
                      }
                      error={errors.assigneeId?.message ?? null}
                    />
                  )}
                />
              </div>
              <div className="space-y-3 rounded-md border border-dashed border-gray-300 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    id="task-show-logistics"
                    name="showLogistics"
                    className="h-4 w-4"
                    checked={showLogistics}
                    onChange={(e) => handleLogisticsToggle(e.target.checked)}
                    disabled={!editing}
                  />
                  {t("logisticsToggle")}
                </label>
                {showLogistics && (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-start-link"
                        >
                          {t("startPoint")}
                        </label>
                        {canonicalStartLink ? (
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <a
                                href={canonicalStartLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accentPrimary underline"
                              >
                                {start || t("link")}
                              </a>
                              {startCoordinates && (
                                <input
                                  id="task-start-coordinates"
                                  name="startCoordinatesDisplay"
                                  value={formatCoords(startCoordinates)}
                                  readOnly
                                  className="focus:ring-brand-200 focus:border-accentPrimary w-full cursor-text rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:ring focus:outline-none"
                                  onFocus={(e) => e.currentTarget.select()}
                                  aria-label={t("coordinates")}
                                />
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
                              id="task-start-link"
                              name="startLink"
                              value={startLink}
                              onChange={(e) => handleStartLink(e.target.value)}
                              placeholder={t("googleMapsLink")}
                              className="focus:ring-brand-200 focus:border-accentPrimary flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                              disabled={!editing}
                            />
                            <a
                              href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                              target="_blank"
                              rel="noopener"
                              className={cn(
                                buttonVariants({
                                  variant: "default",
                                  size: "sm",
                                }),
                                "rounded-2xl px-3",
                              )}
                            >
                              {t("map")}
                            </a>
                          </div>
                        )}
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-end-link"
                        >
                          {t("endPoint")}
                        </label>
                        {canonicalEndLink ? (
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col gap-1">
                              <a
                                href={canonicalEndLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accentPrimary underline"
                              >
                                {end || t("link")}
                              </a>
                              {finishCoordinates && (
                                <input
                                  id="task-end-coordinates"
                                  name="endCoordinatesDisplay"
                                  value={formatCoords(finishCoordinates)}
                                  readOnly
                                  className="focus:ring-brand-200 focus:border-accentPrimary w-full cursor-text rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:ring focus:outline-none"
                                  onFocus={(e) => e.currentTarget.select()}
                                  aria-label={t("coordinates")}
                                />
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
                              id="task-end-link"
                              name="endLink"
                              value={endLink}
                              onChange={(e) => handleEndLink(e.target.value)}
                              placeholder={t("googleMapsLink")}
                              className="focus:ring-brand-200 focus:border-accentPrimary flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                              disabled={!editing}
                            />
                            <a
                              href="https://maps.app.goo.gl/xsiC9fHdunCcifQF6"
                              target="_blank"
                              rel="noopener"
                              className={cn(
                                buttonVariants({
                                  variant: "default",
                                  size: "sm",
                                }),
                                "rounded-2xl px-3",
                              )}
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
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          disabled={!editing}
                        >
                          {transports.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
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
                    <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-cargo-length"
                        >
                          {t("cargoLength")}
                        </label>
                        <input
                          id="task-cargo-length"
                          name="cargoLength"
                          value={cargoLength}
                          onChange={(e) => setCargoLength(e.target.value)}
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          placeholder="0"
                          inputMode="decimal"
                          disabled={!editing}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-cargo-width"
                        >
                          {t("cargoWidth")}
                        </label>
                        <input
                          id="task-cargo-width"
                          name="cargoWidth"
                          value={cargoWidth}
                          onChange={(e) => setCargoWidth(e.target.value)}
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          placeholder="0"
                          inputMode="decimal"
                          disabled={!editing}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-cargo-height"
                        >
                          {t("cargoHeight")}
                        </label>
                        <input
                          id="task-cargo-height"
                          name="cargoHeight"
                          value={cargoHeight}
                          onChange={(e) => setCargoHeight(e.target.value)}
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          placeholder="0"
                          inputMode="decimal"
                          disabled={!editing}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-cargo-volume"
                        >
                          {t("cargoVolume")}
                        </label>
                        <input
                          id="task-cargo-volume"
                          name="cargoVolume"
                          value={cargoVolume}
                          readOnly
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border bg-gray-100 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          placeholder="—"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-cargo-weight"
                        >
                          {t("cargoWeight")}
                        </label>
                        <input
                          id="task-cargo-weight"
                          name="cargoWeight"
                          value={cargoWeight}
                          onChange={(e) => setCargoWeight(e.target.value)}
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          placeholder="0"
                          inputMode="decimal"
                          disabled={!editing}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 md:[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
                      <div>
                        <label className="block text-sm font-medium">
                          {t("paymentMethod")}
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                          disabled={!editing}
                        >
                          {payments.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          className="block text-sm font-medium"
                          htmlFor="task-payment-amount"
                        >
                          {t("paymentAmount")}
                        </label>
                        <div
                          className={`focus-within:border-accentPrimary focus-within:ring-brand-200 flex items-center rounded-md border border-slate-200 bg-slate-50 text-sm transition focus-within:ring ${
                            editing ? "" : "opacity-80"
                          }`}
                        >
                          <input
                            id="task-payment-amount"
                            name="paymentAmount"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            onBlur={(e) =>
                              setPaymentAmount(
                                formatCurrencyDisplay(e.target.value),
                              )
                            }
                            className="flex-1 bg-transparent px-2.5 py-1.5 text-sm focus:outline-none disabled:cursor-not-allowed"
                            placeholder="0"
                            inputMode="decimal"
                            disabled={!editing}
                          />
                          <span className="px-2 text-sm font-semibold text-slate-500">
                            грн
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {t("paymentAmountFormat")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">
                  {t("comment")}
                </label>
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
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-0 text-red-500"
                          onClick={() => removeAttachment(a)}
                        >
                          {t("delete")}
                        </Button>
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
                  <Button
                    type="button"
                    variant="destructive"
                    size="pill"
                    onClick={() => setShowHistory(true)}
                  >
                    {t("history")}
                  </Button>
                </div>
              )}
              {isEdit && canDeleteTask && editing && (
                <div className="mt-2 flex justify-start">
                  <Button
                    variant="destructive"
                    size="pill"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    {t("delete")}
                  </Button>
                </div>
              )}
              {editing && (
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="default"
                    size="pill"
                    disabled={isSubmitting}
                    onClick={() => setShowSaveConfirm(true)}
                  >
                    {isSubmitting ? (
                      <Spinner />
                    ) : isEdit ? (
                      t("save")
                    ) : (
                      t("create")
                    )}
                  </Button>
                  <ConfirmDialog
                    open={showSaveConfirm}
                    message={
                      isEdit
                        ? t("saveChangesQuestion")
                        : t("createTaskQuestion")
                    }
                    confirmText={isEdit ? t("save") : t("create")}
                    cancelText={t("cancel")}
                    onConfirm={async () => {
                      setShowSaveConfirm(false);
                      setIsSubmitting(true);
                      try {
                        await submit();
                      } catch (error) {
                        console.warn("Не удалось сохранить задачу", error);
                        setIsSubmitting(false);
                      }
                    }}
                    onCancel={() => setShowSaveConfirm(false)}
                  />
                </div>
              )}
              {canDeleteTask && (
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
                    <Button
                      className={cn(
                        "rounded-lg",
                        selectedAction === "accept" &&
                          "ring-accentPrimary ring-2",
                      )}
                      variant={status === "В работе" ? "success" : "default"}
                      onClick={() => setShowAcceptConfirm(true)}
                    >
                      {t("accept")}
                    </Button>
                    <Button
                      className={cn(
                        "rounded-lg",
                        selectedAction === "done" &&
                          "ring-accentPrimary ring-2",
                      )}
                      variant={status === "Выполнена" ? "success" : "default"}
                      onClick={() => setShowDoneSelect((v) => !v)}
                    >
                      {t("done")}
                    </Button>
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
                        className="focus:ring-brand-200 focus:border-accentPrimary mt-1 mb-2 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
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
        </div>
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
                const fromStatusRaw = (fromState as Record<string, unknown>)[
                  "status"
                ];
                const toStatusRaw = (toState as Record<string, unknown>)[
                  "status"
                ];
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
            <Button
              className="mt-2 rounded-lg"
              onClick={() => setShowHistory(false)}
            >
              {t("close")}
            </Button>
          </div>
        </div>
      )}
      <AlertDialog
        open={alertMsg !== null}
        message={alertMsg || ""}
        onClose={() => setAlertMsg(null)}
        closeText={t("close")}
      />
    </div>,
    document.body,
  );
}
