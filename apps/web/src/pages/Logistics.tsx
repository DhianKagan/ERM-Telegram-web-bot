// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, MapLibre, i18next
import React from "react";
import fetchRouteGeometry from "../services/osrm";
import { fetchTasks } from "../services/tasks";
import optimizeRoute from "../services/optimizer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import TaskTable from "../components/TaskTable";
import { useTranslation } from "react-i18next";
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapInstance,
  type MapLayerMouseEvent,
} from "maplibre-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "maplibre-gl/dist/maplibre-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import useTasks from "../context/useTasks";
import { listFleetVehicles } from "../services/fleets";
import {
  MAP_ANIMATION_SPEED_KMH,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS,
  MAP_STYLE_URL,
} from "../config/map";
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
import {
  computeGeoZoneMetrics,
  isPolygonGeometry,
  pointWithinGeometry,
  type GeoZoneFeature,
} from "../utils/geozones";
import haversine from "../utils/haversine";

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

type GeoZoneMetricsState = {
  areaKm2: number | null;
  perimeterKm: number | null;
  bufferMeters: number;
};

type GeoZone = {
  id: string;
  drawId: string;
  name: string;
  feature: GeoZoneFeature;
  bufferedFeature: GeoZoneFeature;
  metrics: GeoZoneMetricsState;
  createdAt: string;
};

const GEO_SOURCE_ID = "logistics-geozones";
const GEO_FILL_LAYER_ID = "logistics-geozones-fill";
const GEO_OUTLINE_LAYER_ID = "logistics-geozones-outline";
const TASK_SOURCE_ID = "logistics-task-routes";
const TASK_LAYER_ID = "logistics-task-routes-line";
const TASK_MARKERS_SOURCE_ID = "logistics-task-markers";
const TASK_MARKERS_LAYER_ID = "logistics-task-markers-symbol";
const TASK_ANIMATION_SOURCE_ID = "logistics-task-animation";
const TASK_ANIMATION_LAYER_ID = "logistics-task-animation-symbol";
const OPT_SOURCE_ID = "logistics-optimized-routes";
const OPT_LAYER_ID = "logistics-optimized-routes-line";

type AnyLayerSpecification = Parameters<MapInstance["addLayer"]>[0];
type LineLayerSpecification = Extract<AnyLayerSpecification, { type: "line" }>;
type SymbolLayerSpecification = Extract<AnyLayerSpecification, { type: "symbol" }>;

const TASK_START_SYMBOL = "⬤";
const TASK_FINISH_SYMBOL = "⦿";
const ANIMATION_SYMBOL = "▶";
const ROUTE_SPEED_KM_PER_SEC = MAP_ANIMATION_SPEED_KMH / 3600;
const MIN_ROUTE_DISTANCE_KM = 0.01;

const createEmptyCollection = <T extends GeoJSON.Geometry = GeoJSON.Geometry>(): GeoJSON.FeatureCollection<T> => ({
  type: "FeatureCollection",
  features: [],
});

const toPosition = (coords?: Coords | null): [number, number] | null => {
  if (!coords) return null;
  const { lat, lng } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return [lng, lat];
};

type AnimatedRoute = {
  taskId: string;
  title: string;
  color: string;
  coordinates: GeoJSON.Position[];
  cumulative: number[];
  total: number;
  progress: number;
};

type LogisticsDetails = {
  transport_type?: string | null;
  start_location?: string | null;
  end_location?: string | null;
};

const filterTasksByGeoZones = (
  tasks: RouteTask[],
  zones: GeoZone[],
  activeZoneIds: string[],
): RouteTask[] => {
  if (!zones.length || !activeZoneIds.length) {
    return tasks;
  }
  const activeZones = zones.filter((zone) => activeZoneIds.includes(zone.id));
  if (!activeZones.length) {
    return tasks;
  }
  return tasks.filter((task) => {
    const points: [number, number][] = [];
    const start = toPosition(task.startCoordinates);
    const finish = toPosition(task.finishCoordinates);
    if (start) points.push(start);
    if (finish) points.push(finish);
    if (!points.length) {
      return false;
    }
    return points.some((point) =>
      activeZones.some((zone) => {
        const geometry = isPolygonGeometry(zone.bufferedFeature.geometry)
          ? zone.bufferedFeature.geometry
          : isPolygonGeometry(zone.feature.geometry)
            ? zone.feature.geometry
            : null;
        if (!geometry) {
          return false;
        }
        return pointWithinGeometry(point, geometry);
      }),
    );
  });
};

