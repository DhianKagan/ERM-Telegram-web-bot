// Общая форма создания и редактирования задач
// Модули: React, ReactDOM, контексты, сервисы задач, shared, EmployeeLink, SingleSelect, логирование, coerceTaskId
import React from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/components/ui/button-variants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CKEditorPopup from "./CKEditorPopup";
import MultiUserSelect from "./MultiUserSelect";
import SingleSelect from "./SingleSelect";
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
  fetchTransportOptions,
  fetchTaskDraft,
  saveTaskDraft,
  deleteTaskDraft,
  type TaskDraft,
} from "../services/tasks";
import type {
  TransportDriverOption,
  TransportVehicleOption,
} from "../services/tasks";
import authFetch from "../utils/authFetch";
import parseGoogleAddress from "../utils/parseGoogleAddress";
import { validateURL } from "../utils/validation";
import extractCoords from "../utils/extractCoords";
import {
  expandLink,
  searchAddress as searchMapAddress,
  reverseGeocode as reverseMapGeocode,
  type AddressSuggestion,
} from "../services/maps";
import { ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import fetchRoute from "../services/route";
import haversine from "../utils/haversine";
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
import {
  creatorBadgeClass,
  fallbackBadgeClass as taskFallbackBadgeClass,
  getPriorityBadgeClass,
  getStatusBadgeClass,
  getTypeBadgeClass,
} from "../columns/taskColumns";
import useDueDateOffset from "../hooks/useDueDateOffset";
import coerceTaskId from "../utils/coerceTaskId";
import mapboxgl, {
  type Map as MapInstance,
  type MapMouseEvent,
  type Marker as MapMarker,
} from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  MAPBOX_ACCESS_TOKEN,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS,
  MAP_STYLE_URL,
} from "../config/map";

mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

type TaskKind = "task" | "request";

type MapPickerState = {
  target: "start" | "finish";
  initialCoords: { lat: number; lng: number } | null;
};

const ensureInlineMode = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("blob:") || value.startsWith("data:")) {
    return value;
  }
  if (value.includes("mode=inline")) {
    return value;
  }
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}mode=inline`;
};

interface Props {
  onClose: () => void;
  onSave?: (data: Task | null) => void;
  id?: string;
  kind?: TaskKind;
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
  assigneeIds: number[];
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
  transportDriverId: string;
  transportDriverName: string;
  transportVehicleId: string;
  transportVehicleName: string;
  transportVehicleRegistration: string;
  showLogistics: boolean;
  photosLink?: string | null;
  photosChatId?: unknown;
  photosMessageId?: unknown;
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

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const toAssigneeNumber = (value: unknown): number | null => {
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

const buildTelegramMessageLink = (
  chatId: unknown,
  messageId: unknown,
): string | null => {
  if (chatId === undefined || chatId === null) {
    return null;
  }
  const rawMessageId =
    typeof messageId === "number"
      ? messageId
      : typeof messageId === "string"
        ? Number(messageId.trim())
        : NaN;
  if (!Number.isFinite(rawMessageId) || rawMessageId <= 0) {
    return null;
  }
  const chat =
    typeof chatId === "number"
      ? chatId.toString()
      : typeof chatId === "string"
        ? chatId.trim()
        : "";
  if (!chat) {
    return null;
  }
  if (chat.startsWith("@")) {
    return `https://t.me/${chat.slice(1)}/${rawMessageId}`;
  }
  if (/^-100\d+$/.test(chat)) {
    return `https://t.me/c/${chat.slice(4)}/${rawMessageId}`;
  }
  if (/^\d+$/.test(chat)) {
    return `https://t.me/c/${chat}/${rawMessageId}`;
  }
  return null;
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

