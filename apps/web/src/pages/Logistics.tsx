// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, Leaflet, i18next
import React from "react";
import clsx from "clsx";
import fetchRouteGeometry from "../services/osrm";
import { fetchTasks } from "../services/tasks";
import optimizeRoute, {
  type OptimizeRoutePayload,
  type RouteOptimizationResult,
} from "../services/optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskTable from "../components/TaskTable";
import { useTranslation } from "react-i18next";
import L, { type LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import useTasks from "../context/useTasks";
import { useTaskIndex } from "../controllers/taskStateController";
import { listFleetVehicles } from "../services/fleets";
import { subscribeLogisticsEvents } from "../services/logisticsEvents";
import {
  PROJECT_TIMEZONE,
  TASK_STATUSES,
  type Coords,
  type FleetVehicleDto,
  type RoutePlan,
  type RoutePlanStatus,
} from "shared";
import {
  listRoutePlans,
  updateRoutePlan,
  changeRoutePlanStatus,
  type RoutePlanUpdatePayload,
} from "../services/routePlans";
import type { TaskRow } from "../columns/taskColumns";

type RouteTask = TaskRow & {
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
};

const TASK_STATUS_COLORS: Record<string, string> = {
  Новая: "#0ea5e9",
  "В работе": "#f97316",
  Выполнена: "#22c55e",
  Отменена: "#ef4444",
};

type LayerVisibilityState = {
  tasks: boolean;
  optimized: boolean;
};

const DEFAULT_LAYER_VISIBILITY: LayerVisibilityState = {
  tasks: true,
  optimized: true,
};

const LOAD_WARNING_RATIO = 0.85;
const ETA_WARNING_RATIO = 0.9;
const ETA_WARNING_MINUTES = 480;

const loadFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

type LogisticsDetails = {
  transport_type?: string | null;
  start_location?: string | null;
  end_location?: string | null;
};

const MAP_CENTER: [number, number] = [48.3794, 31.1656];
const MAP_ZOOM = 6;
const UKRAINE_BOUNDS: LatLngBoundsExpression = [
  [44, 22],
  [52.5, 40.5],
];

const WINDOW_FULL_DAY: [number, number] = [0, 24 * 60];

const timePartFormatter = new Intl.DateTimeFormat("uk-UA", {
  timeZone: PROJECT_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const extractWindowMinutes = (value?: string | null): number | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = timePartFormatter.formatToParts(date);
  const hourPart = parts.find((part) => part.type === "hour")?.value;
  const minutePart = parts.find((part) => part.type === "minute")?.value;
  if (!hourPart || !minutePart) return null;
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const buildTimeWindow = (
  start?: string | null,
  end?: string | null,
): [number, number] | undefined => {
  const startMinutes = extractWindowMinutes(start);
  const endMinutes = extractWindowMinutes(end);
  if (startMinutes === null && endMinutes === null) {
    return undefined;
  }
  const safeStart = startMinutes ?? WINDOW_FULL_DAY[0];
  const safeEnd = endMinutes ?? WINDOW_FULL_DAY[1];
  return [safeStart, Math.max(safeStart, safeEnd)];
};

const hasPoint = (coords?: Coords | null) =>
  typeof coords?.lat === "number" &&
  Number.isFinite(coords.lat) &&
  typeof coords?.lng === "number" &&
  Number.isFinite(coords.lng);

export default function LogisticsPage() {
  const { t, i18n } = useTranslation();
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
  const language = i18n.language;
  const tasks = useTaskIndex("logistics:all") as RouteTask[];
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
  const [vehicles, setVehicles] = React.useState(1);
  const [method, setMethod] = React.useState("angle");
  const [links, setLinks] = React.useState<string[]>([]);
  const [plan, setPlan] = React.useState<RoutePlan | null>(null);
  const [planDraft, setPlanDraft] = React.useState<RoutePlan | null>(null);
  const [planMessage, setPlanMessage] = React.useState("");
  const [planMessageTone, setPlanMessageTone] = React.useState<
    "neutral" | "error" | "success"
  >("neutral");
  const [planLoading, setPlanLoading] = React.useState(false);
  const mapRef = React.useRef<L.Map | null>(null);
  const optLayerRef = React.useRef<L.LayerGroup | null>(null);
  const tasksLayerRef = React.useRef<L.LayerGroup | null>(null);
  const autoJobRef = React.useRef({
    refreshTasks: false,
    refreshPlan: false,
    recalc: false,
  });
  const autoTimerRef = React.useRef<number | null>(null);
  const [availableVehicles, setAvailableVehicles] = React.useState<
    FleetVehicleDto[]
  >([]);
  const [fleetError, setFleetError] = React.useState("");
  const [vehiclesHint, setVehiclesHint] = React.useState("");
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [layerVisibility, setLayerVisibility] = React.useState<LayerVisibilityState>(
    DEFAULT_LAYER_VISIBILITY,
  );
  const [mapReady, setMapReady] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const hasLoadedFleetRef = React.useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const hasDialog = params.has("task") || params.has("newTask");
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;

  const legendItems = React.useMemo(
    () =>
      TASK_STATUSES.map((status) => ({
        key: status,
        label: status,
        color: TASK_STATUS_COLORS[status] ?? "#2563eb",
      })),
    [],
  );

  const taskIndex = React.useMemo(
    () => new Map(sorted.map((task) => [task._id, task])),
    [sorted],
  );

  const buildPlanFromOptimization = React.useCallback(
    (result: RouteOptimizationResult): RoutePlan | null => {
      if (!result.routes.length) {
        return null;
      }
      const planRoutes: RoutePlan["routes"] = [];

      result.routes.forEach((route, routeIndex) => {
        const tasksForRoute = route.taskIds
          .map((id) => taskIndex.get(id))
          .filter((task): task is RouteTask => Boolean(task));

        if (!tasksForRoute.length) {
          return;
        }

        const taskRefs = tasksForRoute.map((task, order) => {
          const details = (task as Record<string, unknown>)
            .logistics_details as LogisticsDetails | undefined;
          const startAddress =
            typeof details?.start_location === "string"
              ? details.start_location.trim()
              : "";
          const finishAddress =
            typeof details?.end_location === "string"
              ? details.end_location.trim()
              : "";
          const windowStart =
            typeof (task as Record<string, unknown>).delivery_window_start ===
            "string"
              ? ((task as Record<string, unknown>).delivery_window_start as string)
              : null;
          const windowEnd =
            typeof (task as Record<string, unknown>).delivery_window_end ===
            "string"
              ? ((task as Record<string, unknown>).delivery_window_end as string)
              : null;
          const distance = Number(task.route_distance_km);
          return {
            taskId: task._id,
            order,
            title: task.title,
            start: task.startCoordinates,
            finish: task.finishCoordinates,
            startAddress: startAddress || null,
            finishAddress: finishAddress || null,
            distanceKm:
              Number.isFinite(distance) && !Number.isNaN(distance)
                ? distance
                : null,
            windowStart,
            windowEnd,
          } satisfies RoutePlan["routes"][number]["tasks"][number];
        });

        const stops = taskRefs.flatMap((taskRef) => {
          const routeStops: RoutePlan["routes"][number]["stops"] = [];
          if (taskRef.start) {
            routeStops.push({
              order: taskRef.order * 2,
              kind: "start",
              taskId: taskRef.taskId,
              coordinates: taskRef.start,
              address: taskRef.startAddress ?? null,
            });
          }
          if (taskRef.finish) {
            routeStops.push({
              order: taskRef.order * 2 + 1,
              kind: "finish",
              taskId: taskRef.taskId,
              coordinates: taskRef.finish,
              address: taskRef.finishAddress ?? null,
            });
          }
          return routeStops;
        });

        const planRoute: RoutePlan["routes"][number] = {
          id: `route-${routeIndex + 1}`,
          order: routeIndex,
          vehicleId: null,
          vehicleName: null,
          driverId: null,
          driverName: null,
          tasks: taskRefs,
          stops,
          metrics: {
            distanceKm: route.distanceKm,
            tasks: taskRefs.length,
            stops: stops.length,
          },
          routeLink: null,
          notes: null,
        };

        planRoutes.push(planRoute);
      });

      if (!planRoutes.length) {
        return null;
      }

      const totalTasks = planRoutes.reduce((sum, route) => sum + route.tasks.length, 0);
      const totalStops = planRoutes.reduce(
        (sum, route) => sum + (route.metrics?.stops ?? 0),
        0,
      );

      return {
        id: "optimization-draft",
        title: "Черновик оптимизации",
        status: "draft",
        suggestedBy: null,
        method: undefined,
        count: result.routes.length,
        notes: null,
        approvedBy: null,
        approvedAt: null,
        completedBy: null,
        completedAt: null,
        metrics: {
          totalDistanceKm: result.totalDistanceKm,
          totalRoutes: planRoutes.length,
          totalTasks,
          totalStops,
        },
        routes: planRoutes,
        tasks: planRoutes.flatMap((route) => route.tasks.map((task) => task.taskId)),
        createdAt: undefined,
        updatedAt: undefined,
      } satisfies RoutePlan;
    },
    [taskIndex],
  );

  const clonePlan = React.useCallback(
    (value: RoutePlan | null) =>
      value ? (JSON.parse(JSON.stringify(value)) as RoutePlan) : null,
    [],
  );

  const applyPlan = React.useCallback(
    (next: RoutePlan | null) => {
      setPlan(next);
      setPlanDraft(clonePlan(next));
      const newLinks = next
        ? next.routes
            .map((route) => route.routeLink)
            .filter((link): link is string => Boolean(link))
        : [];
      setLinks(newLinks);
    },
    [clonePlan],
  );

  const loadPlan = React.useCallback(async () => {
    setPlanLoading(true);
    setPlanMessage('');
    setPlanMessageTone('neutral');
    try {
      const drafts = await listRoutePlans('draft', 1, 1);
      if (drafts.items.length > 0) {
        applyPlan(drafts.items[0]);
        return;
      }
      const latest = await listRoutePlans(undefined, 1, 1);
      if (latest.items.length > 0) {
        applyPlan(latest.items[0]);
        return;
      }
      applyPlan(null);
      setPlanMessage(tRef.current('logistics.planEmpty'));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planLoadError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [applyPlan]);

  const buildUpdatePayload = React.useCallback(
    (source: RoutePlan): RoutePlanUpdatePayload => ({
      title: source.title,
      notes: source.notes ?? null,
      routes: source.routes.map((route) => ({
        id: route.id,
        order: route.order,
        vehicleId: route.vehicleId ?? null,
        vehicleName: route.vehicleName ?? null,
        driverId: route.driverId ?? null,
        driverName: route.driverName ?? null,
        notes: route.notes ?? null,
        tasks: route.tasks.map((task) => task.taskId),
      })),
    }),
    [],
  );

  const updateRouteDraft = React.useCallback(
    (
      routeIndex: number,
      updater: (route: RoutePlan['routes'][number]) => RoutePlan['routes'][number],
    ) => {
      setPlanDraft((current) => {
        if (!current) return current;
        const routes = current.routes.map((route, idx) =>
          idx === routeIndex ? updater(route) : route,
        );
        return { ...current, routes };
      });
    },
    [],
  );

  const handlePlanTitleChange = React.useCallback((value: string) => {
    setPlanDraft((current) => (current ? { ...current, title: value } : current));
  }, []);

  const handlePlanNotesChange = React.useCallback((value: string) => {
    setPlanDraft((current) => (current ? { ...current, notes: value } : current));
  }, []);

  const handleDriverNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, driverName: value }));
    },
    [updateRouteDraft],
  );

  const handleVehicleNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, vehicleName: value }));
    },
    [updateRouteDraft],
  );

  const handleRouteNotesChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({ ...route, notes: value || null }));
    },
    [updateRouteDraft],
  );

  const handleMoveTask = React.useCallback(
    (routeIndex: number, taskIndex: number, direction: number) => {
      setPlanDraft((current) => {
        if (!current) return current;
        const routes = current.routes.map((route, idx) => {
          if (idx !== routeIndex) return route;
          const tasks = [...route.tasks];
          const targetIndex = taskIndex + direction;
          if (targetIndex < 0 || targetIndex >= tasks.length) {
            return route;
          }
          const [task] = tasks.splice(taskIndex, 1);
          tasks.splice(targetIndex, 0, task);
          return {
            ...route,
            tasks: tasks.map((item, order) => ({ ...item, order })),
          };
        });
        return { ...current, routes };
      });
    },
    [],
  );

  const handleSavePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const payload = buildUpdatePayload(planDraft);
      const updated = await updateRoutePlan(planDraft.id, payload);
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planSaved'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planSaveError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, buildUpdatePayload, applyPlan]);

  const handleApprovePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, 'approved');
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planPublished'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planStatusError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleCompletePlan = React.useCallback(async () => {
    if (!planDraft) return;
    setPlanLoading(true);
    try {
      const updated = await changeRoutePlanStatus(planDraft.id, 'completed');
      applyPlan(updated);
      setPlanMessage(tRef.current('logistics.planCompleted'));
      setPlanMessageTone('success');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planStatusError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [planDraft, applyPlan]);

  const handleReloadPlan = React.useCallback(async () => {
    setPlanMessage('');
    setPlanMessageTone('neutral');
    await loadPlan();
  }, [loadPlan]);

  const handleClearPlan = React.useCallback(() => {
    applyPlan(null);
    setPlanMessage(tRef.current('logistics.planEmpty'));
    setPlanMessageTone('neutral');
  }, [applyPlan]);

  React.useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  React.useEffect(() => {
    const translate = tRef.current;
    const title = translate("logistics.metaTitle");
    const description = translate("logistics.metaDescription");
    const image = "/hero/logistics.png";

    document.title = title;

    const ensureMeta = (
      attribute: "name" | "property",
      name: string,
      value: string,
    ) => {
      let element = document.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", value);
    };

    ensureMeta("name", "description", description);
    ensureMeta("property", "og:title", title);
    ensureMeta("property", "og:description", description);
    ensureMeta("property", "og:image", image);
  }, [language]);

  const openTask = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(location.search);
      params.set("task", id);
      navigate({ search: params.toString() }, { replace: true });
    },
    [location, navigate],
  );

  const filterRouteTasks = React.useCallback((input: RouteTask[]) => {
    return input.filter((task) => {
      const details = (task as Record<string, unknown>)
        .logistics_details as LogisticsDetails | undefined;
      const transportTypeRaw =
        typeof details?.transport_type === "string"
          ? details.transport_type.trim()
          : "";
      const normalizedTransportType = transportTypeRaw.toLowerCase();
      const hasTransportType =
        Boolean(transportTypeRaw) && normalizedTransportType !== "без транспорта";

      if (!hasTransportType) {
        return false;
      }

      const hasCoordinates = hasPoint(task.startCoordinates) || hasPoint(task.finishCoordinates);
      const hasAddresses =
        (typeof details?.start_location === "string" &&
          details.start_location.trim().length > 0) ||
        (typeof details?.end_location === "string" &&
          details.end_location.trim().length > 0);

      return hasCoordinates || hasAddresses;
    });
  }, []);

  const load = React.useCallback(async () => {
    const userId = Number((user as any)?.telegram_id) || undefined;
    try {
      const data = await fetchTasks({}, userId, true);
      const raw = Array.isArray(data)
        ? data
        : data.items || data.tasks || data.data || [];
      const mapped: Array<RouteTask | null> = raw.map((item: Record<string, unknown>) => {
        const task = item as RouteTask & { id?: string };
        const identifier = String(task._id ?? task.id ?? "").trim();
        if (!identifier) {
          return null;
        }
        return {
          ...task,
          id: identifier,
          _id: identifier,
        } satisfies RouteTask;
      });
      const list = mapped.filter(
        (task): task is RouteTask => Boolean(task),
      );
      const filtered = filterRouteTasks(list);
      controller.setIndex("logistics:all", filtered, {
        kind: "task",
        mine: false,
        userId,
        pageSize: filtered.length,
        total: filtered.length,
        sort: "desc",
      });
      setSorted(filtered);
      return filtered;
    } catch (error) {
      console.error("Не удалось загрузить задачи логистики", error);
      setSorted([]);
      controller.setIndex("logistics:all", [], {
        kind: "task",
        mine: false,
        userId,
        pageSize: 0,
        total: 0,
        sort: "desc",
      });
      return [];
    }
  }, [controller, filterRouteTasks, user]);

  const loadFleetVehicles = React.useCallback(async () => {
    if (role !== "admin") return;
    setVehiclesLoading(true);
    setVehiclesHint("");
    setFleetError("");
    try {
      const data = await listFleetVehicles("", 1, 100);
      setAvailableVehicles(data.items);
      if (!data.items.length) {
        setVehiclesHint(tRef.current("logistics.noVehicles"));
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current("logistics.loadError");
      setVehiclesHint(message);
      setAvailableVehicles([]);
      setFleetError(message);
    } finally {
      setVehiclesLoading(false);
    }
  }, [role, tRef]);

  const refreshAll = React.useCallback(() => {
    void load();
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [load, loadFleetVehicles, role]);

  const refreshFleet = React.useCallback(() => {
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  const scheduleAutoRecalculate = React.useCallback(
    (
      options: {
        refreshTasks?: boolean;
        refreshPlan?: boolean;
        recalc?: boolean;
      } = {},
    ) => {
      autoJobRef.current = {
        refreshTasks:
          autoJobRef.current.refreshTasks || Boolean(options.refreshTasks),
        refreshPlan:
          autoJobRef.current.refreshPlan || Boolean(options.refreshPlan),
        recalc: autoJobRef.current.recalc || Boolean(options.recalc),
      };
      if (autoTimerRef.current !== null) {
        return;
      }
      autoTimerRef.current = window.setTimeout(async () => {
        const job = autoJobRef.current;
        autoJobRef.current = {
          refreshTasks: false,
          refreshPlan: false,
          recalc: false,
        };
        autoTimerRef.current = null;
        try {
          if (job.refreshTasks) {
            await load();
          }
          if (job.refreshPlan) {
            await loadPlan();
          }
          if (job.recalc) {
            await calculate();
          }
        } catch (error) {
          console.error("Не удалось выполнить автообновление логистики", error);
        }
      }, 800);
    },
    [calculate, load, loadPlan],
  );

  const formatEta = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return tRef.current("logistics.planNoEta");
      }
      const safeValue = Math.max(0, Math.round(value));
      const hours = Math.floor(safeValue / 60);
      const minutes = safeValue % 60;
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(tRef.current("logistics.etaHours", { count: hours }));
      }
      if (minutes > 0 || parts.length === 0) {
        parts.push(tRef.current("logistics.etaMinutes", { count: minutes }));
      }
      return parts.join(" ");
    },
    [tRef],
  );

  const formatLoad = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return tRef.current("logistics.planNoLoad");
      }
      const normalized = Math.max(0, Number(value.toFixed(1)));
      return tRef.current("logistics.loadValue", {
        value: loadFormatter.format(normalized),
      });
    },
    [tRef],
  );

  const formatDelay = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return tRef.current("logistics.onTime");
      }
      return tRef.current("logistics.delayLabel", {
        minutes: Math.max(1, Math.round(value)),
      });
    },
    [tRef],
  );

  const formatWindow = React.useCallback(
    (start?: number | null, end?: number | null) => {
      const toLabel = (input?: number | null) => {
        if (typeof input !== "number" || !Number.isFinite(input)) {
          return null;
        }
        const safe = Math.max(0, Math.round(input));
        const hours = Math.floor(safe / 60)
          .toString()
          .padStart(2, "0");
        const minutes = (safe % 60).toString().padStart(2, "0");
        return `${hours}:${minutes}`;
      };
      const startLabel = toLabel(start ?? null);
      const endLabel = toLabel(end ?? null);
      if (startLabel && endLabel) {
        return `${startLabel} – ${endLabel}`;
      }
      if (startLabel) {
        return tRef.current("logistics.windowFrom", { value: startLabel });
      }
      if (endLabel) {
        return tRef.current("logistics.windowTo", { value: endLabel });
      }
      return tRef.current("logistics.windowUnknown");
    },
    [tRef],
  );

  const formatDistance = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return `${value.toFixed(1)} ${tRef.current('km')}`;
      }
      return tRef.current("logistics.planNoDistance");
    },
    [tRef],
  );

  const calculate = React.useCallback(async () => {
    const payloadTasks = sorted
      .filter((task) => hasPoint(task.startCoordinates))
      .map((task) => {
        const details = (task as Record<string, unknown>)
          .logistics_details as LogisticsDetails | undefined;
        const startAddress =
          typeof details?.start_location === 'string'
            ? details.start_location.trim()
            : '';
        const finishAddress =
          typeof details?.end_location === 'string'
            ? details.end_location.trim()
            : '';
        const windowStartRaw =
          typeof (task as Record<string, unknown>).delivery_window_start ===
          'string'
            ? ((task as Record<string, unknown>).delivery_window_start as string)
            : null;
        const windowEndRaw =
          typeof (task as Record<string, unknown>).delivery_window_end === 'string'
            ? ((task as Record<string, unknown>).delivery_window_end as string)
            : null;
        const timeWindow = buildTimeWindow(windowStartRaw, windowEndRaw);
        return {
          id: task._id,
          coordinates: task.startCoordinates as Coords,
          demand: 1,
          serviceMinutes: undefined,
          title: task.title,
          startAddress: startAddress || undefined,
          finishAddress: finishAddress || undefined,
          timeWindow: timeWindow ?? undefined,
        } satisfies OptimizeRoutePayload['tasks'][number];
      });

    if (!payloadTasks.length) {
      applyPlan(null);
      setPlanMessage(tRef.current('logistics.planEmpty'));
      setPlanMessageTone('neutral');
      return;
    }

    const averageSpeed = method === 'trip' ? 45 : 30;
    const payload: OptimizeRoutePayload = {
      tasks: payloadTasks,
      vehicleCapacity: Math.max(1, payloadTasks.length),
      vehicleCount: Math.max(1, vehicles),
      averageSpeedKmph: averageSpeed,
    };

    setPlanLoading(true);
    setPlanMessage('');
    setPlanMessageTone('neutral');
    try {
      const result = await optimizeRoute(payload);
      if (!result || !result.routes.length) {
        applyPlan(null);
        setPlanMessage(tRef.current('logistics.planEmpty'));
        return;
      }

      const nextPlan = buildPlanFromOptimization(result);
      if (!nextPlan) {
        applyPlan(null);
        setPlanMessage(tRef.current('logistics.planEmpty'));
        return;
      }

      applyPlan(nextPlan);
      const summaryParts = [
        tRef.current('logistics.planDraftCreated'),
        `${tRef.current('logistics.etaLabel')}: ${formatEta(result.totalEtaMinutes)}`,
        `${tRef.current('logistics.loadLabel')}: ${formatLoad(result.totalLoad)}`,
      ];
      if (result.warnings.length) {
        summaryParts.push(result.warnings.join('; '));
      }
      setPlanMessage(summaryParts.join(' · '));
      setPlanMessageTone(result.warnings.length ? 'neutral' : 'success');

      if (!mapRef.current) {
        return;
      }
      if (optLayerRef.current) {
        optLayerRef.current.remove();
      }
      const group = L.layerGroup();
      if (layerVisibility.optimized) {
        group.addTo(mapRef.current);
      }
      optLayerRef.current = group;
      const colors = ['#ef4444', '#22c55e', '#f97316'];
      nextPlan.routes.forEach((route, idx) => {
        const latlngs: Array<[number, number]> = [];
        route.tasks.forEach((task) => {
          if (task.start) {
            latlngs.push([task.start.lat, task.start.lng]);
          }
          if (task.finish) {
            latlngs.push([task.finish.lat, task.finish.lng]);
          }
        });
        if (latlngs.length < 2) {
          return;
        }
        L.polyline(latlngs, {
          color: colors[idx % colors.length],
          weight: 4,
        }).addTo(group);
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.planOptimizeError');
      setPlanMessage(message);
      setPlanMessageTone('error');
    } finally {
      setPlanLoading(false);
    }
  }, [
    applyPlan,
    buildPlanFromOptimization,
    formatEta,
    formatLoad,
    layerVisibility.optimized,
    method,
    sorted,
    tRef,
    vehicles,
  ]);

  const planMessageClass = React.useMemo(() => {
    if (planMessageTone === 'error') {
      return 'text-sm text-red-600';
    }
    if (planMessageTone === 'success') {
      return 'text-sm text-emerald-600';
    }
    return 'text-sm text-muted-foreground';
  }, [planMessageTone]);

  const planStatus: RoutePlanStatus = planDraft?.status ?? plan?.status ?? 'draft';
  const planStatusLabel = t(`logistics.planStatusValue.${planStatus}`);
  const isPlanEditable = planStatus !== 'completed';
  const draftRoutes = planDraft?.routes;
  const planRoutes = React.useMemo(() => draftRoutes ?? [], [draftRoutes]);
  const totalStops = React.useMemo(() => {
    if (typeof planDraft?.metrics?.totalStops === 'number') {
      return planDraft.metrics.totalStops;
    }
    if (!planDraft) {
      return 0;
    }
    return planDraft.routes.reduce((acc, route) => acc + route.stops.length, 0);
  }, [planDraft]);
  const planTotalRoutes = planDraft?.metrics?.totalRoutes ?? planRoutes.length;
  const planTotalTasks = planDraft?.metrics?.totalTasks ?? planDraft?.tasks.length ?? 0;
  const planTotalEtaMinutes = planDraft?.metrics?.totalEtaMinutes ?? null;
  const planTotalLoad = planDraft?.metrics?.totalLoad ?? null;

  const routeAnalytics = React.useMemo(() => {
    const routeStatus = new Map<
      string,
      { overloaded: boolean; delayed: boolean; etaMinutes: number | null; load: number | null }
    >();
    const taskStatus = new Map<
      string,
      {
        overloaded: boolean;
        delayed: boolean;
        delayMinutes: number;
        etaMinutes: number | null;
        routeLoad: number | null;
        routeId: string;
      }
    >();
    const stopDetails = new Map<
      string,
      { start?: RoutePlan['routes'][number]['stops'][number]; finish?: RoutePlan['routes'][number]['stops'][number] }
    >();
    let maxLoadValue = 0;
    let maxEtaValue = 0;

    planRoutes.forEach((route) => {
      const loadValue =
        typeof route.metrics?.load === 'number' && Number.isFinite(route.metrics.load)
          ? Number(route.metrics.load)
          : null;
      const etaValue =
        typeof route.metrics?.etaMinutes === 'number' && Number.isFinite(route.metrics.etaMinutes)
          ? Number(route.metrics.etaMinutes)
          : null;
      if (typeof loadValue === 'number' && loadValue > maxLoadValue) {
        maxLoadValue = loadValue;
      }
      if (typeof etaValue === 'number' && etaValue > maxEtaValue) {
        maxEtaValue = etaValue;
      }
      route.tasks.forEach((taskRef) => {
        if (!stopDetails.has(taskRef.taskId)) {
          stopDetails.set(taskRef.taskId, {});
        }
      });
    });

    const loadThreshold = maxLoadValue > 0 ? maxLoadValue * LOAD_WARNING_RATIO : 0;
    const etaThresholdBase = maxEtaValue > 0 ? maxEtaValue * ETA_WARNING_RATIO : 0;
    const etaThreshold = Math.max(ETA_WARNING_MINUTES, etaThresholdBase);

    planRoutes.forEach((route, index) => {
      const routeId = route.id || `route-${index}`;
      const loadValue =
        typeof route.metrics?.load === 'number' && Number.isFinite(route.metrics.load)
          ? Number(route.metrics.load)
          : null;
      const etaValue =
        typeof route.metrics?.etaMinutes === 'number' && Number.isFinite(route.metrics.etaMinutes)
          ? Number(route.metrics.etaMinutes)
          : null;

      const overloaded =
        typeof loadValue === 'number' && loadThreshold > 0 ? loadValue >= loadThreshold : false;
      const delayed =
        typeof etaValue === 'number' && etaThreshold > 0 ? etaValue >= etaThreshold : false;

      routeStatus.set(routeId, {
        overloaded,
        delayed,
        etaMinutes: etaValue ?? null,
        load: loadValue ?? null,
      });

      route.tasks.forEach((taskRef) => {
        const key = taskRef.taskId;
        const current =
          taskStatus.get(key) ?? {
            overloaded: false,
            delayed: false,
            delayMinutes: 0,
            etaMinutes: null,
            routeLoad: null,
            routeId,
          };
        current.overloaded = current.overloaded || overloaded;
        if (typeof etaValue === 'number') {
          current.etaMinutes =
            typeof current.etaMinutes === 'number'
              ? Math.max(current.etaMinutes, etaValue)
              : etaValue;
        }
        if (typeof loadValue === 'number') {
          current.routeLoad = loadValue;
        }
        current.routeId = routeId;
        taskStatus.set(key, current);
      });

      route.stops.forEach((stop) => {
        const key = stop.taskId;
        if (!key) return;
        const current =
          taskStatus.get(key) ?? {
            overloaded,
            delayed: false,
            delayMinutes: 0,
            etaMinutes: null,
            routeLoad: loadValue ?? null,
            routeId,
          };
        if (typeof stop.delayMinutes === 'number' && stop.delayMinutes > 0) {
          current.delayed = true;
          current.delayMinutes = Math.max(current.delayMinutes, stop.delayMinutes);
        }
        if (typeof stop.etaMinutes === 'number') {
          current.etaMinutes =
            typeof current.etaMinutes === 'number'
              ? Math.max(current.etaMinutes, stop.etaMinutes)
              : stop.etaMinutes;
        }
        if (typeof loadValue === 'number') {
          current.routeLoad = loadValue;
        }
        current.routeId = routeId;
        taskStatus.set(key, current);

        const info = stopDetails.get(key) ?? {};
        if (stop.kind === 'start') {
          info.start = stop;
        } else {
          info.finish = stop;
        }
        stopDetails.set(key, info);
      });
    });

    return { maxLoad: maxLoadValue, maxEta: maxEtaValue, routeStatus, taskStatus, stopDetails };
  }, [planRoutes]);

  const { maxLoad, maxEta, routeStatus, taskStatus, stopDetails } = routeAnalytics;

  const loadSeries = React.useMemo(
    () =>
      planRoutes.map((route, idx) => {
        const key = route.id || `route-${idx}`;
        const displayIndex =
          typeof route.order === 'number' && Number.isFinite(route.order)
            ? route.order + 1
            : idx + 1;
        const value =
          typeof route.metrics?.load === 'number' && Number.isFinite(route.metrics.load)
            ? Number(route.metrics.load)
            : 0;
        return {
          key,
          index: displayIndex,
          value,
          highlighted: routeStatus.get(key)?.overloaded ?? false,
        };
      }),
    [planRoutes, routeStatus],
  );

  const etaSeries = React.useMemo(
    () =>
      planRoutes.map((route, idx) => {
        const key = route.id || `route-${idx}`;
        const displayIndex =
          typeof route.order === 'number' && Number.isFinite(route.order)
            ? route.order + 1
            : idx + 1;
        const value =
          typeof route.metrics?.etaMinutes === 'number' && Number.isFinite(route.metrics.etaMinutes)
            ? Number(route.metrics.etaMinutes)
            : 0;
        return {
          key,
          index: displayIndex,
          value,
          highlighted: routeStatus.get(key)?.delayed ?? false,
        };
      }),
    [planRoutes, routeStatus],
  );

  const reset = React.useCallback(() => {
    if (optLayerRef.current) {
      optLayerRef.current.remove();
      optLayerRef.current = null;
    }
    setLinks([]);
  }, []);

  React.useEffect(
    () => () => {
      if (autoTimerRef.current !== null) {
        window.clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    },
    [],
  );

  React.useEffect(() => {
    void load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [tasks]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return () => undefined;
    }
    const unsubscribe = subscribeLogisticsEvents(
      (event) => {
        if (event.type === "tasks.changed") {
          scheduleAutoRecalculate({
            refreshTasks: true,
            refreshPlan: true,
            recalc: true,
          });
        } else if (event.type === "route-plan.updated") {
          applyPlan(event.plan);
          setPlanMessage(tRef.current("logistics.planSaved"));
          setPlanMessageTone("success");
        } else if (event.type === "route-plan.removed") {
          applyPlan(null);
          setPlanMessage(tRef.current("logistics.planEmpty"));
          setPlanMessageTone("neutral");
        }
      },
      () => {
        setPlanMessage(tRef.current("logistics.planLoadError"));
        setPlanMessageTone("error");
      },
    );
    return () => {
      unsubscribe();
    };
  }, [applyPlan, scheduleAutoRecalculate, tRef]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== "admin") {
      hasLoadedFleetRef.current = false;
      setAvailableVehicles([]);
      setFleetError(role === "manager" ? translate("logistics.adminOnly") : "");
      setVehiclesHint(role ? translate("logistics.noAccess") : "");
      return;
    }
    setVehiclesHint("");
    setFleetError("");
    if (!hasLoadedFleetRef.current) {
      hasLoadedFleetRef.current = true;
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== "admin") {
      return;
    }
    if (!availableVehicles.length && !fleetError && !vehiclesLoading) {
      setVehiclesHint(translate("logistics.noVehicles"));
    }
  }, [availableVehicles.length, fleetError, role, vehiclesLoading]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;
    const map = L.map("logistics-map", {
      maxBounds: UKRAINE_BOUNDS,
      maxBoundsViscosity: 1,
      minZoom: 5,
      maxZoom: 12,
    }).setView(MAP_CENTER, MAP_ZOOM);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    tasksLayerRef.current = L.layerGroup().addTo(map);
    setMapReady(true);
    return () => {
      map.remove();
      if (optLayerRef.current) optLayerRef.current.remove();
      tasksLayerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [hasDialog]);

  React.useEffect(() => {
    if (!mapRef.current || !optLayerRef.current) return;
    if (layerVisibility.optimized) {
      optLayerRef.current.addTo(mapRef.current);
    } else {
      optLayerRef.current.remove();
    }
  }, [layerVisibility.optimized]);

  React.useEffect(() => {
    const group = tasksLayerRef.current;
    if (!mapRef.current || !group || !mapReady) return;
    group.clearLayers();
    if (!layerVisibility.tasks) return;
    if (!sorted.length) return;
    const createMarkerIcon = (kind: "start" | "finish", color: string) =>
      L.divIcon({
        className: `task-marker task-marker--${kind}`,
        html: `<span style="--marker-color:${color}"></span>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    let cancelled = false;
    (async () => {
      for (const t of sorted) {
        if (!t.startCoordinates || !t.finishCoordinates || cancelled) continue;
        const coords = (await fetchRouteGeometry(
          t.startCoordinates,
          t.finishCoordinates,
        )) as ([number, number][] | null);
        if (!coords || cancelled) continue;
        const latlngs = coords.map(([lng, lat]) =>
          [lat, lng] as [number, number],
        );
        const statusKey =
          typeof t.status === "string" ? t.status.trim() : "";
        const taskInfo = taskStatus.get(t._id);
        const defaultColor = TASK_STATUS_COLORS[statusKey] ?? "#2563eb";
        let routeColor = defaultColor;
        if (taskInfo?.overloaded) {
          routeColor = "#dc2626";
        } else if (taskInfo?.delayed) {
          routeColor = "#f97316";
        }
        const markerColor = taskInfo?.delayed ? "#f97316" : routeColor;
        const stopInfo = stopDetails.get(t._id);
        const tooltipParts = [
          `<div class="font-semibold">${escapeHtml(t.title ?? t._id ?? '')}</div>`,
          `<div>${escapeHtml(tRef.current('logistics.etaLabel'))}: ${escapeHtml(
            formatEta(taskInfo?.etaMinutes ?? null),
          )}</div>`,
          `<div>${escapeHtml(tRef.current('logistics.loadLabel'))}: ${escapeHtml(
            formatLoad(taskInfo?.routeLoad ?? null),
          )}</div>`,
          `<div class="${taskInfo?.delayed ? 'text-red-600' : 'text-emerald-600'}">${escapeHtml(
            formatDelay(taskInfo?.delayMinutes ?? null),
          )}</div>`,
        ];
        if (stopInfo?.start?.address) {
          tooltipParts.push(
            `<div>${escapeHtml(tRef.current('logistics.stopPickupShort'))}: ${escapeHtml(
              stopInfo.start.address,
            )}</div>`,
          );
        }
        if (stopInfo?.finish?.address) {
          tooltipParts.push(
            `<div>${escapeHtml(tRef.current('logistics.stopDropoffShort'))}: ${escapeHtml(
              stopInfo.finish.address,
            )}</div>`,
          );
        }
        const tooltipHtml = `<div class="space-y-1 text-xs">${tooltipParts.join('')}</div>`;
        L.polyline(latlngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.85,
        }).addTo(group);
        const startMarker = L.marker(latlngs[0], {
          icon: createMarkerIcon("start", markerColor),
        }).bindTooltip(tooltipHtml, { opacity: 0.95 });
        const endMarker = L.marker(latlngs[latlngs.length - 1], {
          icon: createMarkerIcon("finish", markerColor),
        }).bindTooltip(tooltipHtml, { opacity: 0.95 });
        startMarker.on("click", () => openTask(t._id));
        endMarker.on("click", () => openTask(t._id));
        startMarker.addTo(group);
        endMarker.addTo(group);
      }
    })();
    return () => {
      cancelled = true;
      group.clearLayers();
    };
  }, [
    formatDelay,
    formatEta,
    formatLoad,
    layerVisibility.tasks,
    mapReady,
    openTask,
    sorted,
    stopDetails,
    taskStatus,
    tRef,
  ]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (typeof map.invalidateSize === "function") {
      map.invalidateSize();
    }
  }, [hasDialog, mapReady]);

  return (
    <div className="space-y-3 sm:space-y-4">
      <h2 className="text-xl font-semibold">{t("logistics.title")}</h2>
      <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {t("logistics.planSectionTitle")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t("logistics.planSummary")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {t("logistics.planStatus")}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
              {planStatusLabel}
            </span>
            {planLoading ? (
              <span className="text-xs text-muted-foreground">
                {t("loading")}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleReloadPlan}
            disabled={planLoading}
          >
            {planLoading
              ? t("loading")
              : t("logistics.planReload")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClearPlan}
            disabled={planLoading}
          >
            {t("logistics.planClear")}
          </Button>
          <Button
            type="button"
            onClick={handleSavePlan}
            disabled={!planDraft || !isPlanEditable || planLoading}
          >
            {t("save")}
          </Button>
          {planDraft?.status === "draft" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleApprovePlan}
              disabled={planLoading}
            >
              {t("logistics.planApprove")}
            </Button>
          ) : null}
          {planDraft?.status === "approved" ? (
            <Button
              type="button"
              variant="success"
              onClick={handleCompletePlan}
              disabled={planLoading}
            >
              {t("logistics.planComplete")}
            </Button>
          ) : null}
        </div>
        {planDraft ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t("logistics.planTitleLabel")}
                </span>
                <Input
                  value={planDraft.title}
                  onChange={(event) =>
                    handlePlanTitleChange(event.target.value)
                  }
                  disabled={!isPlanEditable || planLoading}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t("logistics.planNotesLabel")}
                </span>
                <textarea
                  value={planDraft.notes ?? ""}
                  onChange={(event) =>
                    handlePlanNotesChange(event.target.value)
                  }
                  className="min-h-[96px] rounded border px-3 py-2 text-sm"
                  disabled={!isPlanEditable || planLoading}
                />
              </label>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-semibold uppercase text-muted-foreground">
                {t("logistics.planSummary")}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalDistance")}
                  </div>
                  <div className="font-semibold">
                    {formatDistance(planDraft.metrics?.totalDistanceKm ?? null)}
                  </div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalRoutes")}
                  </div>
                  <div className="font-semibold">{planTotalRoutes}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalTasks")}
                  </div>
                  <div className="font-semibold">{planTotalTasks}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalStops")}
                  </div>
                  <div className="font-semibold">{totalStops}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalEta")}
                  </div>
                  <div className="font-semibold">{formatEta(planTotalEtaMinutes)}</div>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="text-xs uppercase text-muted-foreground">
                    {t("logistics.planTotalLoad")}
                  </div>
                  <div className="font-semibold">{formatLoad(planTotalLoad)}</div>
                </div>
              </div>
            </div>
            {planRoutes.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                    <span>{t("logistics.routeLoadChartTitle")}</span>
                    <span>{formatLoad(maxLoad)}</span>
                  </div>
                  <svg
                    className="mt-3 w-full"
                    height={140}
                    viewBox={`0 0 ${Math.max(120, loadSeries.length * 44)} 140`}
                    role="img"
                    aria-label={t("logistics.routeLoadChartTitle")}
                  >
                    {loadSeries.map((item, idx) => {
                      const ratio = maxLoad > 0 ? Math.min(1, Math.max(0, item.value / maxLoad)) : 0;
                      const barHeight = Math.max(8, Math.round(ratio * 96));
                      const x = 16 + idx * 44;
                      const y = 120 - barHeight;
                      const width = 24;
                      const color = item.highlighted ? "#ef4444" : "#0ea5e9";
                      return (
                        <g key={item.key}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={barHeight}
                            rx={4}
                            fill={color}
                          >
                            <title>
                              {t("logistics.loadBarTooltip", {
                                index: item.index,
                                value: formatLoad(item.value),
                              })}
                            </title>
                          </rect>
                          <text
                            x={x + width / 2}
                            y={132}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px]"
                          >
                            {t("logistics.planRouteShort", { index: item.index })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                  <div className="flex items-center justify-between text-xs uppercase text-muted-foreground">
                    <span>{t("logistics.routeEtaChartTitle")}</span>
                    <span>{formatEta(maxEta)}</span>
                  </div>
                  <svg
                    className="mt-3 w-full"
                    height={140}
                    viewBox={`0 0 ${Math.max(120, etaSeries.length * 44)} 140`}
                    role="img"
                    aria-label={t("logistics.routeEtaChartTitle")}
                  >
                    {etaSeries.map((item, idx) => {
                      const ratio = maxEta > 0 ? Math.min(1, Math.max(0, item.value / maxEta)) : 0;
                      const barHeight = Math.max(8, Math.round(ratio * 96));
                      const x = 16 + idx * 44;
                      const y = 120 - barHeight;
                      const width = 24;
                      const color = item.highlighted ? "#f97316" : "#6366f1";
                      return (
                        <g key={item.key}>
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={barHeight}
                            rx={4}
                            fill={color}
                          >
                            <title>
                              {t("logistics.etaBarTooltip", {
                                index: item.index,
                                value: formatEta(item.value),
                              })}
                            </title>
                          </rect>
                          <text
                            x={x + width / 2}
                            y={132}
                            textAnchor="middle"
                            className="fill-slate-500 text-[10px]"
                          >
                            {t("logistics.planRouteShort", { index: item.index })}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            ) : null}
            <div className="space-y-3">
              {planRoutes.map((route, routeIndex) => {
                const displayIndex =
                  typeof route.order === "number" && Number.isFinite(route.order)
                    ? route.order + 1
                    : routeIndex + 1;
                const routeKey =
                  typeof route.id === "string" && route.id
                    ? route.id
                    : `route-${routeIndex}`;
                const routeInfo = routeStatus.get(routeKey);
                const loadValue =
                  typeof route.metrics?.load === "number" &&
                  Number.isFinite(route.metrics?.load)
                    ? Number(route.metrics?.load)
                    : null;
                const etaValue =
                  typeof route.metrics?.etaMinutes === "number" &&
                  Number.isFinite(route.metrics?.etaMinutes)
                    ? Number(route.metrics?.etaMinutes)
                    : null;
                const loadRatio =
                  maxLoad > 0 && typeof loadValue === "number"
                    ? Math.min(1, Math.max(0, loadValue / maxLoad))
                    : 0;
                const etaRatio =
                  maxEta > 0 && typeof etaValue === "number"
                    ? Math.min(1, Math.max(0, etaValue / maxEta))
                    : 0;
                const loadPercent = Math.round(loadRatio * 100);
                const etaPercent = Math.round(etaRatio * 100);
                const loadWidth = Math.min(100, Math.max(6, loadPercent));
                const etaWidth = Math.min(100, Math.max(6, etaPercent));
                const routeStops = route.metrics?.stops ?? route.stops.length;
                return (
                  <div
                    key={route.id || `${routeIndex}`}
                    className="space-y-3 rounded border bg-white/70 px-3 py-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="text-base font-semibold">
                          {t("logistics.planRouteTitle", { index: displayIndex })}
                        </h4>
                        <div className="text-xs text-muted-foreground">
                          {t("logistics.planRouteSummary", {
                            tasks: route.tasks.length,
                            stops: routeStops,
                          })}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {routeInfo?.overloaded ? (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                              {t("logistics.overloadedBadge")}
                            </span>
                          ) : null}
                          {routeInfo?.delayed ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                              {t("logistics.delayBadge")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("logistics.planRouteDistance", {
                          distance: formatDistance(route.metrics?.distanceKm ?? null),
                        })}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                          <span>{t("logistics.routeLoadLabel")}</span>
                          <span>{formatLoad(loadValue)}</span>
                        </div>
                        <div
                          className="h-2 rounded-full bg-slate-200"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={loadPercent}
                        >
                          <div
                            className={clsx(
                              "h-2 rounded-full transition-all",
                              routeInfo?.overloaded ? "bg-red-500" : "bg-emerald-500",
                            )}
                            style={{ width: `${loadWidth}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                          <span>{t("logistics.routeEtaLabel")}</span>
                          <span>{formatEta(etaValue)}</span>
                        </div>
                        <div
                          className="h-2 rounded-full bg-slate-200"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={etaPercent}
                        >
                          <div
                            className={clsx(
                              "h-2 rounded-full transition-all",
                              routeInfo?.delayed ? "bg-amber-500" : "bg-blue-500",
                            )}
                            style={{ width: `${etaWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planDriver")}
                        </span>
                        <Input
                          value={route.driverName ?? ""}
                          onChange={(event) =>
                            handleDriverNameChange(routeIndex, event.target.value)
                          }
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planVehicle")}
                        </span>
                        <Input
                          value={route.vehicleName ?? ""}
                          onChange={(event) =>
                            handleVehicleNameChange(routeIndex, event.target.value)
                          }
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <label className="md:col-span-2 flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                          {t("logistics.planRouteNotes")}
                        </span>
                        <textarea
                          value={route.notes ?? ""}
                          onChange={(event) =>
                            handleRouteNotesChange(routeIndex, event.target.value)
                          }
                          className="min-h-[80px] rounded border px-3 py-2 text-sm"
                          disabled={!isPlanEditable || planLoading}
                        />
                      </label>
                      <div className="md:col-span-2 space-y-2">
                        <ul className="space-y-2">
                          {route.tasks.length ? (
                            route.tasks.map((task, taskIndex) => (
                              <li
                                key={task.taskId || `${routeIndex}-${taskIndex}`}
                                className={clsx(
                                  "space-y-2 rounded border px-3 py-2 text-sm shadow-sm",
                                  {
                                    "border-red-300 bg-red-50":
                                      taskStatus.get(task.taskId)?.delayed,
                                    "border-amber-300 bg-amber-50":
                                      !taskStatus.get(task.taskId)?.delayed &&
                                      taskStatus.get(task.taskId)?.overloaded,
                                  },
                                )}
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="font-medium">
                                      {task.title ?? task.taskId}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {t("task")}: {task.taskId}
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                                      <span>{t("logistics.loadLabel")}:</span>
                                      <span className="font-semibold">
                                        {formatLoad(taskStatus.get(task.taskId)?.routeLoad ?? loadValue)}
                                      </span>
                                      <span>•</span>
                                      <span>{t("logistics.etaLabel")}:</span>
                                      <span className="font-semibold">
                                        {formatEta(taskStatus.get(task.taskId)?.etaMinutes ?? etaValue)}
                                      </span>
                                      <span>•</span>
                                      <span
                                        className={clsx(
                                          taskStatus.get(task.taskId)?.delayed
                                            ? "text-red-600"
                                            : "text-emerald-600",
                                        )}
                                      >
                                        {formatDelay(taskStatus.get(task.taskId)?.delayMinutes ?? null)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        handleMoveTask(routeIndex, taskIndex, -1)
                                      }
                                      disabled={
                                        !isPlanEditable ||
                                        planLoading ||
                                        taskIndex === 0
                                      }
                                    >
                                      {t("logistics.planTaskUp")}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="xs"
                                      onClick={() =>
                                        handleMoveTask(routeIndex, taskIndex, 1)
                                      }
                                      disabled={
                                        !isPlanEditable ||
                                        planLoading ||
                                        taskIndex === route.tasks.length - 1
                                      }
                                    >
                                      {t("logistics.planTaskDown")}
                                    </Button>
                                  </div>
                                </div>
                                <div className="space-y-1 text-xs text-muted-foreground">
                                  {task.startAddress ? (
                                    <div>
                                      <span className="font-medium">
                                        {t("startPoint")}:
                                      </span>{" "}
                                      {task.startAddress}
                                    </div>
                                  ) : null}
                                  {task.finishAddress ? (
                                    <div>
                                      <span className="font-medium">
                                        {t("endPoint")}:
                                      </span>{" "}
                                      {task.finishAddress}
                                    </div>
                                  ) : null}
                                  {typeof task.distanceKm === "number" &&
                                  Number.isFinite(task.distanceKm) ? (
                                    <div>
                                      {t("logistics.planRouteDistance", {
                                        distance: formatDistance(task.distanceKm ?? null),
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              </li>
                            ))
                          ) : (
                            <li className="rounded border border-dashed bg-white/60 px-3 py-2 text-sm text-muted-foreground">
                              {t("logistics.planRouteEmpty")}
                            </li>
                          )}
                        </ul>
                        <div className="overflow-x-auto">
                          <table className="min-w-full table-fixed text-left text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="px-2 py-1 font-semibold">
                                  {t("logistics.stopTableHeaderStop")}
                                </th>
                                <th className="px-2 py-1 font-semibold">
                                  {t("logistics.stopTableHeaderEta")}
                                </th>
                                <th className="px-2 py-1 font-semibold">
                                  {t("logistics.stopTableHeaderLoad")}
                                </th>
                                <th className="px-2 py-1 font-semibold">
                                  {t("logistics.stopTableHeaderWindow")}
                                </th>
                                <th className="px-2 py-1 font-semibold">
                                  {t("logistics.stopTableHeaderDelay")}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {route.stops.length
                                ? route.stops.map((stop) => {
                                const stopDelay = stop.delayMinutes ?? null;
                                const stopLoadAlert =
                                  typeof stop.load === "number" && maxLoad > 0
                                    ? stop.load >= maxLoad * LOAD_WARNING_RATIO
                                    : false;
                                const stopRowClass = clsx("border-t border-slate-200", {
                                  "bg-red-50": typeof stopDelay === "number" && stopDelay > 0,
                                  "bg-amber-50": (!stopDelay || stopDelay <= 0) && stopLoadAlert,
                                });
                                const stopLoadRatio =
                                  maxLoad > 0 && typeof stop.load === "number"
                                    ? Math.min(1, Math.max(0, stop.load / maxLoad))
                                    : 0;
                                const stopLoadWidth = Math.min(
                                  100,
                                  Math.max(4, Math.round(stopLoadRatio * 100)),
                                );
                                return (
                                  <tr key={`${stop.taskId}-${stop.kind}-${stop.order}`} className={stopRowClass}>
                                    <td className="px-2 py-1 font-medium">
                                      {stop.kind === "start"
                                        ? t("logistics.stopPickup", { index: stop.order + 1 })
                                        : t("logistics.stopDropoff", { index: stop.order + 1 })}
                                    </td>
                                    <td className="px-2 py-1" title={formatEta(stop.etaMinutes ?? null)}>
                                      {formatEta(stop.etaMinutes ?? null)}
                                    </td>
                                    <td className="px-2 py-1">
                                      <div className="flex items-center gap-2">
                                        <div className="h-2 flex-1 rounded-full bg-slate-200">
                                          <div
                                            className="h-2 rounded-full bg-indigo-500"
                                            style={{ width: `${stopLoadWidth}%` }}
                                          />
                                        </div>
                                        <span className="whitespace-nowrap">
                                          {formatLoad(stop.load ?? null)}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1">
                                      {formatWindow(
                                        stop.windowStartMinutes ?? null,
                                        stop.windowEndMinutes ?? null,
                                      )}
                                    </td>
                                    <td className="px-2 py-1">
                                      <span
                                        className={clsx({
                                          "text-red-600 font-semibold":
                                            typeof stopDelay === "number" && stopDelay > 0,
                                        })}
                                      >
                                        {formatDelay(stopDelay)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                                })
                                : (
                                  <tr>
                                    <td
                                      className="px-2 py-2 text-center text-sm text-muted-foreground"
                                      colSpan={5}
                                    >
                                      {t("logistics.planRouteEmpty")}
                                    </td>
                                  </tr>
                                )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {planMessage ? (
              <div className={planMessageClass}>{planMessage}</div>
            ) : null}
          </div>
        ) : (
          <div className={planMessageClass}>
            {planLoading
              ? t("loading")
              : planMessage || t("logistics.planEmpty")}
          </div>
        )}
      </section>
      {role === "admin" ? (
        <section className="space-y-3 rounded border bg-white/80 p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <h3 className="font-semibold">{t("logistics.transport")}</h3>
            <Button
              type="button"
              size="sm"
              onClick={refreshFleet}
              disabled={vehiclesLoading}
            >
              {vehiclesLoading
                ? t("loading")
                : t("logistics.refreshFleet", {
                    defaultValue: "Обновить автопарк",
                  })}
            </Button>
          </div>
          {fleetError ? (
            <div className="text-sm text-red-600">{fleetError}</div>
          ) : null}
          {vehiclesHint && !availableVehicles.length ? (
            <div className="text-sm text-muted-foreground">{vehiclesHint}</div>
          ) : null}
          {availableVehicles.length ? (
            <ul className="space-y-2 text-sm">
              {availableVehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="space-y-1 rounded border bg-white/70 p-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{vehicle.name}</span>
                    {vehicle.registrationNumber ? (
                      <span className="text-xs text-muted-foreground">
                        {vehicle.registrationNumber}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {vehicle.transportType ? <span>{vehicle.transportType}</span> : null}
                    {Array.isArray(vehicle.currentTasks) ? (
                      <span>
                        {t("logistics.vehicleTasksCount", {
                          count: vehicle.currentTasks.length,
                          defaultValue: `Задач: ${vehicle.currentTasks.length}`,
                        })}
                      </span>
                    ) : null}
                    {typeof vehicle.odometerCurrent === "number" ? (
                      <span>
                        {t("logistics.vehicleMileage", {
                          value: vehicle.odometerCurrent,
                          defaultValue: `Пробег: ${vehicle.odometerCurrent} км`,
                        })}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : fleetError ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          {fleetError}
        </p>
      ) : null}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded border bg-white/80 p-3 shadow-sm">
          <div
            id="logistics-map"
            className={`h-[280px] w-full rounded border ${hasDialog ? "hidden" : ""}`}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("logistics.vehicleCountLabel")}
                </span>
                <select
                  value={vehicles}
                  onChange={(event) => setVehicles(Number(event.target.value))}
                  className="h-8 rounded border px-2 text-sm"
                  aria-label={t("logistics.vehicleCountAria")}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase text-muted-foreground">
                  {t("logistics.optimizeMethodLabel")}
                </span>
                <select
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="h-8 rounded border px-2 text-sm"
                  aria-label={t("logistics.optimizeMethodAria")}
                >
                  <option value="angle">angle</option>
                  <option value="trip">trip</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={calculate}>
                {t("logistics.optimize")}
              </Button>
              <Button type="button" size="sm" onClick={reset}>
                {t("reset")}
              </Button>
              <Button type="button" size="sm" onClick={refreshAll}>
                {t("refresh")}
              </Button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.layersTitle")}
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={layerVisibility.tasks}
                  onChange={(event) =>
                    setLayerVisibility((prev) => ({
                      ...prev,
                      tasks: event.target.checked,
                    }))
                  }
                />
                <span>{t("logistics.layerTasks")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={layerVisibility.optimized}
                  onChange={(event) =>
                    setLayerVisibility((prev) => ({
                      ...prev,
                      optimized: event.target.checked,
                    }))
                  }
                />
                <span>{t("logistics.layerOptimization")}</span>
              </label>
            </div>
            {!!links.length && (
              <div className="space-y-1 text-sm">
                {links.map((url, index) => (
                  <a
                    key={`${index}-${url}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accentPrimary underline"
                  >
                    {t("logistics.linksLabel", { index: index + 1 })}
                  </a>
                ))}
              </div>
            )}
          </section>
          <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
            <h3 className="text-sm font-semibold">
              {t("logistics.legendTitle")}
            </h3>
            <ul className="space-y-2 text-sm">
              {legendItems.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span
                    className="legend-color"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="task-marker task-marker--start" aria-hidden="true">
                  <span style={{ "--marker-color": "#2563eb" } as React.CSSProperties} />
                </span>
                <span>{t("logistics.legendStart")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="task-marker task-marker--finish" aria-hidden="true">
                  <span style={{ "--marker-color": "#2563eb" } as React.CSSProperties} />
                </span>
                <span>{t("logistics.legendFinish")}</span>
              </li>
            </ul>
          </section>
        </div>
      </section>
      <section className="space-y-2 rounded border bg-white/80 p-3 shadow-sm">
        <h3 className="text-lg font-semibold">
          {t("logistics.tasksHeading")}
        </h3>
        <TaskTable
          tasks={tasks}
          onDataChange={(rows) => setSorted(rows as RouteTask[])}
          onRowClick={openTask}
          page={page}
          pageCount={Math.max(1, Math.ceil(tasks.length / 25))}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