const toLatLng = (position: GeoJSON.Position): { lat: number; lng: number } => ({
  lng: position[0],
  lat: position[1],
});

const computeBearing = (from: GeoJSON.Position, to: GeoJSON.Position): number => {
  const fromLat = (from[1] * Math.PI) / 180;
  const toLat = (to[1] * Math.PI) / 180;
  const deltaLng = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  const radians = Math.atan2(y, x);
  const degrees = (radians * 180) / Math.PI;
  return (degrees + 360) % 360;
};

const createAnimatedRoute = (
  coordinates: GeoJSON.Position[],
  color: string,
  taskId: string,
  title: string,
): AnimatedRoute | null => {
  if (coordinates.length < 2) {
    return null;
  }
  const cumulative: number[] = [0];
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const prev = coordinates[index - 1];
    const next = coordinates[index];
    const distance = haversine(toLatLng(prev), toLatLng(next));
    total += distance;
    cumulative.push(total);
  }
  if (total < MIN_ROUTE_DISTANCE_KM) {
    return null;
  }
  return {
    taskId,
    title,
    color,
    coordinates,
    cumulative,
    total,
    progress: 0,
  };
};

const getAnimationPoint = (
  route: AnimatedRoute,
  distance: number,
): { position: GeoJSON.Position; bearing: number } => {
  const capped = Math.max(0, Math.min(distance, route.total));
  const { cumulative, coordinates } = route;
  let segmentIndex = 0;
  for (let index = 0; index < cumulative.length - 1; index += 1) {
    if (capped >= cumulative[index] && capped <= cumulative[index + 1]) {
      segmentIndex = index;
      break;
    }
  }
  const start = coordinates[segmentIndex];
  const end = coordinates[segmentIndex + 1] ?? coordinates[segmentIndex];
  const segmentStart = cumulative[segmentIndex];
  const segmentEnd = cumulative[segmentIndex + 1] ?? route.total;
  const segmentDistance = segmentEnd - segmentStart;
  const t = segmentDistance > 0 ? (capped - segmentStart) / segmentDistance : 0;
  const lng = start[0] + (end[0] - start[0]) * t;
  const lat = start[1] + (end[1] - start[1]) * t;
  return {
    position: [lng, lat],
    bearing: computeBearing(start, end),
  };
};

type BuildGeoZoneOptions = {
  id: string;
  drawId: string;
  name: string;
  createdAt: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  properties?: GeoJSON.GeoJsonProperties;
  active: boolean;
  bufferMeters?: number;
};

const buildGeoZone = ({
  id,
  drawId,
  name,
  createdAt,
  geometry,
  properties = {},
  active,
  bufferMeters,
}: BuildGeoZoneOptions): GeoZone => {
  const baseProperties: GeoJSON.GeoJsonProperties = {
    ...properties,
    zoneId: id,
    active,
  };
  const baseFeature: GeoZoneFeature = {
    type: "Feature",
    geometry,
    properties: baseProperties,
  };
  const metricsResult = computeGeoZoneMetrics(baseFeature, bufferMeters);
  const metricsProperties: GeoJSON.GeoJsonProperties = {
    ...baseProperties,
    areaKm2: metricsResult.areaKm2 ?? undefined,
    perimeterKm: metricsResult.perimeterKm ?? undefined,
    bufferMeters: metricsResult.bufferMeters,
  };
  const feature: GeoZoneFeature = {
    type: "Feature",
    geometry,
    properties: metricsProperties,
  };
  const bufferedFeature: GeoZoneFeature = {
    type: "Feature",
    geometry: metricsResult.bufferedGeometry,
    properties: metricsProperties,
  };
  return {
    id,
    drawId,
    name,
    createdAt,
    feature,
    bufferedFeature,
    metrics: {
      areaKm2: metricsResult.areaKm2,
      perimeterKm: metricsResult.perimeterKm,
      bufferMeters: metricsResult.bufferMeters,
    },
  };
};

const MAP_CENTER_LNG_LAT: [number, number] = [
  MAP_DEFAULT_CENTER[1],
  MAP_DEFAULT_CENTER[0],
];
const UKRAINE_BOUNDS: LngLatBoundsLike = MAP_MAX_BOUNDS;