const toCoordsValue = (
  value: unknown,
): { lat: number; lng: number } | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { lat?: unknown; lng?: unknown };
  const lat = Number(candidate.lat);
  const lng = Number(candidate.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
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

const buildMapsLink = (coords: { lat: number; lng: number }): string =>
  `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

const MIN_ADDRESS_QUERY_LENGTH = 3;

type MapPickerDialogProps = {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  hint: string;
  initialValue: { lat: number; lng: number } | null;
  onConfirm: (coords: { lat: number; lng: number }) => void;
  onCancel: () => void;
};

const MapPickerDialog: React.FC<MapPickerDialogProps> = ({
  open,
  title,
  confirmLabel,
  cancelLabel,
  hint,
  initialValue,
  onConfirm,
  onCancel,
}) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapInstance | null>(null);
  const markerRef = React.useRef<MapMarker | null>(null);
  const titleId = React.useId();
  const [coords, setCoords] = React.useState<{ lat: number; lng: number } | null>(
    initialValue,
  );

  React.useEffect(() => {
    if (open) {
      setCoords(initialValue ?? null);
    }
  }, [initialValue, open]);

  React.useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;
    const center: [number, number] = initialValue
      ? [initialValue.lng, initialValue.lat]
      : [MAP_DEFAULT_CENTER[1], MAP_DEFAULT_CENTER[0]];
    const map = new mapboxgl.Map({
      container,
      style: MAP_STYLE_URL,
      center,
      zoom: initialValue ? Math.max(MAP_DEFAULT_ZOOM, 12) : MAP_DEFAULT_ZOOM,
      maxBounds: MAP_MAX_BOUNDS,
      minZoom: 3,
    });
    mapRef.current = map;
    const navigation = new mapboxgl.NavigationControl({ showCompass: false });
    map.addControl(navigation, "top-right");

    const applyMarker = (lng: number, lat: number) => {
      const currentMarker = markerRef.current;
      if (!currentMarker) {
        const marker = new mapboxgl.Marker({ draggable: true })
          .setLngLat([lng, lat])
          .addTo(map);
        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setCoords({ lat: lngLat.lat, lng: lngLat.lng });
        });
        markerRef.current = marker;
      } else {
        currentMarker.setLngLat([lng, lat]);
      }
      setCoords({ lat, lng });
      const targetZoom = Math.max(map.getZoom ? map.getZoom() : MAP_DEFAULT_ZOOM, 12);
      if (typeof map.easeTo === "function") {
        map.easeTo({ center: [lng, lat], zoom: targetZoom, duration: 400 });
      }
    };

    if (initialValue) {
      applyMarker(initialValue.lng, initialValue.lat);
    }

    const handleClick = (event: MapMouseEvent) => {
      const { lng, lat } = event.lngLat;
      applyMarker(lng, lat);
    };
    map.on("click", handleClick);

    return () => {
      map.off("click", handleClick);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, [initialValue, open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="map-picker-dialog" role="presentation">
      <button
        type="button"
        className="map-picker-dialog__backdrop"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="map-picker-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="flex items-center justify-between gap-3">
          <h4 id={titleId} className="text-lg font-semibold">
            {title}
          </h4>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={onCancel}
          >
            ×
          </button>
        </header>
        <div ref={containerRef} className="map-picker-dialog__map" />
        <p className="map-picker-dialog__hint">{hint}</p>
        {coords ? (
          <div className="text-sm font-mono text-slate-600">
            {formatCoords(coords)}
          </div>
        ) : null}
        <div className="map-picker-dialog__actions">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (!coords) return;
              onConfirm(coords);
            }}
            disabled={!coords}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
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

const resolveAppOrigin = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.location.origin;
  } catch {
    return null;
  }
};

const isManagedShortLink = (value: string): boolean => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const origin = resolveAppOrigin();
    if (origin && parsed.origin !== origin) {
      return false;
    }
    const segments = parsed.pathname.split("/").filter(Boolean);
    const index = segments.indexOf("l");
    return index !== -1 && index === segments.length - 2 && Boolean(segments[index + 1]);
  } catch {
    return false;
  }
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

const normalizePriorityBadgeLabel = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return /^бессроч/i.test(trimmed) ? "До выполнения" : trimmed;
};

const resolveBadgeKind = (
  rawKey: string,
): "status" | "priority" | "taskType" | null => {
  const key = rawKey.trim().toLowerCase();
  if (key === "status") return "status";
  if (key === "priority" || key === "priority_label" || key === "prioritylabel") {
    return "priority";
  }
  if (key === "task_type" || key === "tasktype" || key === "type") {
    return "taskType";
  }
  return null;
};

const renderTaskBadge = (key: string, value: string): React.ReactNode | null => {
  const kind = resolveBadgeKind(key);
  if (!kind) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === "—") {
    return null;
  }
  if (kind === "status") {
    const className = getStatusBadgeClass(trimmed) ?? taskFallbackBadgeClass;
    return <span className={className}>{trimmed}</span>;
  }
  if (kind === "priority") {
    const className =
      getPriorityBadgeClass(trimmed) ?? `${taskFallbackBadgeClass} normal-case`;
    return <span className={className}>{normalizePriorityBadgeLabel(trimmed)}</span>;
  }
  const className =
    getTypeBadgeClass(trimmed) ?? `${taskFallbackBadgeClass} normal-case`;
  return <span className={className}>{trimmed}</span>;
};

type HistoryBadgeVariant = "plain" | "prev" | "next";

const renderHistoryValueNode = (
  key: string,
  value: string,
  variant: HistoryBadgeVariant,
): React.ReactNode => {
  const normalized = typeof value === "string" ? value : String(value ?? "");
  const trimmed = normalized.trim();
  if (!trimmed || trimmed === "—") {
    if (variant === "prev") {
      return (
        <span className="text-gray-400 line-through decoration-gray-300">—</span>
      );
    }
    return <span className="text-gray-500">—</span>;
  }
  const badge = renderTaskBadge(key, trimmed);
  if (!badge) {
    const className =
      variant === "prev"
        ? "text-gray-500 line-through decoration-gray-400"
        : "font-semibold text-gray-900";
    return <span className={className}>{trimmed}</span>;
  }
  if (variant === "prev") {
    return (
      <span className="inline-flex items-center gap-1 text-gray-500 line-through decoration-gray-400">
        {badge}
      </span>
    );
  }
  if (variant === "next") {
    return (
      <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
        {badge}
      </span>
    );
  }
  return badge;
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
  const normalizedAccess =
    typeof user?.access === "number"
      ? user.access
      : typeof user?.access === "string"
        ? Number.parseInt(user.access, 10)
        : Number.NaN;
  const canDeleteTask =
    Number.isFinite(normalizedAccess) &&
    (normalizedAccess & ACCESS_TASK_DELETE) === ACCESS_TASK_DELETE;
  const canEditAll = isAdmin || user?.role === "manager";
  const { t: rawT, i18n } = useTranslation();
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
  const currentLanguage = i18n.language;
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
    getValues,
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
      assigneeId: "",
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
  }, []);
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

  const watchedDraftValues = watch();
  const startDateValue = watch("startDate");
  const dueDateValue = watch("dueDate");
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
  const [transportDriverId, setTransportDriverId] = React.useState<string>("");
  const [transportDriverName, setTransportDriverName] = React.useState<string>("");
  const [transportVehicleId, setTransportVehicleId] = React.useState<string>("");
  const [transportVehicleName, setTransportVehicleName] = React.useState<string>("");
  const [transportVehicleRegistration, setTransportVehicleRegistration] =
    React.useState<string>("");
  const [transportDriverOptions, setTransportDriverOptions] =
    React.useState<TransportDriverOption[]>([]);
  const [transportVehicleOptions, setTransportVehicleOptions] =
    React.useState<TransportVehicleOption[]>([]);
  const [transportOptionsLoading, setTransportOptionsLoading] =
    React.useState(false);
  const [transportOptionsError, setTransportOptionsError] =
    React.useState<string | null>(null);
  const [transportOptionsLoaded, setTransportOptionsLoaded] =
    React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState(DEFAULT_PAYMENT);
  const [paymentAmount, setPaymentAmount] = React.useState(() =>
    formatCurrencyDisplay(DEFAULT_PAYMENT_AMOUNT),
  );
  const [status, setStatus] = React.useState(DEFAULT_STATUS);
  const [initialStatus, setInitialStatus] = React.useState(DEFAULT_STATUS);
  const [taskAssigneeIds, setTaskAssigneeIds] = React.useState<number[]>([]);
  const [cargoLength, setCargoLength] = React.useState("");
  const [cargoWidth, setCargoWidth] = React.useState("");
  const [cargoHeight, setCargoHeight] = React.useState("");
  const [cargoVolume, setCargoVolume] = React.useState("");
  const [cargoWeight, setCargoWeight] = React.useState("");
  const [showLogistics, setShowLogistics] = React.useState(false);
  const [mapPicker, setMapPicker] = React.useState<MapPickerState | null>(null);
  const [creator, setCreator] = React.useState("");
  const currentUserId =
    typeof user?.telegram_id === "number" ? user.telegram_id : null;
  const creatorNumericId = React.useMemo(() => {
    const parsed = Number(creator);
    return Number.isFinite(parsed) ? parsed : null;
  }, [creator]);
  const isCreator = currentUserId !== null && creatorNumericId === currentUserId;
  const isExecutor = React.useMemo(
    () => currentUserId !== null && taskAssigneeIds.includes(currentUserId),
    [taskAssigneeIds, currentUserId],
  );
  const sameActor = isCreator && isExecutor;
  const isTaskNew = initialStatus === "Новая";
  const canEditTask =
    canEditAll || isExecutor || (isCreator && isTaskNew);
  const canChangeStatus =
    canEditAll ||
    (isExecutor && !sameActor) ||
    ((isCreator || sameActor) && isTaskNew);
  const [start, setStart] = React.useState("");
  const [startLink, setStartLink] = React.useState("");
  const [startCoordinates, setStartCoordinates] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [startSuggestions, setStartSuggestions] = React.useState<
    AddressSuggestion[]
  >([]);
  const [startSuggestionsOpen, setStartSuggestionsOpen] = React.useState(false);
  const [startSearchLoading, setStartSearchLoading] = React.useState(false);
  const [startSearchError, setStartSearchError] = React.useState<string | null>(
    null,
  );
  const startSearchAbortRef = React.useRef<AbortController | null>(null);
  const startSearchTimeoutRef = React.useRef<number | null>(null);
  const startSearchRequestRef = React.useRef(0);
  const startInputRef = React.useRef<HTMLInputElement | null>(null);
  const [end, setEnd] = React.useState("");
  const [endLink, setEndLink] = React.useState("");
  const [finishCoordinates, setFinishCoordinates] = React.useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [finishSuggestions, setFinishSuggestions] = React.useState<
    AddressSuggestion[]
  >([]);
  const [finishSuggestionsOpen, setFinishSuggestionsOpen] = React.useState(false);
  const [finishSearchLoading, setFinishSearchLoading] = React.useState(false);
  const [finishSearchError, setFinishSearchError] = React.useState<string | null>(
    null,
  );
  const finishSearchAbortRef = React.useRef<AbortController | null>(null);
  const finishSearchTimeoutRef = React.useRef<number | null>(null);
  const finishSearchRequestRef = React.useRef(0);
  const finishInputRef = React.useRef<HTMLInputElement | null>(null);
  const cancelStartSearch = React.useCallback(() => {
    startSearchAbortRef.current?.abort();
    startSearchAbortRef.current = null;
    if (startSearchTimeoutRef.current) {
      window.clearTimeout(startSearchTimeoutRef.current);
      startSearchTimeoutRef.current = null;
    }
  }, []);
  const cancelFinishSearch = React.useCallback(() => {
    finishSearchAbortRef.current?.abort();
    finishSearchAbortRef.current = null;
    if (finishSearchTimeoutRef.current) {
      window.clearTimeout(finishSearchTimeoutRef.current);
      finishSearchTimeoutRef.current = null;
    }
  }, []);
  const clearStartSuggestions = React.useCallback(() => {
    setStartSuggestions([]);
    setStartSearchError(null);
    setStartSearchLoading(false);
  }, []);
  const clearFinishSuggestions = React.useCallback(() => {
    setFinishSuggestions([]);
    setFinishSearchError(null);
    setFinishSearchLoading(false);
  }, []);
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
  const [previewAttachment, setPreviewAttachment] = React.useState<
    { name: string; url: string } | null
  >(null);
  const [draft, setDraft] = React.useState<TaskDraft | null>(null);
  const [draftLoading, setDraftLoading] = React.useState(false);
  const [isSavingDraft, setIsSavingDraft] = React.useState(false);
  const [hasDraftChanges, setHasDraftChanges] = React.useState(false);
  const draftSnapshotRef = React.useRef<string | null>(null);
  const draftSaveRequestIdRef = React.useRef(0);
  const skipNextDraftSyncRef = React.useRef(true);
  const [photosLink, setPhotosLink] = React.useState<string | null>(null);
  const [distanceKm, setDistanceKm] = React.useState<number | null>(null);
  const [routeLink, setRouteLink] = React.useState("");
  const autoRouteRef = React.useRef(true);
  const transportRequiresDetails = React.useMemo(
    () => transportType === "Легковой" || transportType === "Грузовой",
    [transportType],
  );
  const loadTransportOptions = React.useCallback(
    async (force = false) => {
      if (transportOptionsLoading || (transportOptionsLoaded && !force)) {
        return;
      }
      setTransportOptionsLoading(true);
      setTransportOptionsError(null);
      try {
        const options = await fetchTransportOptions();
        setTransportDriverOptions(options.drivers);
        setTransportVehicleOptions(options.vehicles);
        setTransportOptionsLoaded(true);
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Не удалось загрузить транспорт";
        setTransportOptionsError(message);
        if (force) {
          setTransportOptionsLoaded(false);
        }
      } finally {
        setTransportOptionsLoading(false);
      }
    },
    [transportOptionsLoaded, transportOptionsLoading],
  );
  React.useEffect(() => {
    if (!transportRequiresDetails) return;
    void loadTransportOptions();
  }, [transportRequiresDetails, loadTransportOptions]);
  React.useEffect(
    () => () => {
      cancelStartSearch();
      cancelFinishSearch();
    },
    [cancelStartSearch, cancelFinishSearch],
  );
  React.useEffect(() => {
    if (!transportDriverId) {
      if (transportDriverName) setTransportDriverName("");
    }
  }, [transportDriverId, transportDriverName]);
  React.useEffect(() => {
    if (!transportVehicleId) {
      if (transportVehicleName) setTransportVehicleName("");
      if (transportVehicleRegistration) {
        setTransportVehicleRegistration("");
      }
      return;
    }
    const option = transportVehicleOptions.find(
      (candidate) => candidate.id === transportVehicleId,
    );
    if (option) {
      if (option.name !== transportVehicleName) {
        setTransportVehicleName(option.name);
      }
      if (option.registrationNumber !== transportVehicleRegistration) {
        setTransportVehicleRegistration(option.registrationNumber);
      }
    }
  }, [
    transportVehicleId,
    transportVehicleOptions,
    transportVehicleName,
    transportVehicleRegistration,
  ]);
  const prevTransportRequiresRef = React.useRef(transportRequiresDetails);
  React.useEffect(() => {
    const prev = prevTransportRequiresRef.current;
    if (prev && !transportRequiresDetails) {
      setTransportDriverId("");
      setTransportDriverName("");
      setTransportVehicleId("");
      setTransportVehicleName("");
      setTransportVehicleRegistration("");
    }
    prevTransportRequiresRef.current = transportRequiresDetails;
  }, [transportRequiresDetails]);
  const driverOptionItems = React.useMemo(() => {
    const list = [...transportDriverOptions];
    if (transportDriverId) {
      const numericDriver = Number.parseInt(transportDriverId, 10);
      if (
        Number.isFinite(numericDriver) &&
        !list.some((item) => item.id === numericDriver)
      ) {
        list.push({
          id: numericDriver,
          name: transportDriverName || String(numericDriver),
          username: null,
        });
      }
    }
    return list
      .map((item) => {
        const normalized = item.name.trim();
        const fallbackName = normalized.length > 0 ? normalized : String(item.id);
        return {
          ...item,
          name: fallbackName,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [transportDriverOptions, transportDriverId, transportDriverName]);
  const driverOptions = React.useMemo(
    () =>
      driverOptionItems.map((driver) => ({
        value: String(driver.id),
        label: driver.name,
      })),
    [driverOptionItems],
  );
  const selectedDriverOption = React.useMemo(
    () =>
      driverOptionItems.find(
        (driver) => String(driver.id) === transportDriverId,
      ) ?? null,
    [driverOptionItems, transportDriverId],
  );
  React.useEffect(() => {
    if (selectedDriverOption && selectedDriverOption.name !== transportDriverName) {
      setTransportDriverName(selectedDriverOption.name);
    }
  }, [selectedDriverOption, transportDriverName]);
  const vehicleOptions = React.useMemo(() => {
    const allowedType =
      transportType === "Грузовой" ? "Грузовой" : "Легковой";
    const list = transportVehicleOptions
      .filter((vehicle) => vehicle.transportType === allowedType)
      .slice();
    if (
      transportVehicleId &&
      !list.some((item) => item.id === transportVehicleId)
    ) {
      list.push({
        id: transportVehicleId,
        name: transportVehicleName || transportVehicleId,
        registrationNumber: transportVehicleRegistration || "",
        transportType: allowedType,
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [
    transportVehicleOptions,
    transportVehicleId,
    transportVehicleName,
    transportVehicleRegistration,
    transportType,
  ]);
  const vehicleSelectOptions = React.useMemo(
    () =>
      vehicleOptions.map((vehicle) => ({
        value: vehicle.id,
        label: vehicle.registrationNumber
          ? `${vehicle.name} (${vehicle.registrationNumber})`
          : vehicle.name,
      })),
    [vehicleOptions],
  );
  React.useEffect(() => {
    if (!transportRequiresDetails || !transportVehicleId) {
      return;
    }
    const hasVehicle = vehicleOptions.some(
      (vehicle) => vehicle.id === transportVehicleId,
    );
    if (!hasVehicle) {
      setTransportVehicleId("");
      setTransportVehicleName("");
      setTransportVehicleRegistration("");
    }
  }, [transportRequiresDetails, transportVehicleId, vehicleOptions]);
  const showTransportFields =
    transportRequiresDetails ||
    Boolean(
      transportDriverId ||
        transportVehicleId ||
        transportDriverName ||
        transportVehicleName,
    );
  const canEditTransport =
    editing && (canEditAll || isCreator || isExecutor);
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
  const summaryFetchRef = React.useRef<{
    kind: TaskKind;
    completed: boolean;
  } | null>(null);
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
  const titleValue = watch("title", "");
  const isTitleFilled = React.useMemo(
    () => (typeof titleValue === "string" ? titleValue.trim().length > 0 : false),
    [titleValue],
  );
  const canUploadAttachments = editing && isTitleFilled;
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
    setPreviewAttachment((prev) =>
      prev && prev.url === a.url ? null : prev,
    );
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
      const normalizedAssigneeIds = (() => {
        const candidates: number[] = [];
        if (Array.isArray(taskData.assignees)) {
          taskData.assignees.forEach((candidate) => {
            const parsed = toAssigneeNumber(candidate);
            if (parsed !== null) candidates.push(parsed);
          });
        }
        const primaryAssignee = toAssigneeNumber(
          (taskData as Record<string, unknown>).assigned_user_id,
        );
        if (primaryAssignee !== null) candidates.push(primaryAssignee);
        return Array.from(new Set(candidates));
      })();
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
      const driverNumeric = toAssigneeNumber(
        (taskData as Record<string, unknown>).transport_driver_id,
      );
      const driverIdValue = driverNumeric !== null ? String(driverNumeric) : "";
      const driverNameRaw = (taskData as Record<string, unknown>)
        .transport_driver_name;
      const driverNameStored =
        typeof driverNameRaw === "string" ? driverNameRaw.trim() : "";
      const driverUser =
        driverNumeric !== null && usersMap
          ? usersMap[String(driverNumeric)]
          : undefined;
      const driverDisplay = driverNameStored
        || (driverUser
          ? driverUser.name ||
            driverUser.telegram_username ||
            driverUser.username ||
            String(driverNumeric)
          : driverNumeric !== null
            ? String(driverNumeric)
            : "");
      const vehicleIdValue =
        typeof taskData.transport_vehicle_id === "string"
          ? taskData.transport_vehicle_id
          : "";
      const vehicleNameValue =
        typeof taskData.transport_vehicle_name === "string"
          ? taskData.transport_vehicle_name
          : "";
      const vehicleRegistrationValue =
        typeof taskData.transport_vehicle_registration === "string"
          ? taskData.transport_vehicle_registration
          : "";
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
      setTransportDriverId(driverIdValue);
      setTransportDriverName(driverNameStored || driverDisplay);
      setTransportVehicleId(vehicleIdValue);
      setTransportVehicleName(vehicleNameValue);
      setTransportVehicleRegistration(vehicleRegistrationValue);
      setPaymentMethod(curPayment);
      setPaymentAmount(amountValue);
      setInitialStatus(curStatus);
      setStatus(curStatus);
      setCompletedAt(curCompletedAt);
      setTaskAssigneeIds(normalizedAssigneeIds);
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
      const startCoordsFromTask = toCoordsValue(taskData.startCoordinates);
      const endCoordsFromTask = toCoordsValue(taskData.finishCoordinates);
      const storedRouteLinkRaw = sanitizeLocationLink(
        (taskData.google_route_url as string) || "",
      );
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
        startCoordsFromTask ??
          (startLocationLink ? extractCoords(startLocationLink) : null),
      );
      clearStartSuggestions();
      setStartSuggestionsOpen(false);
      setEnd(endLocationValue);
      setEndLink(endLocationLink);
      setFinishCoordinates(
        endCoordsFromTask ??
          (endLocationLink ? extractCoords(endLocationLink) : null),
      );
      clearFinishSuggestions();
      setFinishSuggestionsOpen(false);
      if (storedRouteLinkRaw) {
        autoRouteRef.current = false;
        setRouteLink(storedRouteLinkRaw);
      } else {
        autoRouteRef.current = true;
        setRouteLink("");
      }
      setAttachments(
        ((taskData.attachments as Attachment[]) || []) as Attachment[],
      );
      const albumChat = (taskData as Record<string, unknown>)
        .telegram_photos_chat_id;
      const albumMessage = (taskData as Record<string, unknown>)
        .telegram_photos_message_id;
      setPhotosLink(buildTelegramMessageLink(albumChat, albumMessage));
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
        assigneeIds: normalizedAssigneeIds,
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
        transportDriverId: driverIdValue,
        transportDriverName: driverNameStored || driverDisplay,
        transportVehicleId: vehicleIdValue,
        transportVehicleName: vehicleNameValue,
        transportVehicleRegistration: vehicleRegistrationValue,
        showLogistics: logisticsEnabled,
        photosLink: buildTelegramMessageLink(albumChat, albumMessage),
        photosChatId: albumChat,
        photosMessageId: albumMessage,
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
    if (!checked) {
      setStartSuggestionsOpen(false);
      setFinishSuggestionsOpen(false);
      cancelStartSearch();
      cancelFinishSearch();
      clearStartSuggestions();
      clearFinishSuggestions();
    }
  };

  React.useEffect(() => {
    if (!isEdit) {
      setEditing(true);
      return;
    }
    setEditing(canEditTask);
  }, [isEdit, canEditTask]);

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

  const collectDraftPayload = React.useCallback(() => {
    const values = getValues();
    const titleValue =
      typeof values.title === "string" ? values.title.trim() : "";
    const descriptionValue =
      typeof values.description === "string" ? values.description : "";
    const assigneeRaw =
      typeof values.assigneeId === "string" ? values.assigneeId.trim() : "";
    const assigneeNumeric = toNumericValue(assigneeRaw);
    const resolvedAssignee =
      assigneeNumeric !== null ? assigneeNumeric : assigneeRaw || undefined;
    const resolvedTaskType =
      entityKind === "request" ? DEFAULT_REQUEST_TYPE : taskType;

    const payload: Record<string, unknown> = {
      title: titleValue,
      task_type: resolvedTaskType,
      task_description: descriptionValue,
      comment,
      priority,
      transport_type: transportType,
      payment_method: paymentMethod,
      status,
      logistics_enabled: showLogistics,
      attachments,
    };

    if (resolvedAssignee !== undefined) {
      payload.assigned_user_id = resolvedAssignee;
    }
    if (taskAssigneeIds.length > 0) {
      payload.assignees = taskAssigneeIds;
    } else if (resolvedAssignee !== undefined) {
      payload.assignees = [resolvedAssignee];
    }

    const creatorNumeric = toNumericValue(creator);
    if (creatorNumeric !== null) {
      payload.created_by = creatorNumeric;
    } else if (creator.trim()) {
      payload.created_by = creator.trim();
    }

    if (values.startDate) payload.start_date = values.startDate;
    if (values.dueDate) payload.due_date = values.dueDate;
    if (start) payload.start_location = start;
    if (startLink) payload.start_location_link = startLink;
    if (end) payload.end_location = end;
    if (endLink) payload.end_location_link = endLink;
    if (startCoordinates) payload.startCoordinates = startCoordinates;
    if (finishCoordinates) payload.finishCoordinates = finishCoordinates;
    if (routeLink) payload.google_route_url = routeLink;
    if (distanceKm !== null) payload.route_distance_km = distanceKm;

    const driverCandidate = transportDriverId.trim();
    if (driverCandidate) {
      const driverNumeric = toNumericValue(transportDriverId);
      payload.transport_driver_id =
        driverNumeric !== null ? driverNumeric : driverCandidate;
    } else {
      payload.transport_driver_id = null;
    }
    const driverNameValue = transportDriverName.trim();
    if (driverNameValue) {
      payload.transport_driver_name = driverNameValue;
    } else if (!driverCandidate) {
      payload.transport_driver_name = null;
    }
    const vehicleCandidate = transportVehicleId.trim();
    if (vehicleCandidate) {
      payload.transport_vehicle_id = vehicleCandidate;
    } else {
      payload.transport_vehicle_id = null;
    }
    const vehicleNameValue = transportVehicleName.trim();
    if (vehicleNameValue) {
      payload.transport_vehicle_name = vehicleNameValue;
    } else if (!vehicleCandidate) {
      payload.transport_vehicle_name = null;
    }
    const vehicleRegistrationValue = transportVehicleRegistration.trim();
    if (vehicleRegistrationValue) {
      payload.transport_vehicle_registration = vehicleRegistrationValue;
    } else if (!vehicleCandidate) {
      payload.transport_vehicle_registration = null;
    }

    if (requestId) {
      if (entityKind === "request") {
        payload.request_id = requestId;
      } else {
        payload.task_number = requestId;
      }
    }

    const amountValue = parseCurrencyInput(paymentAmount);
    if (amountValue !== null) payload.payment_amount = amountValue;
    else if (paymentAmount.trim()) payload.payment_amount = paymentAmount.trim();

    const lengthValue = parseMetricInput(cargoLength);
    if (lengthValue !== null) payload.cargo_length_m = lengthValue;
    else if (cargoLength.trim()) payload.cargo_length_m = cargoLength.trim();

    const widthValue = parseMetricInput(cargoWidth);
    if (widthValue !== null) payload.cargo_width_m = widthValue;
    else if (cargoWidth.trim()) payload.cargo_width_m = cargoWidth.trim();

    const heightValue = parseMetricInput(cargoHeight);
    if (heightValue !== null) payload.cargo_height_m = heightValue;
    else if (cargoHeight.trim()) payload.cargo_height_m = cargoHeight.trim();

    const volumeValue = parseMetricInput(cargoVolume);
    if (volumeValue !== null) payload.cargo_volume_m3 = volumeValue;
    else if (cargoVolume.trim()) payload.cargo_volume_m3 = cargoVolume.trim();

    const weightValue = parseMetricInput(cargoWeight);
    if (weightValue !== null) payload.cargo_weight_kg = weightValue;
    else if (cargoWeight.trim()) payload.cargo_weight_kg = cargoWeight.trim();

    if (completedAt) {
      payload.completed_at = completedAt;
    }

    const draftMeta: Record<string, unknown> = {};
    if (transportDriverName.trim()) {
      draftMeta.transportDriverName = transportDriverName.trim();
    }
    if (transportVehicleName.trim()) {
      draftMeta.transportVehicleName = transportVehicleName.trim();
    }
    if (transportVehicleRegistration.trim()) {
      draftMeta.transportVehicleRegistration =
        transportVehicleRegistration.trim();
    }
    if (photosLink) {
      draftMeta.photosLink = photosLink;
    }
    if (Object.keys(draftMeta).length > 0) {
      payload.draftMeta = draftMeta;
    }

    payload.kind = entityKind;

    return payload;
  }, [
    attachments,
    cargoHeight,
    cargoLength,
    cargoVolume,
    cargoWeight,
    cargoWidth,
    comment,
    completedAt,
    creator,
    distanceKm,
    end,
    endLink,
    entityKind,
    getValues,
    paymentAmount,
    paymentMethod,
    photosLink,
    priority,
    routeLink,
    showLogistics,
    start,
    startCoordinates,
    startLink,
    taskAssigneeIds,
    taskType,
    transportDriverId,
    transportDriverName,
    transportType,
    transportVehicleId,
    transportVehicleName,
    transportVehicleRegistration,
    status,
    finishCoordinates,
    requestId,
  ]);

  React.useEffect(() => {
    const targetId = effectiveTaskId;
    if (isEdit && targetId) {
      summaryFetchRef.current = null;
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
    summaryFetchRef.current =
      summaryFetchRef.current?.kind === initialKind
        ? summaryFetchRef.current
        : { kind: initialKind, completed: false };
    const summaryState = summaryFetchRef.current;
    if (summaryState && !summaryState.completed) {
      summaryState.completed = true;
      authFetch(summaryUrl)
        .then((r) => (r.ok ? r.json() : { count: 0 }))
        .then((s) => {
          const num = String((s.count || 0) + 1).padStart(6, "0");
          const prefix = initialKind === "request" ? "REQ" : "ERM";
          setRequestId(`${prefix}_${num}`);
        })
        .catch(() => {
          if (
            summaryFetchRef.current &&
            summaryFetchRef.current.kind === initialKind
          ) {
            summaryFetchRef.current.completed = false;
          }
        });
    }
    setPaymentAmount(formatCurrencyDisplay(DEFAULT_PAYMENT_AMOUNT));
    setPhotosLink(null);
    const startInstant = parseIsoDate(defaultStartDate);
    setStartDateNotice(
      startInstant ? formatHistoryInstant(startInstant) : null,
    );
    const defaultAssigneeIds: number[] = [];
    setTaskAssigneeIds(defaultAssigneeIds);
    setInitialStatus(DEFAULT_STATUS);
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
      assigneeId: "",
      assigneeIds: defaultAssigneeIds,
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
      transportDriverId: "",
      transportDriverName: "",
      transportVehicleId: "",
      transportVehicleName: "",
      transportVehicleRegistration: "",
      showLogistics: false,
      photosLink: null,
      photosChatId: undefined,
      photosMessageId: undefined,
    };
    setInitialDates({ start: defaultStartDate, due: defaultDueDate });
    stableReset({
      title: "",
      description: "",
      assigneeId: "",
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
    setTransportDriverId("");
    setTransportDriverName("");
    setTransportVehicleId("");
    setTransportVehicleName("");
    setTransportVehicleRegistration("");
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
    if (isEdit) {
      setDraft(null);
      return;
    }
    let cancelled = false;
    setDraftLoading(true);
    fetchTaskDraft(entityKind)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setDraft(data);
          const payload = (data.payload || {}) as Partial<Task> &
            Record<string, unknown>;
          applyTaskDetails(payload);
          const meta = (payload.draftMeta as Record<string, unknown> | undefined) ?? {};
          if (typeof meta.transportDriverName === "string") {
            setTransportDriverName(meta.transportDriverName);
          }
          if (typeof meta.transportVehicleName === "string") {
            setTransportVehicleName(meta.transportVehicleName);
          }
          if (typeof meta.transportVehicleRegistration === "string") {
            setTransportVehicleRegistration(meta.transportVehicleRegistration);
          }
          if (typeof meta.photosLink === "string") {
            setPhotosLink(meta.photosLink);
          }
          setAlertMsg((prev) => prev ?? t("taskDraftLoaded"));
          setHasDraftChanges(true);
          skipNextDraftSyncRef.current = true;
          window.setTimeout(() => {
            if (cancelled) return;
            try {
              draftSnapshotRef.current = JSON.stringify(collectDraftPayload());
            } catch (error) {
              console.warn("Не удалось зафиксировать состояние черновика", error);
            }
          }, 0);
        } else {
          setDraft(null);
          skipNextDraftSyncRef.current = true;
          draftSnapshotRef.current = null;
          setHasDraftChanges(false);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("Не удалось загрузить черновик задачи", error);
      })
      .finally(() => {
        if (!cancelled) setDraftLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    applyTaskDetails,
    entityKind,
    isEdit,
    setPhotosLink,
    setTransportDriverName,
    setTransportVehicleName,
    setTransportVehicleRegistration,
    t,
  ]);

  const runStartSearch = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < MIN_ADDRESS_QUERY_LENGTH) {
        clearStartSuggestions();
        return;
      }
      cancelStartSearch();
      const requestId = startSearchRequestRef.current + 1;
      startSearchRequestRef.current = requestId;
      const controller = new AbortController();
      startSearchAbortRef.current = controller;
      setStartSearchLoading(true);
      setStartSearchError(null);
      void searchMapAddress(trimmed, {
        signal: controller.signal,
        limit: 7,
        language: currentLanguage,
      })
        .then((items) => {
          if (startSearchRequestRef.current !== requestId) {
            return;
          }
          setStartSuggestions(items);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          if (startSearchRequestRef.current !== requestId) {
            return;
          }
          setStartSuggestions([]);
          setStartSearchError(t("addressSearchFailed"));
        })
        .finally(() => {
          if (startSearchRequestRef.current === requestId) {
            setStartSearchLoading(false);
          }
        });
    },
    [cancelStartSearch, clearStartSuggestions, currentLanguage, t],
  );

  const runFinishSearch = React.useCallback(
    (value: string) => {
      const trimmed = value.trim();
      if (trimmed.length < MIN_ADDRESS_QUERY_LENGTH) {
        clearFinishSuggestions();
        return;
      }
      cancelFinishSearch();
      const requestId = finishSearchRequestRef.current + 1;
      finishSearchRequestRef.current = requestId;
      const controller = new AbortController();
      finishSearchAbortRef.current = controller;
      setFinishSearchLoading(true);
      setFinishSearchError(null);
      void searchMapAddress(trimmed, {
        signal: controller.signal,
        limit: 7,
        language: currentLanguage,
      })
        .then((items) => {
          if (finishSearchRequestRef.current !== requestId) {
            return;
          }
          setFinishSuggestions(items);
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          if (finishSearchRequestRef.current !== requestId) {
            return;
          }
          setFinishSuggestions([]);
          setFinishSearchError(t("addressSearchFailed"));
        })
        .finally(() => {
          if (finishSearchRequestRef.current === requestId) {
            setFinishSearchLoading(false);
          }
        });
    },
    [cancelFinishSearch, clearFinishSuggestions, currentLanguage, t],
  );

  const scheduleStartSearch = React.useCallback(
    (value: string) => {
      cancelStartSearch();
      if (!value.trim()) {
        clearStartSuggestions();
        return;
      }
      if (value.trim().length < MIN_ADDRESS_QUERY_LENGTH) {
        clearStartSuggestions();
        return;
      }
      startSearchTimeoutRef.current = window.setTimeout(() => {
        startSearchTimeoutRef.current = null;
        runStartSearch(value);
      }, 350);
    },
    [cancelStartSearch, clearStartSuggestions, runStartSearch],
  );

  const scheduleFinishSearch = React.useCallback(
    (value: string) => {
      cancelFinishSearch();
      if (!value.trim()) {
        clearFinishSuggestions();
        return;
      }
      if (value.trim().length < MIN_ADDRESS_QUERY_LENGTH) {
        clearFinishSuggestions();
        return;
      }
      finishSearchTimeoutRef.current = window.setTimeout(() => {
        finishSearchTimeoutRef.current = null;
        runFinishSearch(value);
      }, 350);
    },
    [cancelFinishSearch, clearFinishSuggestions, runFinishSearch],
  );

  const handleStartSuggestionSelect = React.useCallback(
    (suggestion: AddressSuggestion) => {
      autoRouteRef.current = true;
      cancelStartSearch();
      setStartSuggestionsOpen(false);
      setStartSearchError(null);
      clearStartSuggestions();
      startInputRef.current?.focus();
      setStart(suggestion.label);
      const coords = { lat: suggestion.lat, lng: suggestion.lng };
      setStartCoordinates(coords);
      setStartLink(buildMapsLink(coords));
    },
    [cancelStartSearch, clearStartSuggestions],
  );

  const handleFinishSuggestionSelect = React.useCallback(
    (suggestion: AddressSuggestion) => {
      autoRouteRef.current = true;
      cancelFinishSearch();
      setFinishSuggestionsOpen(false);
      setFinishSearchError(null);
      clearFinishSuggestions();
      finishInputRef.current?.focus();
      setEnd(suggestion.label);
      const coords = { lat: suggestion.lat, lng: suggestion.lng };
      setFinishCoordinates(coords);
      setEndLink(buildMapsLink(coords));
    },
    [cancelFinishSearch, clearFinishSuggestions],
  );

  const handleStartInputChange = React.useCallback(
    (value: string) => {
      autoRouteRef.current = true;
      setStart(value);
      setStartLink("");
      setStartCoordinates(null);
      setStartSearchError(null);
      setStartSuggestionsOpen(true);
      scheduleStartSearch(value);
    },
    [scheduleStartSearch],
  );

  const handleFinishInputChange = React.useCallback(
    (value: string) => {
      autoRouteRef.current = true;
      setEnd(value);
      setEndLink("");
      setFinishCoordinates(null);
      setFinishSearchError(null);
      setFinishSuggestionsOpen(true);
      scheduleFinishSearch(value);
    },
    [scheduleFinishSearch],
  );

  const handleStartLink = async (value: string) => {
    autoRouteRef.current = true;
    const sanitized = sanitizeLocationLink(value);
    if (!sanitized) {
      setStart("");
      setStartCoordinates(null);
      setStartLink("");
      setStartSuggestionsOpen(false);
      cancelStartSearch();
      clearStartSuggestions();
      return;
    }
    let link = sanitized;
    let resolved = sanitized;
    let coords = extractCoords(resolved);
    if (
      /^https?:\/\/maps\.app\.goo\.gl\//i.test(sanitized) ||
      isManagedShortLink(sanitized)
    ) {
      const data = await expandLink(sanitized);
      if (data?.url) {
        const expanded = sanitizeLocationLink(data.url) || sanitized;
        resolved = expanded;
        const backendCoords = toCoordsValue(data.coords);
        if (backendCoords) {
          coords = backendCoords;
        }
        if (typeof data.short === "string") {
          const shortCandidate = sanitizeLocationLink(data.short);
          link = shortCandidate || sanitized;
        } else {
          link = expanded;
        }
      }
      if (!coords) {
        coords = extractCoords(resolved);
      }
    }
    setStart(parseGoogleAddress(resolved));
    setStartCoordinates(coords ?? extractCoords(resolved));
    setStartLink(link);
    setStartSuggestionsOpen(false);
    cancelStartSearch();
    clearStartSuggestions();
  };

  const handleEndLink = async (value: string) => {
    autoRouteRef.current = true;
    const sanitized = sanitizeLocationLink(value);
    if (!sanitized) {
      setEnd("");
      setFinishCoordinates(null);
      setEndLink("");
      setFinishSuggestionsOpen(false);
      cancelFinishSearch();
      clearFinishSuggestions();
      return;
    }
    let link = sanitized;
    let resolved = sanitized;
    let coords = extractCoords(resolved);
    if (
      /^https?:\/\/maps\.app\.goo\.gl\//i.test(sanitized) ||
      isManagedShortLink(sanitized)
    ) {
      const data = await expandLink(sanitized);
      if (data?.url) {
        const expanded = sanitizeLocationLink(data.url) || sanitized;
        resolved = expanded;
        const backendCoords = toCoordsValue(data.coords);
        if (backendCoords) {
          coords = backendCoords;
        }
        if (typeof data.short === "string") {
          const shortCandidate = sanitizeLocationLink(data.short);
          link = shortCandidate || sanitized;
        } else {
          link = expanded;
        }
      }
      if (!coords) {
        coords = extractCoords(resolved);
      }
    }
    setEnd(parseGoogleAddress(resolved));
    setFinishCoordinates(coords ?? extractCoords(resolved));
    setEndLink(link);
    setFinishSuggestionsOpen(false);
    cancelFinishSearch();
    clearFinishSuggestions();
  };

  const handleMapConfirm = React.useCallback(
    async (target: "start" | "finish", coords: { lat: number; lng: number }) => {
      autoRouteRef.current = true;
      setMapPicker(null);
      const link = buildMapsLink(coords);
      let label = formatCoords(coords);
      try {
        const place = await reverseMapGeocode(coords, {
          language: currentLanguage,
        });
        if (place) {
          label = place.description
            ? `${place.label}, ${place.description}`
            : place.label;
        } else {
          setAlertMsg((prev) => prev ?? t("addressReverseNotFound"));
        }
      } catch (error) {
        console.warn("Не удалось получить адрес по координатам", error);
        setAlertMsg((prev) => prev ?? t("addressReverseFailed"));
      }
      if (target === "start") {
        cancelStartSearch();
        clearStartSuggestions();
        setStartSuggestionsOpen(false);
        setStartSearchError(null);
        setStart(label);
        setStartCoordinates(coords);
        setStartLink(link);
      } else {
        cancelFinishSearch();
        clearFinishSuggestions();
        setFinishSuggestionsOpen(false);
        setFinishSearchError(null);
        setEnd(label);
        setFinishCoordinates(coords);
        setEndLink(link);
      }
    },
    [
      cancelFinishSearch,
      cancelStartSearch,
      clearFinishSuggestions,
      clearStartSuggestions,
      currentLanguage,
      t,
    ],
  );

  const openMapPicker = React.useCallback(
    (target: "start" | "finish") => {
      setMapPicker({
        target,
        initialCoords:
          target === "start" ? startCoordinates ?? null : finishCoordinates ?? null,
      });
    },
    [finishCoordinates, startCoordinates],
  );

  React.useEffect(() => {
    if (startCoordinates && finishCoordinates) {
      if (autoRouteRef.current) {
        setRouteLink(createRouteLink(startCoordinates, finishCoordinates));
      }
      let cancelled = false;
      const applyFallback = () => {
        const fallback = haversine(startCoordinates, finishCoordinates);
        if (!cancelled) {
          setDistanceKm(Number(fallback.toFixed(1)));
        }
      };
      fetchRoute(startCoordinates, finishCoordinates)
        .then((r) => {
          if (cancelled) return;
          if (r && typeof r.distance === "number" && Number.isFinite(r.distance)) {
            setDistanceKm(Number((r.distance / 1000).toFixed(1)));
            return;
          }
          applyFallback();
        })
        .catch(() => {
          applyFallback();
        });
      return () => {
        cancelled = true;
      };
    }
    setDistanceKm(null);
    if (autoRouteRef.current) {
      setRouteLink("");
    }
    return undefined;
  }, [startCoordinates, finishCoordinates]);

  const handleDeleteDraft = React.useCallback(async () => {
    setDraftLoading(true);
    try {
      await deleteTaskDraft(entityKind);
      setDraft(null);
      setAlertMsg(t("taskDraftCleared"));
      setHasDraftChanges(false);
      skipNextDraftSyncRef.current = true;
      try {
        draftSnapshotRef.current = JSON.stringify(collectDraftPayload());
      } catch (error) {
        console.warn("Не удалось сбросить состояние черновика", error);
      }
    } catch (error) {
      console.error("Не удалось удалить черновик", error);
      if (error instanceof TaskRequestError) {
        setAlertMsg(
          t("taskDraftClearFailedWithReason", { reason: error.message }),
        );
      } else if (error instanceof Error && error.message) {
        setAlertMsg(
          t("taskDraftClearFailedWithReason", { reason: error.message }),
        );
      } else {
        setAlertMsg(t("taskDraftClearFailed"));
      }
    } finally {
      setDraftLoading(false);
    }
  }, [collectDraftPayload, entityKind, t]);

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
      const driverCandidate = transportDriverId.trim();
      if (driverCandidate) {
        const driverNumeric = Number.parseInt(driverCandidate, 10);
        payload.transport_driver_id = Number.isFinite(driverNumeric)
          ? driverNumeric
          : driverCandidate;
      } else {
        payload.transport_driver_id = null;
      }
      const driverNameValue = transportDriverName.trim();
      if (driverNameValue) {
        payload.transport_driver_name = driverNameValue;
      } else if (!driverCandidate) {
        payload.transport_driver_name = null;
      }
      const vehicleCandidate = transportVehicleId.trim();
      if (vehicleCandidate) {
        payload.transport_vehicle_id = vehicleCandidate;
      } else {
        payload.transport_vehicle_id = null;
      }
      const vehicleNameValue = transportVehicleName.trim();
      if (vehicleNameValue) {
        payload.transport_vehicle_name = vehicleNameValue;
      } else if (!vehicleCandidate) {
        payload.transport_vehicle_name = null;
      }
      const vehicleRegistrationValue = transportVehicleRegistration.trim();
      if (vehicleRegistrationValue) {
        payload.transport_vehicle_registration = vehicleRegistrationValue;
      } else if (!vehicleCandidate) {
        payload.transport_vehicle_registration = null;
      }
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
      if (!isEdit) {
        try {
          await deleteTaskDraft(entityKind);
          setDraft(null);
          setHasDraftChanges(false);
          skipNextDraftSyncRef.current = true;
          try {
            draftSnapshotRef.current = JSON.stringify(collectDraftPayload());
          } catch (error) {
            console.warn("Не удалось обновить состояние черновика", error);
          }
        } catch (error) {
          console.warn("Не удалось удалить сохранённый черновик", error);
        }
      }
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
  },
  (formErrors: FieldErrors<TaskFormValues>) => {
    if (formErrors.assigneeId) {
      setIsSubmitting(false);
      setAlertMsg(t("assigneeRequiredError"));
    }
  },
);

  const [alertMsg, setAlertMsg] = React.useState<string | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [showAcceptConfirm, setShowAcceptConfirm] = React.useState(false);
  const [showDoneConfirm, setShowDoneConfirm] = React.useState(false);
  const [pendingDoneOption, setPendingDoneOption] = React.useState("");

  React.useEffect(() => {
    if (isEdit || !editing) {
      return undefined;
    }
    const payload = collectDraftPayload();
    const serialized = JSON.stringify(payload);
    if (skipNextDraftSyncRef.current) {
      skipNextDraftSyncRef.current = false;
      draftSnapshotRef.current = serialized;
      return undefined;
    }
    if (draftSnapshotRef.current === serialized) {
      return undefined;
    }
    setHasDraftChanges(true);
    const timeoutId = window.setTimeout(() => {
      const requestId = draftSaveRequestIdRef.current + 1;
      draftSaveRequestIdRef.current = requestId;
      setIsSavingDraft(true);
      saveTaskDraft(entityKind, payload)
        .then((saved) => {
          if (draftSaveRequestIdRef.current !== requestId) {
            return;
          }
          draftSnapshotRef.current = serialized;
          setDraft(saved);
        })
        .catch((error) => {
          if (draftSaveRequestIdRef.current !== requestId) {
            return;
          }
          console.error("Не удалось сохранить черновик", error);
          if (error instanceof TaskRequestError) {
            setAlertMsg(
              t("taskDraftSaveFailedWithReason", { reason: error.message }),
            );
          } else if (error instanceof Error && error.message) {
            setAlertMsg(
              t("taskDraftSaveFailedWithReason", { reason: error.message }),
            );
          } else {
            setAlertMsg(t("taskDraftSaveFailed"));
          }
        })
        .finally(() => {
          if (draftSaveRequestIdRef.current === requestId) {
            setIsSavingDraft(false);
          }
        });
    }, 800);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    collectDraftPayload,
    editing,
    entityKind,
    isEdit,
    t,
    watchedDraftValues,
  ]);

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
    setTransportDriverId(d.transportDriverId);
    setTransportDriverName(d.transportDriverName);
    setTransportVehicleId(d.transportVehicleId);
    setTransportVehicleName(d.transportVehicleName);
    setTransportVehicleRegistration(d.transportVehicleRegistration);
    setPaymentMethod(d.paymentMethod);
    setPaymentAmount(d.paymentAmount);
    setInitialStatus(d.status);
    setStatus(d.status);
    setCompletedAt(d.completedAt);
    setTaskAssigneeIds(d.assigneeIds);
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
    setPhotosLink(
      buildTelegramMessageLink(d.photosChatId, d.photosMessageId) ??
        (typeof d.photosLink === "string" ? d.photosLink : null),
    );
    setDistanceKm(d.distanceKm);
    setShowLogistics(Boolean(d.showLogistics));
    skipNextDraftSyncRef.current = true;
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
        if (initialRef.current) {
          initialRef.current.status = "В работе";
        }
        setInitialStatus("В работе");
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
        setInitialStatus("Выполнена");
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

  const startQueryLength = start.trim().length;
  const finishQueryLength = end.trim().length;

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      <div
        aria-hidden="true"
        onClick={handleBackdropClick}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/70 backdrop-blur-sm"
      />
      <div className="pointer-events-none absolute inset-0">
        <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
          <div
            className="pointer-events-auto relative mx-auto w-full max-w-6xl space-y-6 overflow-y-auto rounded-2xl bg-white p-4 shadow-lg sm:p-6"
            style={{ WebkitOverflowScrolling: "touch", maxHeight: "calc(100vh - 2rem)" }}
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
              {isEdit && !editing && canEditTask && (
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
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!editing}
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
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div className="space-y-5">
                  <div>
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
                            !errors.assigneeId
                              ? t("assigneeSelectHint")
                              : undefined
                          }
                          error={errors.assigneeId?.message ?? null}
                        />
                      )}
                    />
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
                  <div className="space-y-4 rounded-xl border border-dashed border-gray-300 p-5">
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
                      <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                        <div className="sm:col-span-2 lg:col-span-2">
                          <label
                            className="block text-sm font-medium"
                            htmlFor="task-start-address"
                          >
                            {t("startPoint")}
                          </label>
                          <div className="mt-1 space-y-2">
                            <div className="relative">
                              <input
                                id="task-start-address"
                                ref={startInputRef}
                                value={start}
                                onChange={(event) =>
                                  handleStartInputChange(event.target.value)
                                }
                                onFocus={() => {
                                  if (!editing) return;
                                  setStartSuggestionsOpen(true);
                                }}
                                onBlur={() => {
                                  window.setTimeout(() => {
                                    setStartSuggestionsOpen(false);
                                  }, 120);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && editing) {
                                    if (startSuggestions.length > 0) {
                                      event.preventDefault();
                                      handleStartSuggestionSelect(
                                        startSuggestions[0],
                                      );
                                    }
                                  }
                                  if (event.key === "Escape") {
                                    setStartSuggestionsOpen(false);
                                  }
                                }}
                                placeholder={t("addressPlaceholder", {
                                  count: MIN_ADDRESS_QUERY_LENGTH,
                                })}
                                className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none disabled:cursor-not-allowed"
                                disabled={!editing}
                              />
                              {editing && startSuggestionsOpen ? (
                                <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                                  {startSearchLoading ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchLoading")}
                                    </div>
                                  ) : startSearchError ? (
                                    <div className="px-3 py-2 text-sm text-red-600">
                                      {startSearchError}
                                    </div>
                                  ) : startQueryLength === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchHint", {
                                        count: MIN_ADDRESS_QUERY_LENGTH,
                                      })}
                                    </div>
                                  ) : startQueryLength < MIN_ADDRESS_QUERY_LENGTH ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchHint", {
                                        count: MIN_ADDRESS_QUERY_LENGTH,
                                      })}
                                    </div>
                                  ) : startSuggestions.length ? (
                                    <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                                      {startSuggestions.map((suggestion) => (
                                        <li
                                          key={`${suggestion.id}-${suggestion.lat}-${suggestion.lng}`}
                                          role="option"
                                          className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            handleStartSuggestionSelect(suggestion);
                                          }}
                                        >
                                          <div className="font-medium text-slate-800">
                                            {suggestion.label}
                                          </div>
                                          {suggestion.description ? (
                                            <div className="text-xs text-slate-500">
                                              {suggestion.description}
                                            </div>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchNoResults")}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {canonicalStartLink ? (
                              <div className="flex flex-wrap items-start gap-2">
                                <div className="flex min-w-0 flex-col gap-1">
                                  <a
                                    href={canonicalStartLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accentPrimary underline break-words"
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
                                {editing ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleStartLink("")}
                                      className="shrink-0 text-red-600"
                                    >
                                      ✖
                                    </button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openMapPicker("start")}
                                    >
                                      {t("selectOnMap")}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  id="task-start-link"
                                  name="startLink"
                                  value={startLink}
                                  onChange={(e) => handleStartLink(e.target.value)}
                                  placeholder={t("googleMapsLink")}
                                  className="focus:ring-brand-200 focus:border-accentPrimary min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
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
                                    "rounded-2xl px-3 shrink-0 whitespace-nowrap h-10",
                                  )}
                                >
                                  {t("map")}
                                </a>
                                {editing ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMapPicker("start")}
                                  >
                                    {t("selectOnMap")}
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="sm:col-span-2 lg:col-span-2">
                          <label
                            className="block text-sm font-medium"
                            htmlFor="task-finish-address"
                          >
                            {t("endPoint")}
                          </label>
                          <div className="mt-1 space-y-2">
                            <div className="relative">
                              <input
                                id="task-finish-address"
                                ref={finishInputRef}
                                value={end}
                                onChange={(event) =>
                                  handleFinishInputChange(event.target.value)
                                }
                                onFocus={() => {
                                  if (!editing) return;
                                  setFinishSuggestionsOpen(true);
                                }}
                                onBlur={() => {
                                  window.setTimeout(() => {
                                    setFinishSuggestionsOpen(false);
                                  }, 120);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" && editing) {
                                    if (finishSuggestions.length > 0) {
                                      event.preventDefault();
                                      handleFinishSuggestionSelect(
                                        finishSuggestions[0],
                                      );
                                    }
                                  }
                                  if (event.key === "Escape") {
                                    setFinishSuggestionsOpen(false);
                                  }
                                }}
                                placeholder={t("addressPlaceholder", {
                                  count: MIN_ADDRESS_QUERY_LENGTH,
                                })}
                                className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none disabled:cursor-not-allowed"
                                disabled={!editing}
                              />
                              {editing && finishSuggestionsOpen ? (
                                <div className="absolute left-0 right-0 z-20 mt-1 rounded-md border border-slate-200 bg-white shadow-lg">
                                  {finishSearchLoading ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchLoading")}
                                    </div>
                                  ) : finishSearchError ? (
                                    <div className="px-3 py-2 text-sm text-red-600">
                                      {finishSearchError}
                                    </div>
                                  ) : finishQueryLength === 0 ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchHint", {
                                        count: MIN_ADDRESS_QUERY_LENGTH,
                                      })}
                                    </div>
                                  ) : finishQueryLength < MIN_ADDRESS_QUERY_LENGTH ? (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchHint", {
                                        count: MIN_ADDRESS_QUERY_LENGTH,
                                      })}
                                    </div>
                                  ) : finishSuggestions.length ? (
                                    <ul className="max-h-60 overflow-y-auto py-1" role="listbox">
                                      {finishSuggestions.map((suggestion) => (
                                        <li
                                          key={`${suggestion.id}-${suggestion.lat}-${suggestion.lng}`}
                                          role="option"
                                          className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-100"
                                          onMouseDown={(event) => {
                                            event.preventDefault();
                                            handleFinishSuggestionSelect(suggestion);
                                          }}
                                        >
                                          <div className="font-medium text-slate-800">
                                            {suggestion.label}
                                          </div>
                                          {suggestion.description ? (
                                            <div className="text-xs text-slate-500">
                                              {suggestion.description}
                                            </div>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="px-3 py-2 text-sm text-muted-foreground">
                                      {t("addressSearchNoResults")}
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                            {canonicalEndLink ? (
                              <div className="flex flex-wrap items-start gap-2">
                                <div className="flex min-w-0 flex-col gap-1">
                                  <a
                                    href={canonicalEndLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-accentPrimary underline break-words"
                                  >
                                    {end || t("link")}
                                  </a>
                                  {finishCoordinates && (
                                    <input
                                      id="task-finish-coordinates"
                                      name="finishCoordinatesDisplay"
                                      value={formatCoords(finishCoordinates)}
                                      readOnly
                                      className="focus:ring-brand-200 focus:border-accentPrimary w-full cursor-text rounded-md border border-dashed border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:ring focus:outline-none"
                                      onFocus={(e) => e.currentTarget.select()}
                                      aria-label={t("coordinates")}
                                    />
                                  )}
                                </div>
                                {editing ? (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleEndLink("")}
                                      className="shrink-0 text-red-600"
                                    >
                                      ✖
                                    </button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openMapPicker("finish")}
                                    >
                                      {t("selectOnMap")}
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  id="task-end-link"
                                  name="endLink"
                                  value={endLink}
                                  onChange={(e) => handleEndLink(e.target.value)}
                                  placeholder={t("googleMapsLink")}
                                  className="focus:ring-brand-200 focus:border-accentPrimary min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
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
                                    "rounded-2xl px-3 shrink-0 whitespace-nowrap h-10",
                                  )}
                                >
                                  {t("map")}
                                </a>
                                {editing ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openMapPicker("finish")}
                                  >
                                    {t("selectOnMap")}
                                  </Button>
                                ) : null}
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <label
                            className="block text-sm font-medium"
                            htmlFor="task-distance"
                          >
                            {t("distance")}
                          </label>
                          <input
                            id="task-distance"
                            name="distanceKm"
                            value={distanceKm ?? ""}
                            onChange={(e) => setDistanceKm(parseMetricInput(e.target.value))}
                            className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                            placeholder="0"
                            inputMode="decimal"
                            disabled={!editing}
                          />
                        </div>
                        <div>
                          <label
                            className="block text-sm font-medium"
                            htmlFor="task-transport-type"
                          >
                            {t("transportType")}
                          </label>
                          <select
                            id="task-transport-type"
                            value={transportType}
                            onChange={(e) => setTransportType(e.target.value)}
                            className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                            disabled={!editing}
                          >
                            {transports.map((transport) => (
                              <option key={transport} value={transport}>
                                {transport}
                              </option>
                            ))}
                          </select>
                        </div>
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
                            className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-gray-100 px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                            placeholder="—"
                          />
                        </div>
                        <div className="sm:col-span-2 lg:col-span-2">
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
                        <div className="sm:col-span-2 lg:col-span-1">
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
                        <div className="sm:col-span-2 lg:col-span-3">
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
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">
                        {t("attachments")}
                      </label>
                      <ul className="flex flex-wrap gap-3">
                        {attachments.map((a) => {
                          const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(
                            a.url,
                          );
                          const thumbnail = ensureInlineMode(a.thumbnailUrl);
                          const inlineUrl = ensureInlineMode(a.url) ?? a.url;
                          const previewSrc = thumbnail ?? inlineUrl;
                          return (
                            <li
                              key={a.url}
                              className="flex flex-col items-start gap-1"
                            >
                              <div className="flex items-center gap-2">
                                {isImage ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewAttachment({
                                        name: a.name || "Изображение",
                                        url: inlineUrl,
                                      })
                                    }
                                    className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring focus:ring-indigo-200"
                                    title={a.name || "Изображение"}
                                  >
                                    <img
                                      srcSet={`${previewSrc} 1x, ${inlineUrl} 2x`}
                                      sizes="80px"
                                      src={previewSrc}
                                      alt={a.name || "Изображение"}
                                      className="h-full w-full object-cover transition group-hover:scale-105"
                                    />
                                  </button>
                                ) : (
                                  <a
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener"
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-sm text-accentPrimary transition hover:bg-slate-100"
                                  >
                                    {a.name || "Файл"}
                                  </a>
                                )}
                                {editing && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="px-0 text-red-500"
                                    onClick={() => removeAttachment(a)}
                                  >
                                    {t("delete")}
                                  </Button>
                                )}
                              </div>
                              {a.name ? (
                                <span className="max-w-[12rem] truncate text-xs text-slate-500">
                                  {a.name}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                  {photosLink ? (
                    <div>
                      <a
                        href={photosLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "pill" }),
                          "inline-flex w-fit",
                        )}
                      >
                        Фото
                      </a>
                    </div>
                  ) : null}
                  <FileUploader
                    disabled={!canUploadAttachments}
                    onUploaded={(a) => setAttachments((p) => [...p, a])}
                    onRemove={(a) => removeAttachment(a)}
                    taskId={effectiveTaskId}
                  />
                  {editing && !isTitleFilled ? (
                    <p className="mt-1 text-xs text-slate-500">
                      {t("fillTitleToUpload")}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    {isEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="pill"
                        onClick={() => setShowHistory(true)}
                      >
                        {t("history")}
                      </Button>
                    )}
                    <div className="ml-auto flex flex-wrap gap-2">
                      {editing &&
                      !isEdit &&
                      (draft || hasDraftChanges) && (
                        <Button
                          variant="ghost"
                          size="pill"
                          onClick={handleDeleteDraft}
                          disabled={draftLoading || isSavingDraft}
                        >
                          {t("clearDraft")}
                        </Button>
                      )}
                      {isEdit && canDeleteTask && editing && (
                        <Button
                          variant="destructive"
                          size="pill"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          {t("delete")}
                        </Button>
                      )}
                      {editing && (
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
                      )}
                    </div>
                  </div>
                  {editing && (
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
                  )}
                </div>
                <aside className="space-y-5 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
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
                        className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
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
                        className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                        disabled={!editing}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium">
                        {t("taskType")}
                      </label>
                      <select
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value)}
                        className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                        disabled={!editing || entityKind === "request"}
                      >
                        {(entityKind === "request"
                          ? requestTypeOptions
                          : taskTypeOptions
                        ).map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                        className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                        disabled={!editing}
                      >
                        {priorities.map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                        className="focus:ring-brand-200 focus:border-accentPrimary w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm focus:ring focus:outline-none"
                        disabled={!editing}
                      >
                        {statuses.map((option) => (
                          <option key={option} value={option}>
                            {option}
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
                  {showTransportFields && (
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <SingleSelect
                          label={t("transportDriver")}
                          options={driverOptions}
                          value={transportDriverId || null}
                          onChange={(option) => {
                            const value = option?.value ?? "";
                            setTransportDriverId(value);
                            if (!value) {
                              setTransportDriverName("");
                              return;
                            }
                            setTransportDriverName(option?.label ?? value);
                          }}
                          disabled={!canEditTransport || !transportRequiresDetails}
                          placeholder={t("transportDriverPlaceholder")}
                        />
                        {transportOptionsLoading && transportRequiresDetails ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {t("transportOptionsLoading")}
                          </p>
                        ) : null}
                        {transportOptionsError ? (
                          <p className="mt-1 text-xs text-red-600">
                            {transportOptionsError}
                            {canEditTransport ? (
                              <button
                                type="button"
                                className="ml-2 text-accentPrimary underline decoration-dotted"
                                onClick={() => {
                                  setTransportOptionsLoaded(false);
                                  void loadTransportOptions(true);
                                }}
                              >
                                {t("transportOptionsReload")}
                              </button>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <SingleSelect
                          label={t("transportVehicle")}
                          options={vehicleSelectOptions}
                          value={transportVehicleId || null}
                          onChange={(option) => {
                            const value = option?.value ?? "";
                            setTransportVehicleId(value);
                            if (!value) {
                              setTransportVehicleName("");
                              setTransportVehicleRegistration("");
                              return;
                            }
                            const candidate = vehicleOptions.find(
                              (vehicle) => vehicle.id === value,
                            );
                            if (candidate) {
                              setTransportVehicleName(candidate.name);
                              setTransportVehicleRegistration(
                                candidate.registrationNumber,
                              );
                            } else {
                              setTransportVehicleName(option?.label ?? value);
                              setTransportVehicleRegistration("");
                            }
                          }}
                          disabled={!canEditTransport || !transportRequiresDetails}
                          placeholder={t("transportVehiclePlaceholder")}
                        />
                        {!transportRequiresDetails && transportVehicleName ? (
                          <p className="mt-1 text-xs text-slate-500">
                            {transportVehicleRegistration
                              ? `${transportVehicleName} (${transportVehicleRegistration})`
                              : transportVehicleName}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </aside>
              </div>
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
              {isEdit && !editing && canChangeStatus && (
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
      {previewAttachment && (
        <div
          className="fixed inset-0 z-[1150] flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            className="relative max-h-[85vh] w-full max-w-5xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80 focus:outline-none focus:ring focus:ring-white/40"
              onClick={() => setPreviewAttachment(null)}
              aria-label={t("close")}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <img
              src={previewAttachment.url}
              alt={previewAttachment.name}
              className="max-h-[75vh] w-full rounded-xl object-contain shadow-2xl"
            />
            <p className="mt-3 text-center text-sm text-white/80">
              {previewAttachment.name}
            </p>
          </div>
        </div>
      )}
      {mapPicker ? (
        <MapPickerDialog
          open
          title={
            mapPicker.target === "start"
              ? t("selectStartPoint")
              : t("selectFinishPoint")
          }
          confirmLabel={t("mapSelectionConfirm", { defaultValue: t("save") })}
          cancelLabel={t("cancel")}
          hint={t("mapSelectionHint")}
          initialValue={mapPicker.initialCoords}
          onConfirm={(coords) => handleMapConfirm(mapPicker.target, coords)}
          onCancel={() => setMapPicker(null)}
        />
      ) : null}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded border-2 border-red-500 bg-white p-4">
            <h4 className="mb-2 font-semibold">{t("history")}</h4>
            <ul className="space-y-2 text-xs sm:text-sm">
              {history.length === 0 ? (
                <li className="text-gray-500">{t("historyEmpty")}</li>
              ) : (
                history.map((entry, index) => {
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
                        <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-gray-700 sm:text-sm">
                          <span>Изменил статус с</span>
                          {renderHistoryValueNode("status", fromStatus, "plain")}
                          <span>на</span>
                          {renderHistoryValueNode("status", toStatus, "plain")}
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
                                {renderHistoryValueNode(key, prevValue, "prev")}
                                <span className="text-gray-400">→</span>
                                {renderHistoryValueNode(key, nextValue, "next")}
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
                })
              )}
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
