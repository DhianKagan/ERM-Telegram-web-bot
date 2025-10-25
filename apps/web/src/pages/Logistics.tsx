// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, Leaflet, i18next
import React from "react";
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
import {
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
      const planRoutes = result.routes
        .map((route, routeIndex) => {
          const tasksForRoute = route.taskIds
            .map((id) => taskIndex.get(id))
            .filter((task): task is RouteTask => Boolean(task));
          if (!tasksForRoute.length) {
            return null;
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
          return {
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
          } satisfies RoutePlan["routes"][number];
        })
        .filter((route): route is RoutePlan["routes"][number] => Boolean(route));

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

  const load = React.useCallback(() => {
    const userId = Number((user as any)?.telegram_id) || undefined;
    fetchTasks({}, userId, true).then((data: any) => {
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
    });
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
    load();
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [load, loadFleetVehicles, role]);

  const refreshFleet = React.useCallback(() => {
    if (role === "admin") {
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

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
        return {
          id: task._id,
          coordinates: task.startCoordinates as Coords,
          demand: 1,
          serviceMinutes: undefined,
          title: task.title,
          startAddress: startAddress || undefined,
          finishAddress: finishAddress || undefined,
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
      const loadLabel = result.totalLoad.toFixed(2).replace(/\.00$/, '');
      const summaryParts = [
        tRef.current('logistics.planDraftCreated'),
        `ETA: ${result.totalEtaMinutes} мин`,
        `Загрузка: ${loadLabel}`,
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
    layerVisibility.optimized,
    method,
    sorted,
    tRef,
    vehicles,
  ]);

  const formatDistance = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toFixed(1)} ${tRef.current('km')}`;
      }
      return tRef.current('logistics.planNoDistance');
    },
    [],
  );

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
  const planRoutes = planDraft?.routes ?? [];
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

  const reset = React.useCallback(() => {
    if (optLayerRef.current) {
      optLayerRef.current.remove();
      optLayerRef.current = null;
    }
    setLinks([]);
  }, []);

  React.useEffect(() => {
    load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [tasks]);

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
        const routeColor =
          TASK_STATUS_COLORS[statusKey] ?? "#2563eb";
        L.polyline(latlngs, {
          color: routeColor,
          weight: 4,
          opacity: 0.85,
        }).addTo(group);
        const startMarker = L.marker(latlngs[0], {
          icon: createMarkerIcon("start", routeColor),
        }).bindTooltip(
          `<a href="#" class="text-accentPrimary" data-id="${t._id}">${t.title}</a>`,
        );
        const endMarker = L.marker(latlngs[latlngs.length - 1], {
          icon: createMarkerIcon("finish", routeColor),
        }).bindTooltip(
          `<a href="#" class="text-accentPrimary" data-id="${t._id}">${t.title}</a>`,
        );
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
  }, [layerVisibility.tasks, mapReady, openTask, sorted]);

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
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              </div>
            </div>
            <div className="space-y-3">
              {planRoutes.map((route, routeIndex) => {
                const displayIndex =
                  typeof route.order === "number" && Number.isFinite(route.order)
                    ? route.order + 1
                    : routeIndex + 1;
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
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("logistics.planRouteDistance", {
                          distance: formatDistance(route.metrics?.distanceKm ?? null),
                        })}
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
                                className="space-y-2 rounded border bg-white px-3 py-2 text-sm shadow-sm"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="font-medium">
                                      {task.title ?? task.taskId}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {t("task")}: {task.taskId}
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