export default function LogisticsPage() {
  const { t, i18n } = useTranslation();
  const tRef = React.useRef(t);
  React.useEffect(() => {
    tRef.current = t;
  }, [t]);
  const language = i18n.language;
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
  const [allRouteTasks, setAllRouteTasks] = React.useState<RouteTask[]>([]);
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
  const mapRef = React.useRef<MapInstance | null>(null);
  const drawRef = React.useRef<MapboxDraw | null>(null);
  const [mapViewMode, setMapViewMode] = React.useState<
    "planar" | "perspective"
  >("planar");
  const routeAnimationRef = React.useRef<{
    frameId: number | null;
    lastTimestamp: number | null;
    routes: AnimatedRoute[];
  }>({ frameId: null, lastTimestamp: null, routes: [] });
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
  const [geoZones, setGeoZones] = React.useState<GeoZone[]>([]);
  const [activeGeoZoneIds, setActiveGeoZoneIds] = React.useState<string[]>([]);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [optimizedRoutesGeoJSON, setOptimizedRoutesGeoJSON] = React.useState<
    GeoJSON.FeatureCollection<GeoJSON.LineString>
  >(createEmptyCollection<GeoJSON.LineString>());
  const [page, setPage] = React.useState(0);
  const hasLoadedFleetRef = React.useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const hasDialog = params.has("task") || params.has("newTask");
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;

  const filteredTasksByZone = React.useMemo(
    () => filterTasksByGeoZones(allRouteTasks, geoZones, activeGeoZoneIds),
    [activeGeoZoneIds, allRouteTasks, geoZones],
  );

  const taskStatus = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasksByZone.forEach((task) => {
      const rawStatus =
        typeof task.status === "string" && task.status.trim()
          ? task.status.trim()
          : "Новая";
      counts[rawStatus] = (counts[rawStatus] ?? 0) + 1;
    });
    return counts;
  }, [filteredTasksByZone]);

  const legendItems = React.useMemo(() => {
    const base = TASK_STATUSES.map((status) => ({
      key: status,
      label: status,
      color: TASK_STATUS_COLORS[status] ?? "#2563eb",
      count: taskStatus[status] ?? 0,
    }));
    const extraStatuses = Object.keys(taskStatus).filter(
      (status) => !TASK_STATUSES.includes(status),
    );
    if (extraStatuses.length) {
      extraStatuses.forEach((status) => {
        base.push({
          key: status,
          label: status,
          color: TASK_STATUS_COLORS[status] ?? "#2563eb",
          count: taskStatus[status] ?? 0,
        });
      });
    }
    return base;
  }, [taskStatus]);

  const filteredSignature = React.useMemo(
    () => JSON.stringify(filteredTasksByZone),
    [filteredTasksByZone],
  );

  const lastSyncedSignatureRef = React.useRef<string>("");

  const stopRouteAnimation = React.useCallback(() => {
    const controller = routeAnimationRef.current;
    if (controller.frameId !== null) {
      cancelAnimationFrame(controller.frameId);
      controller.frameId = null;
    }
    controller.lastTimestamp = null;
  }, []);

  const runRouteAnimation = React.useCallback(() => {
    stopRouteAnimation();
    if (!mapReady) {
      return;
    }
    const controller = routeAnimationRef.current;
    if (!controller.routes.length) {
      return;
    }
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = map.getSource(TASK_ANIMATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) {
      return;
    }
    const initialFeatures = controller.routes.map((route) => {
      const { position, bearing } = getAnimationPoint(route, route.progress);
      return {
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: position },
        properties: {
          color: route.color,
          taskId: route.taskId,
          title: route.title,
          bearing,
          icon: ANIMATION_SYMBOL,
        },
      } satisfies GeoJSON.Feature<GeoJSON.Point>;
    });
    source.setData({
      type: "FeatureCollection",
      features: initialFeatures,
    });
    const step = (timestamp: number) => {
      const controllerState = routeAnimationRef.current;
      const mapInstance = mapRef.current;
      if (!mapInstance) {
        stopRouteAnimation();
        return;
      }
      const animationSource = mapInstance.getSource(
        TASK_ANIMATION_SOURCE_ID,
      ) as GeoJSONSource | undefined;
      if (!animationSource) {
        stopRouteAnimation();
        return;
      }
      const lastTimestamp = controllerState.lastTimestamp;
      controllerState.lastTimestamp = timestamp;
      const delta = lastTimestamp != null ? (timestamp - lastTimestamp) / 1000 : 0;
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
      controllerState.routes.forEach((route) => {
        if (route.total <= 0) {
          return;
        }
        route.progress =
          (route.progress + delta * ROUTE_SPEED_KM_PER_SEC) % route.total;
        const { position, bearing } = getAnimationPoint(route, route.progress);
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: position },
          properties: {
            color: route.color,
            taskId: route.taskId,
            title: route.title,
            bearing,
            icon: ANIMATION_SYMBOL,
          },
        });
      });
      animationSource.setData({
        type: "FeatureCollection",
        features,
      });
      controllerState.frameId = requestAnimationFrame(step);
    };
    controller.frameId = requestAnimationFrame(step);
  }, [mapReady, stopRouteAnimation]);

  React.useEffect(() => {
    if (lastSyncedSignatureRef.current === filteredSignature) {
      return;
    }
    lastSyncedSignatureRef.current = filteredSignature;
    setSorted(filteredTasksByZone);
    const userId = Number((user as any)?.telegram_id) || undefined;
    controller.setIndex("logistics:all", filteredTasksByZone, {
      kind: "task",
      mine: false,
      userId,
      pageSize: filteredTasksByZone.length,
      total: filteredTasksByZone.length,
      sort: "desc",
    });
  }, [controller, filteredSignature, filteredTasksByZone, user]);

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

  const handleStartDrawing = React.useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.changeMode("draw_polygon");
  }, []);

  const handleToggleZone = React.useCallback((zoneId: string, checked: boolean) => {
    setActiveGeoZoneIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(zoneId);
      } else {
        next.delete(zoneId);
      }
      return Array.from(next);
    });
  }, []);

  const handleRemoveZone = React.useCallback((zone: GeoZone) => {
    const removeFromState = () => {
      setGeoZones((prev) => prev.filter((item) => item.id !== zone.id));
      setActiveGeoZoneIds((prev) => prev.filter((id) => id !== zone.id));
    };

    const draw = drawRef.current;
    if (!draw) {
      removeFromState();
      return;
    }

    const hadFeature = Boolean(draw.get(zone.drawId));
    const deleted = draw.delete(zone.drawId);

    if (!hadFeature) {
      removeFromState();
      return;
    }

    if (Array.isArray(deleted) ? deleted.length === 0 : !deleted) {
      removeFromState();
    }
  }, []);

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
    const hasPoint = (coords?: Coords | null) =>
      typeof coords?.lat === "number" &&
      Number.isFinite(coords.lat) &&
      typeof coords?.lng === "number" &&
      Number.isFinite(coords.lng);

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
      setAllRouteTasks(filtered);
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
    const ids = sorted.map((t) => t._id);
    if (!ids.length) {
      applyPlan(null);
      setPlanMessage(tRef.current('logistics.planEmpty'));
      setPlanMessageTone('neutral');
      return;
    }
    setPlanLoading(true);
    setPlanMessage('');
    setPlanMessageTone('neutral');
    try {
      const result = await optimizeRoute(ids, vehicles, method);
      if (!result) {
        applyPlan(null);
        setPlanMessage(tRef.current('logistics.planEmpty'));
        return;
      }
      applyPlan(result);
      setPlanMessage(tRef.current('logistics.planDraftCreated'));
      setPlanMessageTone('success');
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
  }, [applyPlan, method, sorted, vehicles]);

  const formatDistance = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toFixed(1)} ${tRef.current('km')}`;
      }
      return tRef.current('logistics.planNoDistance');
    },
    [],
  );

  const formatAreaMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      if (value >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 2,
        }).format(value)} км²`;
      }
      const hectares = value * 100;
      if (hectares >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 1,
        }).format(hectares)} га`;
      }
      const squareMeters = value * 1_000_000;
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(squareMeters)} м²`;
    },
    [language],
  );

  const formatPerimeterMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      if (value >= 1) {
        return `${new Intl.NumberFormat(language, {
          maximumFractionDigits: 2,
        }).format(value)} км`;
      }
      const meters = value * 1000;
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(meters)} м`;
    },
    [language],
  );

  const formatBufferMetric = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '—';
      }
      return `${new Intl.NumberFormat(language, {
        maximumFractionDigits: 0,
      }).format(value)} м`;
    },
    [language],
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
    setOptimizedRoutesGeoJSON(createEmptyCollection<GeoJSON.LineString>());
    setLinks([]);
  }, []);

  React.useEffect(() => {
    load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [filteredSignature]);

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
    const map = new maplibregl.Map({
      container: "logistics-map",
      style: MAP_STYLE_URL,
      center: MAP_CENTER_LNG_LAT,
      zoom: MAP_DEFAULT_ZOOM,
      minZoom: 5,
      maxZoom: 12,
      maxBounds: UKRAINE_BOUNDS,
    });
    mapRef.current = map;
    if (typeof map.dragRotate?.disable === "function") {
      map.dragRotate.disable();
    }
    if (typeof map.touchZoomRotate?.disableRotation === "function") {
      map.touchZoomRotate.disableRotation();
    }
    const navigation = new maplibregl.NavigationControl({ showCompass: false });
    map.addControl(navigation, "top-right");
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });
    drawRef.current = draw;
    map.addControl(draw, "top-left");
    map.on("load", () => {
      map.addSource(GEO_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      map.addLayer({
        id: GEO_FILL_LAYER_ID,
        type: "fill",
        source: GEO_SOURCE_ID,
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "active"], false],
            "rgba(37, 99, 235, 0.35)",
            "rgba(148, 163, 184, 0.2)",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "active"], false],
            0.4,
            0.2,
          ],
        },
      });
      map.addLayer({
        id: GEO_OUTLINE_LAYER_ID,
        type: "line",
        source: GEO_SOURCE_ID,
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "active"], false],
            "#2563eb",
            "#94a3b8",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "active"], false],
            2.5,
            1.5,
          ],
        },
      });
      map.addSource(OPT_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const optimizedLayer: LineLayerSpecification = {
        id: OPT_LAYER_ID,
        type: "line",
        source: OPT_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-dasharray": [1.5, 1.5],
          "line-opacity": 0.8,
        },
      };
      map.addLayer(optimizedLayer);
      map.addSource(TASK_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const taskLineLayer: LineLayerSpecification = {
        id: TASK_LAYER_ID,
        type: "line",
        source: TASK_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 0.85,
        },
      };
      map.addLayer(taskLineLayer);
      map.addSource(TASK_MARKERS_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const markerLayer: SymbolLayerSpecification = {
        id: TASK_MARKERS_LAYER_ID,
        type: "symbol",
        source: TASK_MARKERS_SOURCE_ID,
        layout: {
          "text-field": ["get", "icon"],
          "text-size": 18,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(17, 24, 39, 0.55)",
          "text-halo-width": 1.5,
        },
      };
      map.addLayer(markerLayer);
      map.addSource(TASK_ANIMATION_SOURCE_ID, {
        type: "geojson",
        data: createEmptyCollection(),
      });
      const animationLayer: SymbolLayerSpecification = {
        id: TASK_ANIMATION_LAYER_ID,
        type: "symbol",
        source: TASK_ANIMATION_SOURCE_ID,
        layout: {
          "text-field": ["get", "icon"],
          "text-size": 20,
          "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-rotate": ["get", "bearing"],
        },
        paint: {
          "text-color": ["get", "color"],
          "text-halo-color": "rgba(17, 24, 39, 0.55)",
          "text-halo-width": 1.2,
        },
      };
      map.addLayer(animationLayer);
      setMapReady(true);
    });
    return () => {
      setMapReady(false);
      setIsDrawing(false);
      drawRef.current = null;
      stopRouteAnimation();
      map.remove();
      mapRef.current = null;
    };
  }, [hasDialog, stopRouteAnimation]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const enableRotation = () => {
      if (typeof map.dragRotate?.enable === "function") {
        map.dragRotate.enable();
      }
      if (typeof map.touchZoomRotate?.enableRotation === "function") {
        map.touchZoomRotate.enableRotation();
      }
    };
    const disableRotation = () => {
      if (typeof map.dragRotate?.disable === "function") {
        map.dragRotate.disable();
      }
      if (typeof map.touchZoomRotate?.disableRotation === "function") {
        map.touchZoomRotate.disableRotation();
      }
    };
    if (mapViewMode === "perspective") {
      enableRotation();
      if (typeof map.easeTo === "function") {
        map.easeTo({ pitch: 55, bearing: 28, duration: 600 });
      } else {
        map.setPitch(55);
        map.setBearing(28);
      }
    } else {
      if (typeof map.easeTo === "function") {
        map.easeTo({ pitch: 0, bearing: 0, duration: 400 });
      } else {
        map.setPitch(0);
        map.setBearing(0);
      }
      disableRotation();
    }
  }, [mapReady, mapViewMode]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    const createdZones: GeoZone[] = [];
    const updatedZones = new Map<string, GeoZoneFeature>();

    const handleCreate = (event: { features?: GeoJSON.Feature[] }) => {
      createdZones.length = 0;
      setGeoZones((prev) => {
        const base = [...prev];
        const baseLength = prev.length;
        const now = new Date().toISOString();
        for (const feature of event.features ?? []) {
          if (!feature || !isPolygonGeometry(feature.geometry)) continue;
          const drawId =
            typeof feature.id === "string"
              ? feature.id
              : feature.id != null
                ? String(feature.id)
                : `draw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const zoneId =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const name = tRef.current("logistics.geozoneDefaultName", {
            index: baseLength + createdZones.length + 1,
          });
          const zone = buildGeoZone({
            id: zoneId,
            drawId,
            name,
            createdAt: now,
            geometry: feature.geometry,
            properties: feature.properties ?? {},
            active: true,
          });
          createdZones.push(zone);
          base.push(zone);
        }
        return base;
      });
      if (createdZones.length) {
        setActiveGeoZoneIds((prev) => {
          const next = new Set(prev);
          createdZones.forEach((zone) => next.add(zone.id));
          return Array.from(next);
        });
      }
    };

    const handleDelete = (event: { features?: GeoJSON.Feature[] }) => {
      const removedDrawIds = new Set<string>();
      for (const feature of event.features ?? []) {
        if (!feature) continue;
        const drawId =
          typeof feature.id === "string"
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : "";
        if (drawId) {
          removedDrawIds.add(drawId);
        }
      }
      if (!removedDrawIds.size) {
        return;
      }
      const removedZoneIds: string[] = [];
      setGeoZones((prev) => {
        const next = prev.filter((zone) => {
          const shouldRemove = removedDrawIds.has(zone.drawId);
          if (shouldRemove) {
            removedZoneIds.push(zone.id);
          }
          return !shouldRemove;
        });
        return next;
      });
      if (removedZoneIds.length) {
        setActiveGeoZoneIds((prev) => prev.filter((id) => !removedZoneIds.includes(id)));
      }
    };

    const handleUpdate = (event: { features?: GeoJSON.Feature[] }) => {
      updatedZones.clear();
      for (const feature of event.features ?? []) {
        if (!feature || !isPolygonGeometry(feature.geometry)) continue;
        const drawId =
          typeof feature.id === "string"
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : "";
        if (!drawId) continue;
        updatedZones.set(drawId, {
          type: "Feature",
          geometry: feature.geometry,
          properties: { ...(feature.properties ?? {}) },
        });
      }
      if (!updatedZones.size) return;
      setGeoZones((prev) =>
        prev.map((zone) => {
          const updated = updatedZones.get(zone.drawId);
          if (!updated) {
            return zone;
          }
          if (!isPolygonGeometry(updated.geometry)) {
            return zone;
          }
          return buildGeoZone({
            id: zone.id,
            drawId: zone.drawId,
            name: zone.name,
            createdAt: zone.createdAt,
            geometry: updated.geometry,
            properties: updated.properties ?? zone.feature.properties ?? {},
            active: activeGeoZoneIds.includes(zone.id),
            bufferMeters: zone.metrics.bufferMeters,
          });
        }),
      );
    };

    const handleModeChange = (event: { mode: string }) => {
      setIsDrawing(event.mode === "draw_polygon");
    };

    map.on("draw.create", handleCreate as any);
    map.on("draw.delete", handleDelete as any);
    map.on("draw.update", handleUpdate as any);
    map.on("draw.modechange", handleModeChange as any);

    return () => {
      map.off("draw.create", handleCreate as any);
      map.off("draw.delete", handleDelete as any);
      map.off("draw.update", handleUpdate as any);
      map.off("draw.modechange", handleModeChange as any);
    };
  }, [activeGeoZoneIds, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    const features = geoZones.map((zone) => ({
      ...zone.feature,
      id: zone.drawId,
      properties: {
        ...(zone.feature.properties ?? {}),
        zoneId: zone.id,
        name: zone.name,
        active: activeGeoZoneIds.includes(zone.id),
      },
    }));
    source.setData({
      type: "FeatureCollection",
      features,
    });
  }, [activeGeoZoneIds, geoZones, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const routesSource = map.getSource(TASK_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    const markersSource = map.getSource(TASK_MARKERS_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    const animationSource = map.getSource(TASK_ANIMATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!routesSource || !markersSource || !animationSource) {
      return;
    }
    if (!layerVisibility.tasks || !sorted.length) {
      routesSource.setData(createEmptyCollection());
      markersSource.setData(createEmptyCollection());
      animationSource.setData(createEmptyCollection());
      routeAnimationRef.current.routes = [];
      stopRouteAnimation();
      return;
    }
    let cancelled = false;
    (async () => {
      const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
      const markerFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
      const animationRoutes: AnimatedRoute[] = [];
      for (const task of sorted) {
        if (cancelled) break;
        const start = toPosition(task.startCoordinates);
        const finish = toPosition(task.finishCoordinates);
        if (!start || !finish) continue;
        const geometry = await fetchRouteGeometry(
          task.startCoordinates,
          task.finishCoordinates,
        );
        if (!geometry || cancelled) continue;
        const statusKey =
          typeof task.status === "string" ? task.status.trim() : "";
        const routeColor = TASK_STATUS_COLORS[statusKey] ?? "#2563eb";
        const coordinates = geometry as GeoJSON.Position[];
        lineFeatures.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates,
          },
          properties: {
            color: routeColor,
            taskId: task._id,
            title: task.title ?? task._id,
          },
        });
        markerFeatures.push(
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: start },
            properties: {
              color: routeColor,
              taskId: task._id,
              title: task.title ?? task._id,
              icon: TASK_START_SYMBOL,
              kind: "start",
            },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: finish },
            properties: {
              color: routeColor,
              taskId: task._id,
              title: task.title ?? task._id,
              icon: TASK_FINISH_SYMBOL,
              kind: "finish",
            },
          },
        );
        const animatedRoute = createAnimatedRoute(
          coordinates,
          routeColor,
          task._id,
          task.title ?? task._id,
        );
        if (animatedRoute) {
          animationRoutes.push(animatedRoute);
        }
      }
      if (cancelled) return;
      routesSource.setData({
        type: "FeatureCollection",
        features: lineFeatures,
      });
      markersSource.setData({
        type: "FeatureCollection",
        features: markerFeatures,
      });
      routeAnimationRef.current.routes = animationRoutes;
      routeAnimationRef.current.lastTimestamp = null;
      if (!animationRoutes.length) {
        animationSource.setData(createEmptyCollection());
        stopRouteAnimation();
      } else {
        runRouteAnimation();
      }
    })();
    return () => {
      cancelled = true;
      stopRouteAnimation();
    };
  }, [
    layerVisibility.tasks,
    mapReady,
    runRouteAnimation,
    sorted,
    stopRouteAnimation,
  ]);

  React.useEffect(() => {
    if (!layerVisibility.optimized || !planDraft) {
      setOptimizedRoutesGeoJSON(createEmptyCollection<GeoJSON.LineString>());
      return;
    }
    const colors = ["#ef4444", "#22c55e", "#f97316"];
    const features: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    planDraft.routes.forEach((route, idx) => {
      const coordinates: GeoJSON.Position[] = [];
      route.tasks.forEach((task) => {
        const start = toPosition(task.start);
        const finish = toPosition(task.finish);
        if (start) {
          coordinates.push(start);
        }
        if (finish) {
          coordinates.push(finish);
        }
      });
      if (coordinates.length < 2) {
        return;
      }
      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates,
        },
        properties: {
          color: colors[idx % colors.length],
          routeId: route.id,
        },
      });
    });
    setOptimizedRoutesGeoJSON({
      type: "FeatureCollection",
      features,
    });
  }, [layerVisibility.optimized, planDraft]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(OPT_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(optimizedRoutesGeoJSON);
  }, [mapReady, optimizedRoutesGeoJSON]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const setVisibility = (layerId: string, visible: boolean) => {
      if (!map.getLayer(layerId)) return;
      map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
    };
    setVisibility(TASK_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_MARKERS_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_ANIMATION_LAYER_ID, layerVisibility.tasks);
    setVisibility(OPT_LAYER_ID, layerVisibility.optimized);
  }, [layerVisibility.optimized, layerVisibility.tasks, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const handleClick = (event: MapLayerMouseEvent) => {
      const taskId = event.features?.[0]?.properties?.taskId;
      if (typeof taskId === "string" && taskId) {
        openTask(taskId);
      }
    };
    const setCursor = (cursor: string) => {
      const canvas = map.getCanvas();
      canvas.style.cursor = cursor;
    };
    const handleEnter = () => setCursor("pointer");
    const handleLeave = () => setCursor("");
    map.on("click", TASK_MARKERS_LAYER_ID, handleClick as any);
    map.on("mouseenter", TASK_MARKERS_LAYER_ID, handleEnter as any);
    map.on("mouseleave", TASK_MARKERS_LAYER_ID, handleLeave as any);
    return () => {
      map.off("click", TASK_MARKERS_LAYER_ID, handleClick as any);
      map.off("mouseenter", TASK_MARKERS_LAYER_ID, handleEnter as any);
      map.off("mouseleave", TASK_MARKERS_LAYER_ID, handleLeave as any);
    };
  }, [mapReady, openTask]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    if (typeof map.resize === "function") {
      map.resize();
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {t("logistics.geozonesTitle")}
              </h3>
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleStartDrawing}
                disabled={!mapReady}
              >
                {isDrawing
                  ? t("logistics.geozonesDrawing")
                  : t("logistics.geozonesDraw")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("logistics.geozonesHint")}
            </p>
            {geoZones.length ? (
              <ul className="space-y-2 text-sm">
                {geoZones.map((zone, index) => {
                  const isActive = activeGeoZoneIds.includes(zone.id);
                  return (
                    <li
                      key={zone.id}
                      className="space-y-2 rounded border bg-white/70 p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={isActive}
                            onChange={(event) =>
                              handleToggleZone(zone.id, event.target.checked)
                            }
                          />
                          <span className="font-medium">
                            {zone.name ||
                              t("logistics.geozoneDefaultName", {
                                index: index + 1,
                              })}
                          </span>
                        </label>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={() => handleRemoveZone(zone)}
                        >
                          {t("logistics.geozoneRemove")}
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {isActive
                          ? t("logistics.geozoneStatusActive")
                          : t("logistics.geozoneStatusInactive")}
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>
                          {t("logistics.geozoneArea", {
                            value: formatAreaMetric(zone.metrics?.areaKm2),
                          })}
                        </div>
                        <div>
                          {t("logistics.geozonePerimeter", {
                            value: formatPerimeterMetric(zone.metrics?.perimeterKm),
                          })}
                        </div>
                        <div>
                          {t("logistics.geozoneBuffer", {
                            value: formatBufferMetric(zone.metrics?.bufferMeters),
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("logistics.geozonesEmpty")}
              </p>
            )}
          </section>
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
            <div className="space-y-1 border-t border-dashed border-slate-200 pt-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t("logistics.viewModeLabel")}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant={mapViewMode === "planar" ? "default" : "outline"}
                  onClick={() => setMapViewMode("planar")}
                  aria-pressed={mapViewMode === "planar"}
                >
                  {t("logistics.viewModePlanar")}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={mapViewMode === "perspective" ? "default" : "outline"}
                  onClick={() => setMapViewMode("perspective")}
                  aria-pressed={mapViewMode === "perspective"}
                >
                  {t("logistics.viewModeTilted")}
                </Button>
              </div>
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
                  {item.count ? (
                    <span className="text-xs text-muted-foreground">
                      {t("logistics.legendCount", {
                        count: item.count,
                        defaultValue: `(${item.count})`,
                      })}
                    </span>
                  ) : null}
                </li>
              ))}
              <li className="flex items-center gap-2">
                <span className="legend-symbol legend-symbol--start" aria-hidden="true">
                  {TASK_START_SYMBOL}
                </span>
                <span>{t("logistics.legendStart")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="legend-symbol legend-symbol--finish" aria-hidden="true">
                  {TASK_FINISH_SYMBOL}
                </span>
                <span>{t("logistics.legendFinish")}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="legend-symbol legend-symbol--movement" aria-hidden="true">
                  {ANIMATION_SYMBOL}
                </span>
                <span>{t("logistics.legendMovement")}</span>
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
          tasks={filteredTasksByZone}
          onDataChange={(rows) => setSorted(rows as RouteTask[])}
          onRowClick={openTask}
          page={page}
          pageCount={Math.max(1, Math.ceil(filteredTasksByZone.length / 25))}
          onPageChange={setPage}
        />
      </section>
    </div>
  );
}
