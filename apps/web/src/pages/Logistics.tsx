// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, MapLibre GL, i18next
import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import fetchRouteGeometry from '../services/osrm';
import { fetchTasks } from '../services/tasks';
import optimizeRoute from '../services/optimizer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import TaskTable from '../components/TaskTable';
import { useTranslation } from 'react-i18next';
import mapLibrary, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Listener,
  type LngLatBoundsLike,
  type MapInstance,
  type MapLayerMouseEvent,
  attachMapStyleFallback,
  registerPmtilesProtocol,
} from '../utils/mapLibrary';
import { findFirstVectorSourceId } from '../utils/vectorSource';
import type * as GeoJSON from 'geojson';
import MapLibreDraw from 'maplibre-gl-draw';
import 'maplibre-gl-draw/dist/mapbox-gl-draw.css';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import useTasks from '../context/useTasks';
import useIntervalEffect from '../hooks/useIntervalEffect';
import useI18nRef from '../hooks/useI18nRef';
import { listFleetVehicles } from '../services/fleets';
import { subscribeLogisticsEvents } from '../services/logisticsEvents';
import {
  MAP_ATTRIBUTION,
  MAP_ANIMATION_SPEED_KMH,
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_MAX_BOUNDS,
  MAP_STYLE,
  MAP_STYLE_DEFAULT_URL,
  MAP_STYLE_MODE,
  MAP_STYLE_IS_DEFAULT,
  MAP_ADDRESSES_PMTILES_URL,
} from '../config/map';
import { insert3dBuildingsLayer } from '../utils/insert3dBuildingsLayer';
import { customTheme } from '../utils/drawTheme';
import {
  TASK_STATUSES,
  type Coords,
  type FleetVehicleDto,
  type RoutePlan,
  type RoutePlanStatus,
} from 'shared';
import {
  listRoutePlans,
  updateRoutePlan,
  changeRoutePlanStatus,
  type RoutePlanUpdatePayload,
} from '../services/routePlans';
import type { TaskRow } from '../columns/taskColumns';
import {
  computeGeoZoneMetrics,
  isPolygonGeometry,
  pointWithinGeometry,
  type GeoZoneFeature,
} from '../utils/geozones';
import haversine from '../utils/haversine';

type RouteTask = TaskRow & {
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
};

const TASK_STATUS_COLORS: Record<string, string> = {
  Новая: '#0ea5e9',
  'В работе': '#f97316',
  Выполнена: '#22c55e',
  Отменена: '#ef4444',
};

type LayerVisibilityState = {
  tasks: boolean;
  optimized: boolean;
};

type DrawFeatureEvent = { features?: GeoJSON.Feature[] };
type DrawModeChangeEvent = { mode?: string };
type GlobalRuntime = {
  process?: { env?: Record<string, string | undefined> };
};

const getNodeEnv = (): string | undefined => {
  if (typeof globalThis !== 'object' || globalThis === null) {
    return undefined;
  }
  const runtime = globalThis as GlobalRuntime;
  return runtime.process?.env?.NODE_ENV;
};

const DEFAULT_LAYER_VISIBILITY: LayerVisibilityState = {
  tasks: true,
  optimized: true,
};

const LOGISTICS_EVENT_DEBOUNCE_MS = getNodeEnv() === 'test' ? 0 : 400;

export const LOGISTICS_FLEET_POLL_INTERVAL_MS = 15_000;

type TaskRouteStatusKey = RoutePlanStatus | 'unassigned';
type RouteStatusFilterKey = TaskRouteStatusKey | 'vehicle';

const ROUTE_STATUS_ORDER: RouteStatusFilterKey[] = [
  'draft',
  'approved',
  'completed',
  'unassigned',
  'vehicle',
];

const ROUTE_STATUS_COLORS: Record<RouteStatusFilterKey, string> = {
  draft: '#6366f1',
  approved: '#22c55e',
  completed: '#0f172a',
  unassigned: '#f97316',
  vehicle: '#0891b2',
};

const ROUTE_STATUS_LABELS: Record<RouteStatusFilterKey, string> = {
  draft: 'Черновик',
  approved: 'Утверждён',
  completed: 'Завершён',
  unassigned: 'Без маршрута',
  vehicle: 'Транспорт',
};

const getRouteStatusColor = (status: RouteStatusFilterKey): string =>
  ROUTE_STATUS_COLORS[status] ?? '#0f172a';

const buildClusterStatusExpression = (status: TaskRouteStatusKey) => [
  '+',
  [
    'case',
    [
      'all',
      ['==', ['get', 'entity'], 'task'],
      ['==', ['get', 'routeStatus'], status],
    ],
    1,
    0,
  ],
  0,
];

const CLUSTER_STATUS_PROPERTIES: Record<
  TaskRouteStatusKey,
  ExpressionSpecification
> = {
  draft: buildClusterStatusExpression('draft'),
  approved: buildClusterStatusExpression('approved'),
  completed: buildClusterStatusExpression('completed'),
  unassigned: buildClusterStatusExpression('unassigned'),
};

const TRANSPORT_TYPE_COLORS: Record<string, string> = {
  Легковой: '#0ea5e9',
  Грузовой: '#f97316',
  Спецтехника: '#7c3aed',
  Пеший: '#22c55e',
  'Без транспорта': '#9ca3af',
  default: '#475569',
};

const TASK_TYPE_COLOR_PALETTE = [
  '#7c3aed',
  '#f97316',
  '#06b6d4',
  '#16a34a',
  '#ec4899',
  '#facc15',
  '#9333ea',
  '#0ea5e9',
];

const VEHICLE_TASK_TYPE_KEY = 'vehicle';
const VEHICLE_TASK_TYPE_LABEL = 'Транспорт';

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

type StoredMapState = {
  center: [number, number];
  zoom: number;
  pitch: number;
  bearing: number;
  viewMode: 'planar' | 'perspective';
};

const LAYER_VISIBILITY_STORAGE_KEY = 'logistics:layer-visibility';
const MAP_STATE_STORAGE_KEY = 'logistics:map-state';

const readFromStorage = <T,>(key: string): T | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const value = window.localStorage.getItem(key);
    if (!value) {
      return null;
    }
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const saveToStorage = <T,>(key: string, payload: T): void => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    /* пропускаем ошибки записи в localStorage */
  }
};

const getPersistedLayerVisibility = (): LayerVisibilityState | null => {
  const stored = readFromStorage<Partial<LayerVisibilityState>>(
    LAYER_VISIBILITY_STORAGE_KEY,
  );
  if (!stored) {
    return null;
  }
  const tasks = typeof stored.tasks === 'boolean' ? stored.tasks : undefined;
  const optimized =
    typeof stored.optimized === 'boolean' ? stored.optimized : undefined;
  if (tasks === undefined || optimized === undefined) {
    return null;
  }
  return { tasks, optimized };
};

const getPersistedMapState = (): StoredMapState | null => {
  const stored = readFromStorage<Partial<StoredMapState>>(
    MAP_STATE_STORAGE_KEY,
  );
  if (!stored) {
    return null;
  }
  const center =
    Array.isArray(stored.center) &&
    stored.center.length === 2 &&
    stored.center.every(
      (value) => typeof value === 'number' && !Number.isNaN(value),
    )
      ? (stored.center as [number, number])
      : null;
  const zoom =
    typeof stored.zoom === 'number' && Number.isFinite(stored.zoom)
      ? stored.zoom
      : null;
  const pitch =
    typeof stored.pitch === 'number' && Number.isFinite(stored.pitch)
      ? stored.pitch
      : null;
  const bearing =
    typeof stored.bearing === 'number' && Number.isFinite(stored.bearing)
      ? stored.bearing
      : null;
  const viewMode =
    stored.viewMode === 'planar' || stored.viewMode === 'perspective'
      ? stored.viewMode
      : null;
  if (
    !center ||
    zoom === null ||
    pitch === null ||
    bearing === null ||
    viewMode === null
  ) {
    return null;
  }
  return { center, zoom, pitch, bearing, viewMode };
};

const saveLayerVisibility = (value: LayerVisibilityState): void => {
  saveToStorage(LAYER_VISIBILITY_STORAGE_KEY, value);
};

const saveMapState = (value: StoredMapState): void => {
  saveToStorage(MAP_STATE_STORAGE_KEY, value);
};

const GEO_SOURCE_ID = 'logistics-geozones';
const GEO_FILL_LAYER_ID = 'logistics-geozones-fill';
const GEO_OUTLINE_LAYER_ID = 'logistics-geozones-outline';
const TASK_SOURCE_ID = 'logistics-task-routes';
const TASK_LAYER_ID = 'logistics-task-routes-line';
const TASK_CLUSTER_SOURCE_ID = 'logistics-task-markers';
const TASK_CLUSTER_LAYER_ID = 'logistics-task-clusters';
const TASK_CLUSTER_COUNT_LAYER_ID = 'logistics-task-cluster-count';
const TASK_POINTS_LAYER_ID = 'logistics-task-points';
const TASK_ANIMATION_SOURCE_ID = 'logistics-task-animation';
const TASK_ANIMATION_LAYER_ID = 'logistics-task-animation-symbol';
const OPT_SOURCE_ID = 'logistics-optimized-routes';
const OPT_LAYER_ID = 'logistics-optimized-routes-line';
const ADDRESS_SOURCE_ID = 'logistics-addresses';
const ADDRESS_LAYER_ID = 'logistics-addresses-labels';
const ADDRESS_VECTOR_SOURCE_URL = MAP_ADDRESSES_PMTILES_URL;
const HAS_ADDRESS_VECTOR_SOURCE = Boolean(ADDRESS_VECTOR_SOURCE_URL);
const ADDRESS_VECTOR_SOURCE_LAYER = 'addresses';
const MAJOR_LABEL_LAYER_CANDIDATES = [
  'settlement-subdivision-label',
  'settlement-major-label',
  'settlement-neighbourhood-label',
  'airport-label',
  'poi-label',
  'transit-label',
];
const ROAD_LABEL_LAYER_CANDIDATES = [
  'road-label',
  'road-number-shield',
  'bridge-street-minor-label',
  'street-label',
];

type AnyLayerSpecification = Parameters<MapInstance['addLayer']>[0];
type LineLayerSpecification = Extract<AnyLayerSpecification, { type: 'line' }>;
type SymbolLayerSpecification = Extract<
  AnyLayerSpecification,
  { type: 'symbol' }
>;
type CircleLayerSpecification = Extract<
  AnyLayerSpecification,
  { type: 'circle' }
>;

const TASK_START_SYMBOL = '⬤';
const TASK_FINISH_SYMBOL = '⦿';
const ANIMATION_SYMBOL = '▶';
const ROUTE_SPEED_KM_PER_SEC = MAP_ANIMATION_SPEED_KMH / 3600;

const EXCLUDED_TASK_STATUSES = new Set(
  ['Выполнена', 'Отменена', 'completed', 'cancelled', 'canceled', 'done'].map(
    (value) => value.toLowerCase(),
  ),
);

const shouldSkipTaskByStatus = (status: unknown): boolean => {
  if (typeof status !== 'string') {
    return false;
  }
  const normalized = status.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return EXCLUDED_TASK_STATUSES.has(normalized);
};

type CollapsibleCardProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  toggleLabels?: { collapse: string; expand: string };
};

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({
  title,
  description,
  children,
  actions,
  defaultOpen = true,
  toggleLabels,
}) => {
  const [open, setOpen] = React.useState(defaultOpen);
  const collapseLabel = toggleLabels?.collapse ?? 'Свернуть блок';
  const expandLabel = toggleLabels?.expand ?? 'Развернуть блок';
  const ariaLabel = open ? collapseLabel : expandLabel;

  React.useEffect(() => {
    setOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <section className="rounded-lg border bg-white/85 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            {title}
          </h3>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground transition hover:bg-slate-50"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={ariaLabel}
          >
            <span className="sr-only">{ariaLabel}</span>
            {open ? (
              <ChevronUp className="size-4" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>
      {open ? <div className="space-y-3 px-4 py-3">{children}</div> : null}
    </section>
  );
};

const findExistingLayerId = (
  map: MapInstance,
  candidates: readonly string[],
): string | undefined => {
  const style = typeof map.getStyle === 'function' ? map.getStyle() : undefined;
  const layers = style?.layers ?? [];
  return candidates.find((candidate) =>
    layers.some((layer) => layer.id === candidate),
  );
};

const ensureAddressesLayerOrder = (map: MapInstance) => {
  if (typeof map.getStyle !== 'function') {
    return;
  }
  const style = map.getStyle();
  const layers = style?.layers ?? [];
  const addressLayerIndex = layers.findIndex(
    (layer) => layer.id === ADDRESS_LAYER_ID,
  );
  if (addressLayerIndex === -1) {
    return;
  }
  const roadLayerId = findExistingLayerId(map, ROAD_LABEL_LAYER_CANDIDATES);
  if (roadLayerId && typeof map.moveLayer === 'function') {
    const refreshedStyle = map.getStyle();
    const refreshedLayers = refreshedStyle?.layers ?? [];
    const roadIndex = refreshedLayers.findIndex(
      (layer) => layer.id === roadLayerId,
    );
    if (roadIndex !== -1) {
      const nextLayer = refreshedLayers
        .slice(roadIndex + 1)
        .find((layer) => layer.id !== ADDRESS_LAYER_ID);
      if (nextLayer?.id) {
        map.moveLayer(ADDRESS_LAYER_ID, nextLayer.id);
      } else {
        map.moveLayer(ADDRESS_LAYER_ID);
      }
    }
  }
  const majorLabelId = findExistingLayerId(map, MAJOR_LABEL_LAYER_CANDIDATES);
  if (majorLabelId && typeof map.moveLayer === 'function') {
    map.moveLayer(ADDRESS_LAYER_ID, majorLabelId);
  }
};
const MIN_ROUTE_DISTANCE_KM = 0.01;

const createEmptyCollection = <
  T extends GeoJSON.Geometry = GeoJSON.Geometry,
>(): GeoJSON.FeatureCollection<T> => ({
  type: 'FeatureCollection',
  features: [],
});

const toKey = (value: string): string => value.trim().toLowerCase();

const normalizeTransportType = (raw: string): string => {
  const value = raw.trim();
  if (!value) return 'Без транспорта';
  const lowered = value.toLowerCase();
  if (lowered.startsWith('лег')) return 'Легковой';
  if (lowered.startsWith('груз')) return 'Грузовой';
  if (lowered.includes('спец')) return 'Спецтехника';
  if (lowered.includes('пеш')) return 'Пеший';
  return value;
};

const normalizeTaskType = (raw: string): string => {
  const value = raw.trim();
  if (!value) return 'Задача';
  if (value.length === 1) {
    return value.toUpperCase();
  }
  const lower = value.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
};

const getTransportColor = (transportType: string): string => {
  const normalized = normalizeTransportType(transportType);
  return (
    TRANSPORT_TYPE_COLORS[normalized as keyof typeof TRANSPORT_TYPE_COLORS] ??
    TRANSPORT_TYPE_COLORS.default
  );
};

const hexToRgb = (
  value: string,
): { r: number; g: number; b: number } | null => {
  const normalized = value.startsWith('#') ? value.slice(1) : value;
  if (normalized.length === 3) {
    const [r, g, b] = normalized.split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
};

const getContrastTextColor = (background: string): string => {
  const rgb = hexToRgb(background);
  if (!rgb) return '#ffffff';
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
  return luminance > 186 ? '#0f172a' : '#ffffff';
};

const createMarkerImage = (
  fill: string,
  stroke: string,
  text: string,
  textColor: string,
  accent?: string,
): ImageData | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const size = 96;
  const devicePixelRatio =
    typeof window !== 'undefined' && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const scale = devicePixelRatio > 1 ? 2 : 1;
  const canvas = document.createElement('canvas');
  canvas.width = size * scale;
  canvas.height = size * scale;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.scale(scale, scale);
  const center = size / 2;
  const radius = center - 4;
  context.clearRect(0, 0, size, size);
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = 6;
  context.strokeStyle = stroke;
  context.stroke();
  if (accent) {
    context.beginPath();
    context.arc(center, center, radius * 0.55, 0, Math.PI * 2);
    context.lineWidth = 4;
    context.strokeStyle = accent;
    context.stroke();
  }
  if (text) {
    context.fillStyle = textColor;
    context.font = "bold 32px 'Open Sans', 'Arial Unicode MS', sans-serif";
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text.slice(0, 2), center, center);
  }
  return context.getImageData(0, 0, size * scale, size * scale);
};

const buildMarkerIconId = (
  taskTypeKey: string,
  routeStatusKey: string,
  transportKey: string,
  role: string,
): string =>
  ['marker', taskTypeKey, routeStatusKey, transportKey, role]
    .map((part) => part.replace(/\s+/g, '-').toLowerCase())
    .join('-');

const ensureMarkerIcon = (
  map: MapInstance,
  cache: Set<string>,
  iconId: string,
  fill: string,
  stroke: string,
  text: string,
  textColor: string,
  accent?: string,
) => {
  if (!iconId || cache.has(iconId) || map.hasImage(iconId)) {
    cache.add(iconId);
    return;
  }
  const image = createMarkerImage(fill, stroke, text, textColor, accent);
  if (image) {
    map.addImage(iconId, image, { pixelRatio: 2 });
    cache.add(iconId);
  }
};

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

const getTaskTransportType = (task: RouteTask): string => {
  const details = (task as Record<string, unknown>).logistics_details as
    | LogisticsDetails
    | undefined;
  const detailValue =
    typeof details?.transport_type === 'string'
      ? details.transport_type.trim()
      : '';
  const inlineValue =
    typeof (task as Record<string, unknown>).transport_type === 'string'
      ? ((task as Record<string, unknown>).transport_type as string).trim()
      : '';
  const value = detailValue || inlineValue;
  return normalizeTransportType(value);
};

const getTaskTypeLabel = (task: RouteTask): string => {
  const raw =
    typeof (task as Record<string, unknown>).task_type === 'string'
      ? ((task as Record<string, unknown>).task_type as string)
      : typeof (task as Record<string, unknown>).type === 'string'
        ? ((task as Record<string, unknown>).type as string)
        : '';
  return normalizeTaskType(raw);
};

const getTaskTypeInitial = (label: string): string => {
  if (!label) return 'З';
  const trimmed = label.trim();
  if (!trimmed) return 'З';
  return trimmed.charAt(0).toUpperCase();
};

const getVehicleCoordinates = (
  vehicle: FleetVehicleDto,
): [number, number] | null => {
  const position = (vehicle as Record<string, unknown>).position as
    | { lat?: number; lon?: number; lng?: number; long?: number }
    | undefined;
  if (!position) return null;
  const latCandidate =
    typeof position.lat === 'number'
      ? position.lat
      : typeof (position as Record<string, unknown>).latitude === 'number'
        ? ((position as Record<string, unknown>).latitude as number)
        : null;
  const lonCandidate =
    typeof position.lon === 'number'
      ? position.lon
      : typeof position.lng === 'number'
        ? position.lng
        : typeof position.long === 'number'
          ? position.long
          : typeof (position as Record<string, unknown>).longitude === 'number'
            ? ((position as Record<string, unknown>).longitude as number)
            : null;
  if (
    latCandidate === null ||
    lonCandidate === null ||
    !Number.isFinite(latCandidate) ||
    !Number.isFinite(lonCandidate)
  ) {
    return null;
  }
  return [lonCandidate, latCandidate];
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

const toLatLng = (
  position: GeoJSON.Position,
): { lat: number; lng: number } => ({
  lng: position[0],
  lat: position[1],
});

const computeBearing = (
  from: GeoJSON.Position,
  to: GeoJSON.Position,
): number => {
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
    type: 'Feature',
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
    type: 'Feature',
    geometry,
    properties: metricsProperties,
  };
  const bufferedFeature: GeoZoneFeature = {
    type: 'Feature',
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
  MAP_DEFAULT_CENTER[0],
  MAP_DEFAULT_CENTER[1],
];
const UKRAINE_BOUNDS: LngLatBoundsLike = MAP_MAX_BOUNDS;
const isRasterFallback = MAP_STYLE_MODE !== 'pmtiles';
const shouldShowMapFallbackNotice = isRasterFallback && MAP_STYLE_IS_DEFAULT;

export default function LogisticsPage() {
  const { t, i18n } = useTranslation();
  const collapseToggleLabels = React.useMemo(
    () => ({
      collapse: t('logistics.collapseSection', {
        defaultValue: 'Свернуть блок',
      }),
      expand: t('logistics.expandSection', {
        defaultValue: 'Развернуть блок',
      }),
    }),
    [t],
  );
  const tRef = useI18nRef(t);
  const language = i18n.language;
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
  const [allRouteTasks, setAllRouteTasks] = React.useState<RouteTask[]>([]);
  const [vehicles, setVehicles] = React.useState(1);
  const [method, setMethod] = React.useState('angle');
  const [links, setLinks] = React.useState<string[]>([]);
  const [plan, setPlan] = React.useState<RoutePlan | null>(null);
  const [planDraft, setPlanDraft] = React.useState<RoutePlan | null>(null);
  const [planMessage, setPlanMessage] = React.useState('');
  const [planMessageTone, setPlanMessageTone] = React.useState<
    'neutral' | 'error' | 'success'
  >('neutral');
  const [planLoading, setPlanLoading] = React.useState(false);
  const mapRef = React.useRef<MapInstance | null>(null);
  const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
  const drawRef = React.useRef<MapLibreDraw | null>(null);
  const persistedLayerVisibilityRef = React.useRef<LayerVisibilityState | null>(
    getPersistedLayerVisibility(),
  );
  const persistedMapStateRef = React.useRef<StoredMapState | null>(
    getPersistedMapState(),
  );
  React.useEffect(() => {
    if (isRasterFallback) {
      console.warn(
        'Используется временный растровый слой OpenStreetMap. Подключите локальные PMTiles, чтобы вернуть полный стиль.',
      );
      return;
    }
    if (!HAS_ADDRESS_VECTOR_SOURCE) {
      console.warn(
        'Адресные плитки не подключены. Слой домовых номеров будет пропущен.',
      );
    }
  }, []);
  const [mapViewMode, setMapViewMode] = React.useState<
    'planar' | 'perspective'
  >(persistedMapStateRef.current?.viewMode ?? 'planar');
  const routeAnimationRef = React.useRef<{
    frameId: number | null;
    lastTimestamp: number | null;
    routes: AnimatedRoute[];
  }>({ frameId: null, lastTimestamp: null, routes: [] });
  const initialMapStateAppliedRef = React.useRef(false);
  const [availableVehicles, setAvailableVehicles] = React.useState<
    FleetVehicleDto[]
  >([]);
  const [fleetError, setFleetError] = React.useState('');
  const [vehiclesHint, setVehiclesHint] = React.useState('');
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [selectedVehicleId, setSelectedVehicleIdState] = React.useState<
    string | null
  >(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      const initial = params.get('selectedVehicleId');
      return initial && initial.trim() ? initial.trim() : null;
    } catch {
      return null;
    }
  });
  const [layerVisibility, setLayerVisibility] =
    React.useState<LayerVisibilityState>(
      persistedLayerVisibilityRef.current ?? DEFAULT_LAYER_VISIBILITY,
    );
  const [mapReady, setMapReady] = React.useState(false);
  const [mobileView, setMobileView] = React.useState<'map' | 'list'>('map');
  const [hiddenTaskTypes, setHiddenTaskTypes] = React.useState<string[]>([]);
  const [hiddenRouteStatuses, setHiddenRouteStatuses] = React.useState<
    RouteStatusFilterKey[]
  >([]);
  const [hiddenTransportTypes, setHiddenTransportTypes] = React.useState<
    string[]
  >([]);
  const [clusterSelection, setClusterSelection] = React.useState<{
    ids: string[];
    center: GeoJSON.Position | null;
  } | null>(null);
  const [geoZones, setGeoZones] = React.useState<GeoZone[]>([]);
  const [activeGeoZoneIds, setActiveGeoZoneIds] = React.useState<string[]>([]);
  const [geoZonesEnabled, setGeoZonesEnabled] = React.useState(true);
  const [isDrawing, setIsDrawing] = React.useState(false);
  const [optimizedRoutesGeoJSON, setOptimizedRoutesGeoJSON] = React.useState<
    GeoJSON.FeatureCollection<GeoJSON.LineString>
  >(createEmptyCollection<GeoJSON.LineString>());
  const [page, setPage] = React.useState(0);
  const hasLoadedFleetRef = React.useRef(false);
  const markerIconCacheRef = React.useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const withTrack = React.useMemo(() => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const raw = searchParams.get('withTrack');
      return raw === 'true' || raw === '1';
    } catch {
      return false;
    }
  }, [location.search]);
  const hasDialog = params.has('task') || params.has('newTask');
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;
  React.useEffect(() => {
    saveLayerVisibility(layerVisibility);
  }, [layerVisibility]);
  React.useEffect(() => {
    try {
      const searchParams = new URLSearchParams(location.search);
      const raw = searchParams.get('selectedVehicleId');
      const normalized = raw && raw.trim() ? raw.trim() : null;
      setSelectedVehicleIdState((current) =>
        current === normalized ? current : normalized,
      );
    } catch {
      setSelectedVehicleIdState((current) => current);
    }
  }, [location.search]);
  const syncSelectedVehicleId = React.useCallback(
    (updater: (current: string | null) => string | null) => {
      setSelectedVehicleIdState((current) => {
        const nextRaw = updater(current);
        const next = nextRaw && nextRaw.trim() ? nextRaw.trim() : null;
        if (current === next) {
          return current;
        }
        if (
          typeof window !== 'undefined' &&
          typeof window.history?.replaceState === 'function'
        ) {
          try {
            const url = new URL(window.location.href);
            if (next) {
              url.searchParams.set('selectedVehicleId', next);
            } else {
              url.searchParams.delete('selectedVehicleId');
            }
            window.history.replaceState(
              window.history.state,
              '',
              `${url.pathname}${url.search}${url.hash}`,
            );
          } catch {
            /* игнорируем ошибки построения URL */
          }
        }
        return next;
      });
    },
    [],
  );
  const setSelectedVehicleId = React.useCallback(
    (value: string | null) => {
      syncSelectedVehicleId(() => value);
    },
    [syncSelectedVehicleId],
  );
  const toggleSelectedVehicleId = React.useCallback(
    (value: string) => {
      syncSelectedVehicleId((current) => (current === value ? null : value));
    },
    [syncSelectedVehicleId],
  );
  const vehiclesWithCoordinates = React.useMemo(
    () =>
      availableVehicles.filter(
        (vehicle) => getVehicleCoordinates(vehicle) !== null,
      ),
    [availableVehicles],
  );
  const selectedVehicle = React.useMemo(
    () =>
      availableVehicles.find((vehicle) => vehicle.id === selectedVehicleId) ??
      null,
    [availableVehicles, selectedVehicleId],
  );
  React.useEffect(() => {
    if (!selectedVehicleId) {
      return;
    }
    if (availableVehicles.some((vehicle) => vehicle.id === selectedVehicleId)) {
      return;
    }
    setSelectedVehicleId(null);
  }, [availableVehicles, selectedVehicleId, setSelectedVehicleId]);
  const hiddenTaskTypesSet = React.useMemo(
    () => new Set(hiddenTaskTypes),
    [hiddenTaskTypes],
  );
  const hiddenRouteStatusesSet = React.useMemo(
    () => new Set(hiddenRouteStatuses),
    [hiddenRouteStatuses],
  );
  const hiddenTransportTypesSet = React.useMemo(
    () => new Set(hiddenTransportTypes),
    [hiddenTransportTypes],
  );
  const selectedTaskIdsSet = React.useMemo(
    () => new Set(clusterSelection?.ids ?? []),
    [clusterSelection],
  );

  const filteredTasksByZone = React.useMemo(
    () =>
      geoZonesEnabled
        ? filterTasksByGeoZones(allRouteTasks, geoZones, activeGeoZoneIds)
        : allRouteTasks,
    [activeGeoZoneIds, allRouteTasks, geoZones, geoZonesEnabled],
  );

  const taskRouteStatusMap = React.useMemo(() => {
    const map = new Map<string, TaskRouteStatusKey>();
    const registerPlan = (source: RoutePlan | null) => {
      if (!source) return;
      const status: RoutePlanStatus = source.status ?? 'draft';
      source.routes.forEach((route) => {
        route.tasks.forEach((taskRef) => {
          const idCandidate =
            typeof taskRef.taskId === 'string'
              ? taskRef.taskId
              : typeof (taskRef as Record<string, unknown>).task_id === 'string'
                ? ((taskRef as Record<string, unknown>).task_id as string)
                : null;
          if (!idCandidate) return;
          map.set(idCandidate, status);
        });
      });
    };
    registerPlan(planDraft ?? null);
    if (plan) {
      registerPlan(plan);
    }
    return map;
  }, [plan, planDraft]);

  const categoryFilteredTasks = React.useMemo(() => {
    return filteredTasksByZone.filter((task) => {
      const routeStatus = (taskRouteStatusMap.get(task._id) ??
        'unassigned') as RouteStatusFilterKey;
      if (hiddenRouteStatusesSet.has(routeStatus)) {
        return false;
      }
      const transportLabel = getTaskTransportType(task);
      const transportKey = toKey(transportLabel);
      if (hiddenTransportTypesSet.has(transportKey)) {
        return false;
      }
      const typeLabel = getTaskTypeLabel(task);
      const typeKey = toKey(typeLabel);
      if (hiddenTaskTypesSet.has(typeKey)) {
        return false;
      }
      return true;
    });
  }, [
    filteredTasksByZone,
    hiddenRouteStatusesSet,
    hiddenTaskTypesSet,
    hiddenTransportTypesSet,
    taskRouteStatusMap,
  ]);

  const taskStatus = React.useMemo(() => {
    const counts: Record<string, number> = {};
    categoryFilteredTasks.forEach((task) => {
      const rawStatus =
        typeof task.status === 'string' && task.status.trim()
          ? task.status.trim()
          : 'Новая';
      counts[rawStatus] = (counts[rawStatus] ?? 0) + 1;
    });
    return counts;
  }, [categoryFilteredTasks]);

  const routeStatusMetadata = React.useMemo(() => {
    const entries = new Map<
      RouteStatusFilterKey,
      { count: number; color: string }
    >();
    ROUTE_STATUS_ORDER.forEach((key) => {
      entries.set(key, { count: 0, color: getRouteStatusColor(key) });
    });
    filteredTasksByZone.forEach((task) => {
      const statusKey = (taskRouteStatusMap.get(task._id) ??
        'unassigned') as RouteStatusFilterKey;
      const entry = entries.get(statusKey);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(statusKey, {
          count: 1,
          color: getRouteStatusColor(statusKey),
        });
      }
    });
    if (vehiclesWithCoordinates.length) {
      const entry = entries.get('vehicle');
      if (entry) {
        entry.count += vehiclesWithCoordinates.length;
      } else {
        entries.set('vehicle', {
          count: vehiclesWithCoordinates.length,
          color: getRouteStatusColor('vehicle'),
        });
      }
    }
    return entries;
  }, [filteredTasksByZone, taskRouteStatusMap, vehiclesWithCoordinates]);

  const transportMetadata = React.useMemo(() => {
    const entries = new Map<
      string,
      { label: string; count: number; color: string }
    >();
    filteredTasksByZone.forEach((task) => {
      const label = getTaskTransportType(task);
      const normalized = normalizeTransportType(label);
      const key = toKey(normalized);
      const color = getTransportColor(normalized);
      const entry = entries.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(key, { label: normalized, count: 1, color });
      }
    });
    vehiclesWithCoordinates.forEach((vehicle) => {
      const label = normalizeTransportType(vehicle.transportType ?? '');
      const key = toKey(label);
      const color = getTransportColor(label);
      const entry = entries.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        entries.set(key, { label, count: 1, color });
      }
    });
    return entries;
  }, [filteredTasksByZone, vehiclesWithCoordinates]);

  const taskTypeMetadata = React.useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    filteredTasksByZone.forEach((task) => {
      const label = getTaskTypeLabel(task);
      const key = toKey(label);
      const entry = counts.get(key);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(key, { label, count: 1 });
      }
    });
    if (vehiclesWithCoordinates.length) {
      counts.set(VEHICLE_TASK_TYPE_KEY, {
        label: VEHICLE_TASK_TYPE_LABEL,
        count: vehiclesWithCoordinates.length,
      });
    }
    const sortedKeys = Array.from(counts.keys()).sort();
    const entries = new Map<
      string,
      { label: string; count: number; color: string }
    >();
    sortedKeys.forEach((key, index) => {
      const meta = counts.get(key);
      if (!meta) return;
      const color =
        TASK_TYPE_COLOR_PALETTE[index % TASK_TYPE_COLOR_PALETTE.length];
      entries.set(key, { label: meta.label, count: meta.count, color });
    });
    return entries;
  }, [filteredTasksByZone, vehiclesWithCoordinates]);

  const routeStatusEntries = React.useMemo(
    () =>
      ROUTE_STATUS_ORDER.map((key) => ({
        key,
        count: routeStatusMetadata.get(key)?.count ?? 0,
        color: getRouteStatusColor(key),
      })),
    [routeStatusMetadata],
  );

  const transportEntries = React.useMemo(
    () =>
      Array.from(transportMetadata.entries())
        .sort((a, b) => a[1].label.localeCompare(b[1].label))
        .map(([key, value]) => ({ key, ...value })),
    [transportMetadata],
  );

  const taskTypeEntries = React.useMemo(
    () =>
      Array.from(taskTypeMetadata.entries()).map(([key, value]) => ({
        key,
        ...value,
      })),
    [taskTypeMetadata],
  );

  const taskPointsGeoJSON = React.useMemo(() => {
    const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const appendFeature = (
      coordinates: [number, number],
      properties: GeoJSON.GeoJsonProperties,
    ) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates },
        properties,
      });
    };
    categoryFilteredTasks.forEach((task) => {
      const routeStatus = (taskRouteStatusMap.get(task._id) ??
        'unassigned') as TaskRouteStatusKey;
      const routeStatusKey: RouteStatusFilterKey = routeStatus;
      const routeColor = getRouteStatusColor(routeStatusKey);
      const transportLabel = getTaskTransportType(task);
      const transportKey = toKey(transportLabel);
      const transportColor = getTransportColor(transportLabel);
      const typeLabel = getTaskTypeLabel(task);
      const typeKey = toKey(typeLabel);
      const typeColor = taskTypeMetadata.get(typeKey)?.color ?? '#334155';
      const iconText = getTaskTypeInitial(typeLabel);
      const textColor = getContrastTextColor(transportColor);
      const title = task.title ?? task._id;
      const label = title.length > 28 ? `${title.slice(0, 25)}…` : title;
      const isSelected = selectedTaskIdsSet.has(task._id);
      const start = toPosition(task.startCoordinates);
      const finish = toPosition(task.finishCoordinates);
      if (start) {
        const iconId = buildMarkerIconId(
          typeKey,
          routeStatusKey,
          transportKey,
          'start',
        );
        appendFeature(start, {
          entity: 'task',
          taskId: task._id,
          title,
          label,
          routeStatus: routeStatusKey,
          transportType: transportLabel,
          taskType: typeLabel,
          pointRole: 'start',
          iconId,
          iconFill: transportColor,
          iconStroke: routeColor,
          iconText,
          iconTextColor: textColor,
          iconAccent: typeColor,
          selected: isSelected,
        });
      }
      if (finish) {
        const iconId = buildMarkerIconId(
          typeKey,
          routeStatusKey,
          transportKey,
          'finish',
        );
        appendFeature(finish, {
          entity: 'task',
          taskId: task._id,
          title,
          label,
          routeStatus: routeStatusKey,
          transportType: transportLabel,
          taskType: typeLabel,
          pointRole: 'finish',
          iconId,
          iconFill: transportColor,
          iconStroke: routeColor,
          iconText,
          iconTextColor: textColor,
          iconAccent: typeColor,
          selected: isSelected,
        });
      }
    });
    vehiclesWithCoordinates.forEach((vehicle) => {
      const coordinates = getVehicleCoordinates(vehicle);
      if (!coordinates) return;
      const transportLabel = normalizeTransportType(
        vehicle.transportType ?? '',
      );
      const transportKey = toKey(transportLabel);
      const routeStatusKey: RouteStatusFilterKey = 'vehicle';
      if (hiddenRouteStatusesSet.has(routeStatusKey)) return;
      if (hiddenTransportTypesSet.has(transportKey)) return;
      if (hiddenTaskTypesSet.has(VEHICLE_TASK_TYPE_KEY)) return;
      const transportColor = getTransportColor(transportLabel);
      const iconText = getTaskTypeInitial(VEHICLE_TASK_TYPE_LABEL);
      const textColor = getContrastTextColor(transportColor);
      const typeColor =
        taskTypeMetadata.get(VEHICLE_TASK_TYPE_KEY)?.color ?? '#0f172a';
      const iconId = buildMarkerIconId(
        VEHICLE_TASK_TYPE_KEY,
        routeStatusKey,
        transportKey,
        'vehicle',
      );
      const title = vehicle.name;
      const label = title.length > 28 ? `${title.slice(0, 25)}…` : title;
      appendFeature(coordinates, {
        entity: 'vehicle',
        vehicleId: vehicle.id,
        title,
        label,
        routeStatus: routeStatusKey,
        transportType: transportLabel,
        taskType: VEHICLE_TASK_TYPE_LABEL,
        pointRole: 'vehicle',
        iconId,
        iconFill: transportColor,
        iconStroke: getRouteStatusColor(routeStatusKey),
        iconText,
        iconTextColor: textColor,
        iconAccent: typeColor,
        selected: selectedVehicleId === vehicle.id,
      });
    });
    return {
      type: 'FeatureCollection' as const,
      features,
    } satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;
  }, [
    categoryFilteredTasks,
    hiddenRouteStatusesSet,
    hiddenTaskTypesSet,
    hiddenTransportTypesSet,
    selectedTaskIdsSet,
    taskRouteStatusMap,
    taskTypeMetadata,
    vehiclesWithCoordinates,
    selectedVehicleId,
  ]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(TASK_CLUSTER_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) return;
    taskPointsGeoJSON.features.forEach((feature) => {
      const iconId = feature.properties?.iconId;
      if (typeof iconId !== 'string' || !iconId) return;
      const fill =
        typeof feature.properties?.iconFill === 'string'
          ? (feature.properties.iconFill as string)
          : '#2563eb';
      const stroke =
        typeof feature.properties?.iconStroke === 'string'
          ? (feature.properties.iconStroke as string)
          : '#0f172a';
      const text =
        typeof feature.properties?.iconText === 'string'
          ? (feature.properties.iconText as string)
          : '';
      const textColor =
        typeof feature.properties?.iconTextColor === 'string'
          ? (feature.properties.iconTextColor as string)
          : getContrastTextColor(fill);
      const accent =
        typeof feature.properties?.iconAccent === 'string'
          ? (feature.properties.iconAccent as string)
          : undefined;
      ensureMarkerIcon(
        map,
        markerIconCacheRef.current,
        iconId,
        fill,
        stroke,
        text,
        textColor,
        accent,
      );
    });
    const data = layerVisibility.tasks
      ? taskPointsGeoJSON
      : createEmptyCollection();
    source.setData(data);
  }, [layerVisibility.tasks, mapReady, taskPointsGeoJSON]);

  const legendItems = React.useMemo(() => {
    const base = TASK_STATUSES.map((status) => ({
      key: status,
      label: status,
      color: TASK_STATUS_COLORS[status] ?? '#2563eb',
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
          color: TASK_STATUS_COLORS[status] ?? '#2563eb',
          count: taskStatus[status] ?? 0,
        });
      });
    }
    return base;
  }, [taskStatus]);

  const displayedTasks = React.useMemo(() => {
    if (!selectedTaskIdsSet.size) {
      return categoryFilteredTasks;
    }
    return categoryFilteredTasks.filter((task) =>
      selectedTaskIdsSet.has(task._id),
    );
  }, [categoryFilteredTasks, selectedTaskIdsSet]);

  const displayedSignature = React.useMemo(
    () =>
      JSON.stringify(
        displayedTasks.map((task) => [
          task._id,
          task.status,
          task.updatedAt ?? null,
        ]),
      ),
    [displayedTasks],
  );

  const lastSyncedSignatureRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!clusterSelection) return;
    const ids = new Set(clusterSelection.ids);
    const stillPresent = categoryFilteredTasks.some((task) =>
      ids.has(task._id),
    );
    if (!stillPresent) {
      setClusterSelection(null);
    }
  }, [categoryFilteredTasks, clusterSelection]);

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
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: position },
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
      type: 'FeatureCollection',
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
      const delta =
        lastTimestamp != null ? (timestamp - lastTimestamp) / 1000 : 0;
      const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
      controllerState.routes.forEach((route) => {
        if (route.total <= 0) {
          return;
        }
        route.progress =
          (route.progress + delta * ROUTE_SPEED_KM_PER_SEC) % route.total;
        const { position, bearing } = getAnimationPoint(route, route.progress);
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: position },
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
        type: 'FeatureCollection',
        features,
      });
      controllerState.frameId = requestAnimationFrame(step);
    };
    controller.frameId = requestAnimationFrame(step);
  }, [mapReady, stopRouteAnimation]);

  React.useEffect(() => {
    if (lastSyncedSignatureRef.current === displayedSignature) {
      return;
    }
    lastSyncedSignatureRef.current = displayedSignature;
    setSorted(displayedTasks);
    const rawTelegramId = user?.telegram_id;
    const userId =
      rawTelegramId === undefined || rawTelegramId === null
        ? undefined
        : Number(rawTelegramId) || undefined;
    controller.setIndex('logistics:all', displayedTasks, {
      kind: 'task',
      mine: false,
      userId,
      pageSize: displayedTasks.length,
      total: displayedTasks.length,
      sort: 'desc',
    });
  }, [controller, displayedSignature, displayedTasks, user]);

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
      updater: (
        route: RoutePlan['routes'][number],
      ) => RoutePlan['routes'][number],
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
    setPlanDraft((current) =>
      current ? { ...current, title: value } : current,
    );
  }, []);

  const handlePlanNotesChange = React.useCallback((value: string) => {
    setPlanDraft((current) =>
      current ? { ...current, notes: value } : current,
    );
  }, []);

  const handleDriverNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        driverName: value,
      }));
    },
    [updateRouteDraft],
  );

  const handleVehicleNameChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        vehicleName: value,
      }));
    },
    [updateRouteDraft],
  );

  const handleRouteNotesChange = React.useCallback(
    (routeIndex: number, value: string) => {
      updateRouteDraft(routeIndex, (route) => ({
        ...route,
        notes: value || null,
      }));
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
    if (!geoZonesEnabled) {
      return;
    }
    const draw = drawRef.current;
    if (!draw) return;
    draw.changeMode('draw_polygon');
  }, [geoZonesEnabled]);

  const handleToggleZone = React.useCallback(
    (zoneId: string, checked: boolean) => {
      setActiveGeoZoneIds((prev) => {
        const next = new Set(prev);
        if (checked) {
          next.add(zoneId);
        } else {
          next.delete(zoneId);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleRouteStatusVisibilityChange = React.useCallback(
    (status: RouteStatusFilterKey, visible: boolean) => {
      setHiddenRouteStatuses((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(status);
        } else {
          next.add(status);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleTransportVisibilityChange = React.useCallback(
    (key: string, visible: boolean) => {
      setHiddenTransportTypes((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleTaskTypeVisibilityChange = React.useCallback(
    (key: string, visible: boolean) => {
      setHiddenTaskTypes((prev) => {
        const next = new Set(prev);
        if (visible) {
          next.delete(key);
        } else {
          next.add(key);
        }
        return Array.from(next);
      });
    },
    [],
  );

  const handleClearClusterSelection = React.useCallback(() => {
    setClusterSelection(null);
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
    const title = translate('logistics.metaTitle');
    const description = translate('logistics.metaDescription');
    const image = '/hero/logistics.png';

    document.title = title;

    const ensureMeta = (
      attribute: 'name' | 'property',
      name: string,
      value: string,
    ) => {
      let element = document.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${name}"]`,
      );
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', value);
    };

    ensureMeta('name', 'description', description);
    ensureMeta('property', 'og:title', title);
    ensureMeta('property', 'og:description', description);
    ensureMeta('property', 'og:image', image);
  }, [language]);

  const openTask = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(location.search);
      params.set('task', id);
      navigate({ search: params.toString() }, { replace: true });
    },
    [location, navigate],
  );

  const filterRouteTasks = React.useCallback((input: RouteTask[]) => {
    const hasPoint = (coords?: Coords | null) =>
      typeof coords?.lat === 'number' &&
      Number.isFinite(coords.lat) &&
      typeof coords?.lng === 'number' &&
      Number.isFinite(coords.lng);

    const result: RouteTask[] = [];
    input.forEach((task) => {
      const taskStatus =
        (typeof task.status === 'string' ? task.status : undefined) ??
        (typeof (task as Record<string, unknown>).status === 'string'
          ? ((task as Record<string, unknown>).status as string)
          : undefined);
      if (shouldSkipTaskByStatus(taskStatus)) {
        return;
      }
      const transportType = getTaskTransportType(task);

      const details = (task as Record<string, unknown>).logistics_details as
        | LogisticsDetails
        | undefined;

      const resolveLocation = (primary: unknown, fallback: unknown): string => {
        if (typeof primary === 'string') {
          const value = primary.trim();
          if (value) {
            return value;
          }
        }
        if (typeof fallback === 'string') {
          const value = fallback.trim();
          if (value) {
            return value;
          }
        }
        return '';
      };

      const startLocation = resolveLocation(
        details?.start_location,
        (task as Record<string, unknown>).start_location,
      );
      const endLocation = resolveLocation(
        details?.end_location,
        (task as Record<string, unknown>).end_location,
      );

      const hasCoordinates =
        hasPoint(task.startCoordinates) || hasPoint(task.finishCoordinates);
      const hasAddresses = Boolean(startLocation) || Boolean(endLocation);

      if (!hasCoordinates && !hasAddresses) {
        return;
      }

      const enrichedDetails: LogisticsDetails = {
        ...(details ?? {}),
      };
      if (!enrichedDetails.transport_type) {
        enrichedDetails.transport_type = transportType;
      }
      if (!enrichedDetails.start_location && startLocation) {
        enrichedDetails.start_location = startLocation;
      }
      if (!enrichedDetails.end_location && endLocation) {
        enrichedDetails.end_location = endLocation;
      }

      const enrichedTask: RouteTask = {
        ...task,
        logistics_details: enrichedDetails,
      };
      const taskRecord = enrichedTask as Record<string, unknown>;
      if (!taskRecord.transport_type) {
        taskRecord.transport_type = transportType;
      }
      if (startLocation && !taskRecord.start_location) {
        taskRecord.start_location = startLocation;
      }
      if (endLocation && !taskRecord.end_location) {
        taskRecord.end_location = endLocation;
      }

      result.push(enrichedTask);
    });
    return result;
  }, []);

  const load = React.useCallback(() => {
    const rawTelegramId = user?.telegram_id;
    const userId =
      rawTelegramId === undefined || rawTelegramId === null
        ? undefined
        : Number(rawTelegramId) || undefined;
    fetchTasks({}, userId, true).then((data: unknown) => {
      const listSource = Array.isArray(data)
        ? data
        : typeof data === 'object' && data !== null
          ? ((data as Record<string, unknown>).items ??
            (data as Record<string, unknown>).tasks ??
            (data as Record<string, unknown>).data ??
            [])
          : [];
      const raw = Array.isArray(listSource) ? listSource : [];
      const mapped: Array<RouteTask | null> = raw.map((item) => {
        if (typeof item !== 'object' || item === null) {
          return null;
        }
        const task = item as Record<string, unknown> &
          RouteTask & { id?: string };
        const identifier = String(task._id ?? task.id ?? '').trim();
        if (!identifier) {
          return null;
        }
        return {
          ...task,
          id: identifier,
          _id: identifier,
        } satisfies RouteTask;
      });
      const list = mapped.filter((task): task is RouteTask => Boolean(task));
      const filtered = filterRouteTasks(list);
      setAllRouteTasks(filtered);
    });
  }, [controller, filterRouteTasks, user]);

  const loadFleetVehicles = React.useCallback(async () => {
    if (role !== 'admin') return;
    setVehiclesLoading(true);
    setVehiclesHint('');
    setFleetError('');
    try {
      const data = await listFleetVehicles('', 1, 100);
      setAvailableVehicles(data.items);
      if (!data.items.length) {
        setVehiclesHint(tRef.current('logistics.noVehicles'));
        return;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : tRef.current('logistics.loadError');
      setVehiclesHint(message);
      setAvailableVehicles([]);
      setFleetError(message);
    } finally {
      setVehiclesLoading(false);
    }
  }, [role, tRef]);

  const refreshAll = React.useCallback(() => {
    load();
    if (role === 'admin') {
      void loadFleetVehicles();
    }
  }, [load, loadFleetVehicles, role]);

  const refreshFleet = React.useCallback(() => {
    if (role === 'admin') {
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  useIntervalEffect(
    () => {
      if (role === 'admin') {
        void loadFleetVehicles();
      }
    },
    LOGISTICS_FLEET_POLL_INTERVAL_MS,
    {
      enabled: role === 'admin' && withTrack,
      deps: [loadFleetVehicles, role, withTrack],
    },
  );

  React.useEffect(() => {
    const pending = {
      tasks: false,
      plan: false,
      fleet: false,
    };
    let isActive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const flush = () => {
      timer = null;
      if (!isActive) {
        pending.tasks = false;
        pending.plan = false;
        pending.fleet = false;
        return;
      }
      const shouldRefreshTasks = pending.tasks;
      const shouldRefreshPlan = pending.plan;
      const shouldRefreshFleet = pending.fleet;
      pending.tasks = false;
      pending.plan = false;
      pending.fleet = false;

      if (shouldRefreshTasks) {
        load();
      }
      if (shouldRefreshFleet) {
        refreshFleet();
      }
      if (shouldRefreshPlan) {
        void loadPlan();
      }
    };

    const schedule = () => {
      if (timer !== null) {
        return;
      }
      if (LOGISTICS_EVENT_DEBOUNCE_MS <= 0) {
        flush();
        return;
      }
      timer = setTimeout(flush, LOGISTICS_EVENT_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeLogisticsEvents((event) => {
      switch (event.type) {
        case 'logistics.init':
          pending.tasks = false;
          pending.plan = false;
          pending.fleet = false;
          load();
          refreshFleet();
          void loadPlan();
          return;
        case 'tasks.changed':
          pending.tasks = false;
          pending.plan = false;
          load();
          void loadPlan();
          return;
        case 'route-plan.updated':
        case 'route-plan.removed':
          pending.plan = false;
          void loadPlan();
          return;
        default:
          return;
      }
      schedule();
    });

    return () => {
      isActive = false;
      clearTimer();
      unsubscribe();
    };
  }, [load, loadPlan, refreshFleet]);

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

  const formatDuration = React.useCallback(
    (value: number | null | undefined) => {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        const totalMinutes = Math.round(value);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const parts: string[] = [];
        if (hours > 0) {
          parts.push(
            tRef.current('logistics.etaHours', {
              count: hours,
            }),
          );
        }
        if (minutes > 0 || hours === 0) {
          parts.push(
            tRef.current('logistics.etaMinutes', {
              count: minutes,
            }),
          );
        }
        return parts.join(' ');
      }
      return tRef.current('logistics.planNoEta');
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

  const planStatus: RoutePlanStatus =
    planDraft?.status ?? plan?.status ?? 'draft';
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
  const planTotalTasks =
    planDraft?.metrics?.totalTasks ?? planDraft?.tasks.length ?? 0;

  const reset = React.useCallback(() => {
    setOptimizedRoutesGeoJSON(createEmptyCollection<GeoJSON.LineString>());
    setLinks([]);
  }, []);

  React.useEffect(() => {
    load();
  }, [load, location.key]);

  React.useEffect(() => {
    setPage(0);
  }, [displayedSignature]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== 'admin') {
      hasLoadedFleetRef.current = false;
      setAvailableVehicles([]);
      setFleetError(role === 'manager' ? translate('logistics.adminOnly') : '');
      setVehiclesHint(role ? translate('logistics.noAccess') : '');
      setSelectedVehicleId(null);
      return;
    }
    setVehiclesHint('');
    setFleetError('');
    if (!hasLoadedFleetRef.current) {
      hasLoadedFleetRef.current = true;
      void loadFleetVehicles();
    }
  }, [loadFleetVehicles, role]);

  React.useEffect(() => {
    const translate = tRef.current;
    if (role !== 'admin') {
      return;
    }
    if (!availableVehicles.length && !fleetError && !vehiclesLoading) {
      setVehiclesHint(translate('logistics.noVehicles'));
    }
  }, [availableVehicles.length, fleetError, role, vehiclesLoading]);

  React.useEffect(() => {
    if (mapRef.current) return;

    let cancelled = false;
    let map: MapInstance | null = null;
    let detachStyleFallback: () => void = () => {};
    let ensureBuildingsLayer: (() => void) | null = null;
    let handleLoad: (() => void) | null = null;
    let ensureAddressLayer: (() => Promise<void>) | null = null;

    const initMap = async () => {
      let pmtilesReady = false;
      if (MAP_STYLE_MODE === 'pmtiles') {
        try {
          pmtilesReady = await registerPmtilesProtocol();
          if (pmtilesReady) {
            console.info(
              'Протокол PMTiles зарегистрирован, инициализируем карту с векторным стилем.',
            );
          } else {
            console.warn(
              'Протокол PMTiles не зарегистрирован, будет использован запасной стиль карты.',
            );
          }
        } catch (error) {
          console.error('Ошибка регистрации протокола PMTiles.', error);
        }
        if (cancelled) {
          return;
        }
      }
      if (cancelled || mapRef.current) {
        return;
      }
      const styleForMap =
        MAP_STYLE_MODE === 'pmtiles' && !pmtilesReady
          ? MAP_STYLE_DEFAULT_URL
          : MAP_STYLE;
      const container = mapContainerRef.current;
      if (!container) {
        return;
      }
      const initialMapState = persistedMapStateRef.current;
      const mapInstance = new mapLibrary.Map({
        container,
        style: styleForMap,
        center: initialMapState?.center ?? MAP_CENTER_LNG_LAT,
        zoom: initialMapState?.zoom ?? MAP_DEFAULT_ZOOM,
        pitch: initialMapState?.pitch ?? 0,
        bearing: initialMapState?.bearing ?? 0,
        minZoom: 5,
        maxZoom: 22,
        maxBounds: UKRAINE_BOUNDS,
      });
      map = mapInstance;
      mapRef.current = mapInstance;
      detachStyleFallback = attachMapStyleFallback(mapInstance, {
        initialStyle: styleForMap,
      });
      if (typeof mapInstance.dragRotate?.disable === 'function') {
        mapInstance.dragRotate.disable();
      }
      if (typeof mapInstance.touchZoomRotate?.disableRotation === 'function') {
        mapInstance.touchZoomRotate.disableRotation();
      }
      const navigation = new mapLibrary.NavigationControl({
        showCompass: false,
      });
      mapInstance.addControl(navigation, 'top-right');
      const attribution = new mapLibrary.AttributionControl({
        compact: true,
        customAttribution: MAP_ATTRIBUTION,
      });
      mapInstance.addControl(attribution, 'bottom-right');
      const draw = new MapLibreDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        defaultMode: 'simple_select',
        styles: customTheme,
      });
      drawRef.current = draw;
      mapInstance.addControl(draw, 'top-left');
      ensureBuildingsLayer = () => {
        if (
          typeof mapInstance.isStyleLoaded === 'function' &&
          !mapInstance.isStyleLoaded()
        ) {
          return;
        }
        insert3dBuildingsLayer(mapInstance);
      };
      ensureAddressLayer = async () => {
        if (isRasterFallback || !HAS_ADDRESS_VECTOR_SOURCE) {
          return;
        }
        if (!ADDRESS_VECTOR_SOURCE_URL) {
          console.warn(
            'Адресные плитки не подключены: отсутствует URL источника (VITE_MAP_ADDRESSES_PMTILES_URL).',
          );
          return;
        }
        if (mapInstance.getSource(ADDRESS_SOURCE_ID)) {
          return;
        }
        const requiresPmtiles =
          ADDRESS_VECTOR_SOURCE_URL.startsWith('pmtiles://') ||
          ADDRESS_VECTOR_SOURCE_URL.endsWith('.pmtiles');
        if (requiresPmtiles) {
          const registered = await registerPmtilesProtocol();
          if (!registered) {
            console.warn(
              'Адресные плитки не подключены: протокол pmtiles недоступен, источник будет пропущен.',
            );
            return;
          }
        }
        const availableVectorSourceId = findFirstVectorSourceId(mapInstance);
        if (!availableVectorSourceId) {
          console.warn(
            'Не удалось найти векторные источники стиля — адресные подписи будут пропущены.',
          );
          return;
        }
        mapInstance.addSource(ADDRESS_SOURCE_ID, {
          type: 'vector',
          url: ADDRESS_VECTOR_SOURCE_URL,
        });
        const addressLayer: SymbolLayerSpecification = {
          id: ADDRESS_LAYER_ID,
          type: 'symbol',
          source: ADDRESS_SOURCE_ID,
          'source-layer': ADDRESS_VECTOR_SOURCE_LAYER,
          minzoom: 17,
          layout: {
            'text-field': ['get', 'housenumber'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 13,
            'text-letter-spacing': 0.02,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
            'text-padding': 2,
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#f8fafc',
            'text-halo-width': 1.2,
            'text-halo-blur': 0.6,
          },
        };
        const beforeLayerId = findExistingLayerId(
          mapInstance,
          MAJOR_LABEL_LAYER_CANDIDATES,
        );
        mapInstance.addLayer(addressLayer, beforeLayerId);
        ensureAddressesLayerOrder(mapInstance);
      };
      handleLoad = () => {
        ensureBuildingsLayer?.();
        void ensureAddressLayer?.();
        mapInstance.addSource(GEO_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        mapInstance.addLayer({
          id: GEO_FILL_LAYER_ID,
          type: 'fill',
          source: GEO_SOURCE_ID,
          paint: {
            'fill-color': [
              'case',
              ['boolean', ['get', 'active'], false],
              'rgba(37, 99, 235, 0.35)',
              'rgba(148, 163, 184, 0.2)',
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['get', 'active'], false],
              0.4,
              0.2,
            ],
          },
        });
        mapInstance.addLayer({
          id: GEO_OUTLINE_LAYER_ID,
          type: 'line',
          source: GEO_SOURCE_ID,
          paint: {
            'line-color': [
              'case',
              ['boolean', ['get', 'active'], false],
              '#2563eb',
              '#94a3b8',
            ],
            'line-width': [
              'case',
              ['boolean', ['get', 'active'], false],
              2.5,
              1.5,
            ],
          },
        });
        mapInstance.addSource(OPT_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const optimizedLayer: LineLayerSpecification = {
          id: OPT_LAYER_ID,
          type: 'line',
          source: OPT_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-dasharray': [1.5, 1.5],
            'line-opacity': 0.8,
          },
        };
        mapInstance.addLayer(optimizedLayer);
        mapInstance.addSource(TASK_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const taskLineLayer: LineLayerSpecification = {
          id: TASK_LAYER_ID,
          type: 'line',
          source: TASK_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 3,
            'line-opacity': 0.85,
          },
        };
        mapInstance.addLayer(taskLineLayer);
        mapInstance.addSource(TASK_CLUSTER_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
          cluster: true,
          clusterRadius: 60,
          clusterMaxZoom: 14,
          clusterProperties: {
            draft: CLUSTER_STATUS_PROPERTIES.draft,
            approved: CLUSTER_STATUS_PROPERTIES.approved,
            completed: CLUSTER_STATUS_PROPERTIES.completed,
            unassigned: CLUSTER_STATUS_PROPERTIES.unassigned,
          },
        });
        const clusterLayer: CircleLayerSpecification = {
          id: TASK_CLUSTER_LAYER_ID,
          type: 'circle',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': [
              'case',
              [
                'all',
                ['>=', ['get', 'completed'], ['get', 'approved']],
                ['>=', ['get', 'completed'], ['get', 'draft']],
                ['>=', ['get', 'completed'], ['get', 'unassigned']],
              ],
              ROUTE_STATUS_COLORS.completed,
              [
                'all',
                ['>=', ['get', 'approved'], ['get', 'draft']],
                ['>=', ['get', 'approved'], ['get', 'unassigned']],
              ],
              ROUTE_STATUS_COLORS.approved,
              ['>=', ['get', 'draft'], ['get', 'unassigned']],
              ROUTE_STATUS_COLORS.draft,
              ROUTE_STATUS_COLORS.unassigned,
            ],
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              8,
              16,
              12,
              22,
              14,
              30,
            ],
            'circle-opacity': 0.82,
            'circle-stroke-width': 1.6,
            'circle-stroke-color': '#f8fafc',
          },
        };
        mapInstance.addLayer(clusterLayer);
        const clusterCountLayer: SymbolLayerSpecification = {
          id: TASK_CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': ['get', 'point_count_abbreviated'],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1.2,
          },
        };
        mapInstance.addLayer(clusterCountLayer);
        const pointsLayer: SymbolLayerSpecification = {
          id: TASK_POINTS_LAYER_ID,
          type: 'symbol',
          source: TASK_CLUSTER_SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          layout: {
            'icon-image': ['get', 'iconId'],
            'icon-size': [
              'case',
              ['boolean', ['get', 'selected'], false],
              0.8,
              0.65,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'text-field': ['coalesce', ['get', 'label'], ''],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: {
            'icon-opacity': 0.95,
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 0.9,
          },
        };
        mapInstance.addLayer(pointsLayer);
        mapInstance.addSource(TASK_ANIMATION_SOURCE_ID, {
          type: 'geojson',
          data: createEmptyCollection(),
        });
        const animationLayer: SymbolLayerSpecification = {
          id: TASK_ANIMATION_LAYER_ID,
          type: 'symbol',
          source: TASK_ANIMATION_SOURCE_ID,
          layout: {
            'text-field': ['get', 'icon'],
            'text-size': 20,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
            'text-rotate': ['get', 'bearing'],
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': 'rgba(17, 24, 39, 0.55)',
            'text-halo-width': 1.2,
          },
        };
        mapInstance.addLayer(animationLayer);
        setMapReady(true);
      };
      mapInstance.on('styledata', ensureBuildingsLayer);
      mapInstance.on('load', handleLoad);
    };

    void initMap();

    return () => {
      cancelled = true;
      detachStyleFallback();
      if (map && typeof map.off === 'function') {
        if (ensureBuildingsLayer) {
          map.off('styledata', ensureBuildingsLayer);
        }
        if (handleLoad) {
          map.off('load', handleLoad);
        }
      }
      setMapReady(false);
      setIsDrawing(false);
      drawRef.current = null;
      stopRouteAnimation();
      if (map) {
        map.remove();
      }
      mapRef.current = null;
    };
  }, [stopRouteAnimation]);

  const persistMapState = React.useCallback(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const center = typeof map.getCenter === 'function' ? map.getCenter() : null;
    if (!center || Number.isNaN(center.lng) || Number.isNaN(center.lat)) {
      return;
    }
    const zoom =
      typeof map.getZoom === 'function' ? map.getZoom() : MAP_DEFAULT_ZOOM;
    const pitch = typeof map.getPitch === 'function' ? map.getPitch() : 0;
    const bearing = typeof map.getBearing === 'function' ? map.getBearing() : 0;
    saveMapState({
      center: [center.lng, center.lat],
      zoom,
      pitch,
      bearing,
      viewMode: mapViewMode,
    });
  }, [mapReady, mapViewMode]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map || typeof map.on !== 'function' || typeof map.off !== 'function') {
      return;
    }
    const events: Array<[string, Listener]> = [
      ['moveend', persistMapState],
      ['zoomend', persistMapState],
      ['rotateend', persistMapState],
      ['pitchend', persistMapState],
    ];
    events.forEach(([event, handler]) => map.on(event, handler));
    return () => {
      events.forEach(([event, handler]) => map.off(event, handler));
    };
  }, [mapReady, persistMapState]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const persistedMapState = persistedMapStateRef.current;
    const shouldUsePersisted =
      !initialMapStateAppliedRef.current &&
      persistedMapState &&
      persistedMapState.viewMode === mapViewMode;
    const targetPitch =
      shouldUsePersisted && persistedMapState
        ? persistedMapState.pitch
        : mapViewMode === 'perspective'
          ? 55
          : 0;
    const targetBearing =
      shouldUsePersisted && persistedMapState
        ? persistedMapState.bearing
        : mapViewMode === 'perspective'
          ? 28
          : 0;
    initialMapStateAppliedRef.current = true;
    const enableRotation = () => {
      if (typeof map.dragRotate?.enable === 'function') {
        map.dragRotate.enable();
      }
      if (typeof map.touchZoomRotate?.enableRotation === 'function') {
        map.touchZoomRotate.enableRotation();
      }
    };
    const disableRotation = () => {
      if (typeof map.dragRotate?.disable === 'function') {
        map.dragRotate.disable();
      }
      if (typeof map.touchZoomRotate?.disableRotation === 'function') {
        map.touchZoomRotate.disableRotation();
      }
    };
    if (mapViewMode === 'perspective') {
      enableRotation();
      if (typeof map.easeTo === 'function') {
        map.easeTo({
          pitch: targetPitch,
          bearing: targetBearing,
          duration: 600,
        });
      } else {
        map.setPitch(targetPitch);
        map.setBearing(targetBearing);
      }
    } else {
      if (typeof map.easeTo === 'function') {
        map.easeTo({
          pitch: targetPitch,
          bearing: targetBearing,
          duration: 400,
        });
      } else {
        map.setPitch(targetPitch);
        map.setBearing(targetBearing);
      }
      disableRotation();
    }
  }, [mapReady, mapViewMode]);

  React.useEffect(() => {
    if (!mapReady) return;
    persistMapState();
  }, [mapReady, mapViewMode, persistMapState]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;
    const createdZones: GeoZone[] = [];
    const updatedZones = new Map<string, GeoZoneFeature>();

    const handleCreate: Listener = (event) => {
      const { features = [] } = event as DrawFeatureEvent;
      createdZones.length = 0;
      setGeoZones((prev) => {
        const base = [...prev];
        const baseLength = prev.length;
        const now = new Date().toISOString();
        for (const feature of features) {
          if (!feature || !isPolygonGeometry(feature.geometry)) continue;
          const drawId =
            typeof feature.id === 'string'
              ? feature.id
              : feature.id != null
                ? String(feature.id)
                : `draw-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const zoneId =
            typeof crypto !== 'undefined' &&
            typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `zone-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const name = tRef.current('logistics.geozoneDefaultName', {
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

    const handleDelete: Listener = (event) => {
      const { features = [] } = event as DrawFeatureEvent;
      const removedDrawIds = new Set<string>();
      for (const feature of features) {
        if (!feature) continue;
        const drawId =
          typeof feature.id === 'string'
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : '';
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
        setActiveGeoZoneIds((prev) =>
          prev.filter((id) => !removedZoneIds.includes(id)),
        );
      }
    };

    const handleUpdate: Listener = (event) => {
      const { features = [] } = event as DrawFeatureEvent;
      updatedZones.clear();
      for (const feature of features) {
        if (!feature || !isPolygonGeometry(feature.geometry)) continue;
        const drawId =
          typeof feature.id === 'string'
            ? feature.id
            : feature.id != null
              ? String(feature.id)
              : '';
        if (!drawId) continue;
        updatedZones.set(drawId, {
          type: 'Feature',
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

    const handleModeChange: Listener = (event) => {
      const { mode } = event as DrawModeChangeEvent;
      setIsDrawing(mode === 'draw_polygon');
    };

    map.on('draw.create', handleCreate);
    map.on('draw.delete', handleDelete);
    map.on('draw.update', handleUpdate);
    map.on('draw.modechange', handleModeChange);

    return () => {
      map.off('draw.create', handleCreate);
      map.off('draw.delete', handleDelete);
      map.off('draw.update', handleUpdate);
      map.off('draw.modechange', handleModeChange);
    };
  }, [activeGeoZoneIds, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const draw = drawRef.current;
    if (!draw) return;
    if (!geoZonesEnabled) {
      draw.changeMode('simple_select');
    }
  }, [geoZonesEnabled, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(GEO_SOURCE_ID) as GeoJSONSource | undefined;
    if (!source) return;
    const features = geoZonesEnabled
      ? geoZones.map((zone) => ({
          ...zone.feature,
          id: zone.drawId,
          properties: {
            ...(zone.feature.properties ?? {}),
            zoneId: zone.id,
            name: zone.name,
            active: activeGeoZoneIds.includes(zone.id),
          },
        }))
      : [];
    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [activeGeoZoneIds, geoZones, geoZonesEnabled, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const routesSource = map.getSource(TASK_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    const animationSource = map.getSource(TASK_ANIMATION_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!routesSource || !animationSource) {
      return;
    }
    if (!layerVisibility.tasks || !sorted.length) {
      routesSource.setData(createEmptyCollection());
      animationSource.setData(createEmptyCollection());
      routeAnimationRef.current.routes = [];
      stopRouteAnimation();
      return;
    }
    let cancelled = false;
    (async () => {
      const lineFeatures: GeoJSON.Feature<GeoJSON.LineString>[] = [];
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
          typeof task.status === 'string' ? task.status.trim() : '';
        const routeColor = TASK_STATUS_COLORS[statusKey] ?? '#2563eb';
        const coordinates = geometry as GeoJSON.Position[];
        lineFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates,
          },
          properties: {
            color: routeColor,
            taskId: task._id,
            title: task.title ?? task._id,
          },
        });
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
        type: 'FeatureCollection',
        features: lineFeatures,
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
    const colors = ['#ef4444', '#22c55e', '#f97316'];
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
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          color: colors[idx % colors.length],
          routeId: route.id,
        },
      });
    });
    setOptimizedRoutesGeoJSON({
      type: 'FeatureCollection',
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
      map.setLayoutProperty(
        layerId,
        'visibility',
        visible ? 'visible' : 'none',
      );
    };
    setVisibility(TASK_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_CLUSTER_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_CLUSTER_COUNT_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_POINTS_LAYER_ID, layerVisibility.tasks);
    setVisibility(TASK_ANIMATION_LAYER_ID, layerVisibility.tasks);
    setVisibility(OPT_LAYER_ID, layerVisibility.optimized);
  }, [layerVisibility.optimized, layerVisibility.tasks, mapReady]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource(TASK_CLUSTER_SOURCE_ID) as
      | GeoJSONSource
      | undefined;
    if (!source) return;
    const handlePointClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const entity = feature.properties?.entity;
      if (entity === 'vehicle') {
        const vehicleId = feature.properties?.vehicleId;
        if (typeof vehicleId === 'string' && vehicleId) {
          toggleSelectedVehicleId(vehicleId);
        }
        return;
      }
      const taskId = feature.properties?.taskId;
      if (typeof taskId === 'string' && taskId) {
        openTask(taskId);
      }
    };
    const handlePointClickListener: Listener = (event) =>
      handlePointClick(event as MapLayerMouseEvent);
    const handleClusterClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const clusterId = feature.properties?.cluster_id;
      if (typeof clusterId !== 'number') {
        return;
      }
      const coordinates =
        feature.geometry && feature.geometry.type === 'Point'
          ? (feature.geometry.coordinates as GeoJSON.Position)
          : null;
      source.getClusterExpansionZoom(
        clusterId,
        (error: Error | null, zoom: number) => {
          if (!error && typeof zoom === 'number' && coordinates) {
            map.easeTo({ center: coordinates, zoom, duration: 600 });
          }
        },
      );
      const total =
        typeof feature.properties?.point_count === 'number'
          ? (feature.properties.point_count as number)
          : 0;
      const limit = Math.min(Math.max(total, 1), 50);
      const collected = new Set<string>();
      const gatherLeaves = (offset: number) => {
        source.getClusterLeaves(
          clusterId,
          limit,
          offset,
          (
            err: Error | null,
            features: GeoJSON.Feature<
              GeoJSON.Geometry,
              GeoJSON.GeoJsonProperties
            >[],
          ) => {
            if (err || !features) {
              return;
            }
            features.forEach((item) => {
              if (item.properties?.entity === 'task') {
                const taskId = item.properties?.taskId;
                if (typeof taskId === 'string' && taskId) {
                  collected.add(taskId);
                }
              }
            });
            if (features.length === limit && offset + features.length < total) {
              gatherLeaves(offset + features.length);
            } else {
              const ids = Array.from(collected);
              setClusterSelection(
                ids.length ? { ids, center: coordinates ?? null } : null,
              );
            }
          },
        );
      };
      gatherLeaves(0);
    };
    const handleClusterClickListener: Listener = (event) =>
      handleClusterClick(event as MapLayerMouseEvent);
    const setCursor = (cursor: string) => {
      const canvas = map.getCanvas();
      canvas.style.cursor = cursor;
    };
    const handleEnter: Listener = () => setCursor('pointer');
    const handleLeave: Listener = () => setCursor('');
    map.on('click', TASK_POINTS_LAYER_ID, handlePointClickListener);
    map.on('mouseenter', TASK_POINTS_LAYER_ID, handleEnter);
    map.on('mouseleave', TASK_POINTS_LAYER_ID, handleLeave);
    map.on('click', TASK_CLUSTER_LAYER_ID, handleClusterClickListener);
    map.on('mouseenter', TASK_CLUSTER_LAYER_ID, handleEnter);
    map.on('mouseleave', TASK_CLUSTER_LAYER_ID, handleLeave);
    return () => {
      map.off('click', TASK_POINTS_LAYER_ID, handlePointClickListener);
      map.off('mouseenter', TASK_POINTS_LAYER_ID, handleEnter);
      map.off('mouseleave', TASK_POINTS_LAYER_ID, handleLeave);
      map.off('click', TASK_CLUSTER_LAYER_ID, handleClusterClickListener);
      map.off('mouseenter', TASK_CLUSTER_LAYER_ID, handleEnter);
      map.off('mouseleave', TASK_CLUSTER_LAYER_ID, handleLeave);
    };
  }, [mapReady, openTask, toggleSelectedVehicleId]);

  React.useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map) return;
    if (typeof map.resize === 'function') {
      map.resize();
    }
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }
    let frameId: number | null = null;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || typeof map.resize !== 'function') {
        return;
      }
      const { width, height } = entry.contentRect;
      if (width <= 0 || height <= 0) {
        return;
      }
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      frameId = requestAnimationFrame(() => {
        map.resize();
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [hasDialog, mapReady]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold">{t('logistics.title')}</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('logistics.pageLead', {
              defaultValue:
                'Планируйте маршруты, управляйте автопарком и отслеживайте задачи на одной карте.',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={refreshAll}
          >
            {t('refresh')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleReloadPlan}
            disabled={planLoading}
          >
            {planLoading ? t('loading') : t('logistics.planReload')}
          </Button>
        </div>
      </header>
      {shouldShowMapFallbackNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {t('logistics.mapFallbackWarning', {
            defaultValue:
              'Карта использует временные растровые тайлы OpenStreetMap. Подключите локальные PMTiles в public/tiles, чтобы активировать детализированный стиль.',
          })}
        </div>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <CollapsibleCard
            title={t('logistics.planSectionTitle')}
            description={t('logistics.planSummary')}
            actions={
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold uppercase text-muted-foreground">
                  {t('logistics.planStatus')}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {planStatusLabel}
                </span>
                {planLoading ? (
                  <span className="text-xs text-muted-foreground">
                    {t('loading')}
                  </span>
                ) : null}
              </div>
            }
            toggleLabels={collapseToggleLabels}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleReloadPlan}
                disabled={planLoading}
              >
                {planLoading ? t('loading') : t('logistics.planReload')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleClearPlan}
                disabled={planLoading}
              >
                {t('logistics.planClear')}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSavePlan}
                disabled={!planDraft || !isPlanEditable || planLoading}
              >
                {t('save')}
              </Button>
              {planDraft?.status === 'draft' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  onClick={handleApprovePlan}
                  disabled={planLoading}
                >
                  {t('logistics.planApprove')}
                </Button>
              ) : null}
              {planDraft?.status === 'approved' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  onClick={handleCompletePlan}
                  disabled={planLoading}
                >
                  {t('logistics.planComplete')}
                </Button>
              ) : null}
            </div>
            {planDraft ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">
                      {t('logistics.planTitleLabel')}
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
                      {t('logistics.planNotesLabel')}
                    </span>
                    <textarea
                      value={planDraft.notes ?? ''}
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
                    {t('logistics.planSummary')}
                  </h4>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">
                        {t('logistics.planTotalDistance')}
                      </div>
                      <div className="font-semibold">
                        {formatDistance(
                          planDraft.metrics?.totalDistanceKm ?? null,
                        )}
                      </div>
                    </div>
                    <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">
                        {t('logistics.planTotalRoutes')}
                      </div>
                      <div className="font-semibold">{planTotalRoutes}</div>
                    </div>
                    <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">
                        {t('logistics.planTotalTasks')}
                      </div>
                      <div className="font-semibold">{planTotalTasks}</div>
                    </div>
                    <div className="rounded border bg-white/70 px-3 py-2 text-sm shadow-sm">
                      <div className="text-xs uppercase text-muted-foreground">
                        {t('logistics.planTotalStops')}
                      </div>
                      <div className="font-semibold">{totalStops}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {planRoutes.map((route, routeIndex) => {
                    const displayIndex =
                      typeof route.order === 'number' &&
                      Number.isFinite(route.order)
                        ? route.order + 1
                        : routeIndex + 1;
                    const routeStops =
                      route.metrics?.stops ?? route.stops.length;
                    return (
                      <div
                        key={route.id || `${routeIndex}`}
                        className="space-y-3 rounded border bg-white/70 px-3 py-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <h4 className="text-base font-semibold">
                              {t('logistics.planRouteTitle', {
                                index: displayIndex,
                              })}
                            </h4>
                            <div className="text-xs text-muted-foreground">
                              {t('logistics.planRouteSummary', {
                                tasks: route.tasks.length,
                                stops: routeStops,
                              })}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('logistics.planRouteDistance', {
                              distance: formatDistance(
                                route.metrics?.distanceKm ?? null,
                              ),
                            })}
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium">
                              {t('logistics.planDriver')}
                            </span>
                            <Input
                              value={route.driverName ?? ''}
                              onChange={(event) =>
                                handleDriverNameChange(
                                  routeIndex,
                                  event.target.value,
                                )
                              }
                              disabled={!isPlanEditable || planLoading}
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-sm">
                            <span className="font-medium">
                              {t('logistics.planVehicle')}
                            </span>
                            <Input
                              value={route.vehicleName ?? ''}
                              onChange={(event) =>
                                handleVehicleNameChange(
                                  routeIndex,
                                  event.target.value,
                                )
                              }
                              disabled={!isPlanEditable || planLoading}
                            />
                          </label>
                          <label className="md:col-span-2 flex flex-col gap-1 text-sm">
                            <span className="font-medium">
                              {t('logistics.planRouteNotes')}
                            </span>
                            <textarea
                              value={route.notes ?? ''}
                              onChange={(event) =>
                                handleRouteNotesChange(
                                  routeIndex,
                                  event.target.value,
                                )
                              }
                              className="min-h-[80px] rounded border px-3 py-2 text-sm"
                              disabled={!isPlanEditable || planLoading}
                            />
                          </label>
                        </div>
                        <div className="space-y-2">
                          <h5 className="text-sm font-semibold uppercase text-muted-foreground">
                            {t('logistics.planTasksTitle')}
                          </h5>
                          <ul className="space-y-2">
                            {route.tasks.length ? (
                              route.tasks.map((taskRef, taskIndex) => {
                                const task = displayedTasks.find(
                                  (item) => item._id === taskRef.taskId,
                                );
                                if (!task) {
                                  return null;
                                }
                                return (
                                  <li
                                    key={`${route.id}-${taskRef.taskId}-${taskIndex}`}
                                    className="rounded border bg-white/60 px-3 py-2 text-sm shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                      <div>
                                        <button
                                          type="button"
                                          className="text-left font-medium text-accentPrimary hover:underline"
                                          onClick={() => openTask(task)}
                                        >
                                          {task.title || task._id}
                                        </button>
                                        <div className="text-xs text-muted-foreground">
                                          {task.address ||
                                            t('logistics.planRouteNoAddress')}
                                        </div>
                                      </div>
                                      <div className="flex gap-1">
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          onClick={() =>
                                            handleMoveTask(
                                              routeIndex,
                                              taskIndex,
                                              -1,
                                            )
                                          }
                                          disabled={taskIndex === 0}
                                        >
                                          {t('logistics.planTaskUp')}
                                        </Button>
                                        <Button
                                          type="button"
                                          size="xs"
                                          variant="outline"
                                          onClick={() =>
                                            handleMoveTask(
                                              routeIndex,
                                              taskIndex,
                                              1,
                                            )
                                          }
                                          disabled={
                                            taskIndex === route.tasks.length - 1
                                          }
                                        >
                                          {t('logistics.planTaskDown')}
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                      <span>
                                        {t('logistics.planRouteDistance', {
                                          distance: formatDistance(
                                            taskRef.distanceKm ?? null,
                                          ),
                                        })}
                                      </span>
                                      <span>
                                        {t('logistics.planRouteDuration', {
                                          duration: formatDuration(
                                            taskRef.durationMinutes ?? null,
                                          ),
                                        })}
                                      </span>
                                    </div>
                                  </li>
                                );
                              })
                            ) : (
                              <li className="rounded border border-dashed bg-white/60 px-3 py-2 text-sm text-muted-foreground">
                                {t('logistics.planRouteEmpty')}
                              </li>
                            )}
                          </ul>
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
                  ? t('loading')
                  : planMessage || t('logistics.planEmpty')}
              </div>
            )}
          </CollapsibleCard>
          <div className="flex flex-wrap gap-2 sm:hidden">
            <Button
              type="button"
              size="sm"
              variant={mobileView === 'map' ? 'default' : 'outline'}
              onClick={() => setMobileView('map')}
              aria-pressed={mobileView === 'map'}
            >
              {t('logistics.mapMobileTab', { defaultValue: 'Карта' })}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mobileView === 'list' ? 'default' : 'outline'}
              onClick={() => setMobileView('list')}
              aria-pressed={mobileView === 'list'}
            >
              {t('logistics.listMobileTab', { defaultValue: 'Список' })}
            </Button>
          </div>
          <section
            data-testid="logistics-map-panel"
            className={`space-y-4 rounded-lg border bg-white/90 p-4 shadow-sm ${mobileView === 'map' ? '' : 'hidden sm:block'}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">
                  {t('logistics.mapPanelTitle', {
                    defaultValue: 'Карта маршрутов',
                  })}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('logistics.mapPanelSummary', {
                    defaultValue:
                      'Включайте нужные слои, выбирайте алгоритм и запускайте оптимизацию прямо на карте.',
                  })}
                </p>
              </div>
            </div>
            <div
              ref={mapContainerRef}
              id="logistics-map"
              className={`relative block w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner min-h-[260px] sm:min-h-[340px] lg:min-h-[440px] h-[46vh] sm:h-[56vh] lg:h-[64vh] xl:h-[72vh]`}
            >
              {hasDialog ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-auto absolute inset-0 z-10 bg-white/70 backdrop-blur-sm"
                />
              ) : null}
            </div>
            <details className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm">
              <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
                {t('logistics.mapControlsTitle', {
                  defaultValue: 'Настройки карты',
                })}
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                  <label className="inline-flex items-center gap-2">
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
                    <span>{t('logistics.layerTasks')}</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
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
                    <span>{t('logistics.layerOptimization')}</span>
                  </label>
                </div>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {t('logistics.vehicleCountLabel')}
                      </span>
                      <select
                        value={vehicles}
                        onChange={(event) =>
                          setVehicles(Number(event.target.value))
                        }
                        className="h-8 rounded border px-2 text-sm"
                        aria-label={t('logistics.vehicleCountAria')}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {t('logistics.optimizeMethodLabel')}
                      </span>
                      <select
                        value={method}
                        onChange={(event) => setMethod(event.target.value)}
                        className="h-8 rounded border px-2 text-sm"
                        aria-label={t('logistics.optimizeMethodAria')}
                      >
                        <option value="angle">angle</option>
                        <option value="trip">trip</option>
                      </select>
                    </label>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 sm:justify-start">
                    <Button type="button" size="sm" onClick={calculate}>
                      {t('logistics.optimize')}
                    </Button>
                    <Button type="button" size="sm" onClick={reset}>
                      {t('reset')}
                    </Button>
                    <Button type="button" size="sm" onClick={refreshAll}>
                      {t('refresh')}
                    </Button>
                  </div>
                </div>
              </div>
            </details>
            {clusterSelection?.ids.length ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-xs text-slate-600">
                <span>
                  {t('logistics.clusterSelectionSummary', {
                    count: clusterSelection.ids.length,
                    defaultValue: `В кластере задач: ${clusterSelection.ids.length}`,
                  })}
                </span>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={handleClearClusterSelection}
                >
                  {t('clear')}
                </Button>
              </div>
            ) : null}
          </section>
          <div
            className={mobileView === 'list' ? '' : 'hidden sm:block'}
            data-testid="logistics-tasks-card"
          >
            <CollapsibleCard
              title={t('logistics.tasksHeading')}
              description={t('logistics.tasksActiveOnly', {
                defaultValue:
                  'Показываются только активные задачи без завершённых и отменённых статусов.',
              })}
              toggleLabels={collapseToggleLabels}
            >
              <TaskTable
                tasks={displayedTasks}
                onDataChange={(rows) => setSorted(rows as RouteTask[])}
                onRowClick={openTask}
                page={page}
                pageCount={Math.max(1, Math.ceil(displayedTasks.length / 25))}
                onPageChange={setPage}
              />
            </CollapsibleCard>
          </div>
        </div>
        <aside className="space-y-4">
          {role === 'admin' ? (
            <CollapsibleCard
              title={t('logistics.transport')}
              description={t('logistics.transportHint', {
                defaultValue: 'Автопарк с координатами транспорта и пробегом.',
              })}
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={refreshFleet}
                  disabled={vehiclesLoading}
                >
                  {vehiclesLoading
                    ? t('loading')
                    : t('logistics.refreshFleet', {
                        defaultValue: 'Обновить автопарк',
                      })}
                </Button>
              }
              defaultOpen={availableVehicles.length > 0}
              toggleLabels={collapseToggleLabels}
            >
              {fleetError ? (
                <div className="text-sm text-red-600">{fleetError}</div>
              ) : null}
              {vehiclesHint && !availableVehicles.length ? (
                <div className="text-sm text-muted-foreground">
                  {vehiclesHint}
                </div>
              ) : null}
              {availableVehicles.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-y-1 text-xs sm:text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="rounded-l-md bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                          {t('logistics.vehicleColumnName', {
                            defaultValue: 'Транспорт',
                          })}
                        </th>
                        <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                          {t('logistics.vehicleColumnPlate', {
                            defaultValue: 'Госномер',
                          })}
                        </th>
                        <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                          {t('logistics.vehicleColumnType', {
                            defaultValue: 'Тип',
                          })}
                        </th>
                        <th className="bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                          {t('logistics.vehicleColumnTasks', {
                            defaultValue: 'Задачи',
                          })}
                        </th>
                        <th className="rounded-r-md bg-slate-50 px-3 py-2 font-medium uppercase tracking-wide text-[0.7rem] dark:bg-slate-800/70">
                          {t('logistics.vehicleColumnMileage', {
                            defaultValue: 'Пробег',
                          })}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {availableVehicles.map((vehicle) => {
                        const isSelected = selectedVehicleId === vehicle.id;
                        const tasksCount = Array.isArray(vehicle.currentTasks)
                          ? vehicle.currentTasks.length
                          : null;
                        const mileageValue =
                          typeof vehicle.odometerCurrent === 'number' &&
                          Number.isFinite(vehicle.odometerCurrent)
                            ? vehicle.odometerCurrent
                            : null;
                        return (
                          <tr
                            key={vehicle.id}
                            onClick={() => toggleSelectedVehicleId(vehicle.id)}
                            className={`bg-white/80 text-sm shadow-sm transition dark:bg-slate-900/60 ${
                              isSelected
                                ? 'cursor-pointer ring-2 ring-sky-500'
                                : 'cursor-pointer hover:bg-slate-100/80'
                            }`}
                            data-state={isSelected ? 'selected' : undefined}
                            aria-selected={isSelected}
                          >
                            <td className="rounded-l-md px-3 py-2 font-medium">
                              {vehicle.name ||
                                t('logistics.unselectedVehicle', {
                                  defaultValue: 'Не выбран',
                                })}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {vehicle.registrationNumber ||
                                t('logistics.assignDialogUnknown', {
                                  defaultValue: 'нет данных',
                                })}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {vehicle.transportType ||
                                t('logistics.assignDialogUnknown', {
                                  defaultValue: 'нет данных',
                                })}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {typeof tasksCount === 'number'
                                ? t('logistics.vehicleTasksShort', {
                                    count: tasksCount,
                                    defaultValue: `${tasksCount}`,
                                  })
                                : t('logistics.assignDialogUnknown', {
                                    defaultValue: 'нет данных',
                                  })}
                            </td>
                            <td className="rounded-r-md px-3 py-2 text-xs text-muted-foreground">
                              {mileageValue !== null
                                ? t('logistics.vehicleMileageShort', {
                                    value: mileageValue,
                                    defaultValue: `${mileageValue} км`,
                                  })
                                : t('logistics.assignDialogUnknown', {
                                    defaultValue: 'нет данных',
                                  })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {selectedVehicle ? (
                <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-700">
                  {t('logistics.selectedVehicle', {
                    name:
                      selectedVehicle.name ||
                      t('logistics.unselectedVehicle', {
                        defaultValue: 'Не выбран',
                      }),
                  })}
                </div>
              ) : null}
            </CollapsibleCard>
          ) : fleetError ? (
            <p className="rounded-lg border border-dashed bg-white/40 p-3 text-xs text-muted-foreground">
              {fleetError}
            </p>
          ) : null}
          <CollapsibleCard
            title={t('logistics.geozonesTitle')}
            description={t('logistics.geozonesDescription', {
              defaultValue:
                'Геозоны ограничивают задачи выбранными районами. Отключите, если нужно видеть все адреса.',
            })}
            actions={
              <label className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={geoZonesEnabled}
                  onChange={(event) => setGeoZonesEnabled(event.target.checked)}
                />
                <span>
                  {t('logistics.geozonesToggleLabel', {
                    defaultValue: 'Геозоны',
                  })}
                </span>
              </label>
            }
            defaultOpen={geoZonesEnabled}
            toggleLabels={collapseToggleLabels}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={handleStartDrawing}
                disabled={!mapReady || !geoZonesEnabled}
              >
                {isDrawing
                  ? t('logistics.geozonesDrawing')
                  : t('logistics.geozonesDraw')}
              </Button>
              {!geoZonesEnabled ? (
                <span className="text-xs text-muted-foreground">
                  {t('logistics.geozonesDisabled', {
                    defaultValue: 'Фильтрация по зонам выключена.',
                  })}
                </span>
              ) : null}
            </div>
            {geoZonesEnabled ? (
              <>
                <p className="text-xs text-muted-foreground">
                  {t('logistics.geozonesHint')}
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
                                disabled={!geoZonesEnabled}
                                onChange={(event) =>
                                  handleToggleZone(
                                    zone.id,
                                    event.target.checked,
                                  )
                                }
                              />
                              <span className="font-medium">
                                {zone.name ||
                                  t('logistics.geozoneDefaultName', {
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
                              {t('logistics.geozoneRemove')}
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isActive
                              ? t('logistics.geozoneStatusActive')
                              : t('logistics.geozoneStatusInactive')}
                          </div>
                          <div className="flex flex-wrap gap-2 text-[0.7rem] text-muted-foreground">
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">
                              {t('logistics.geozoneArea', {
                                value: formatAreaMetric(zone.metrics?.areaKm2),
                              })}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">
                              {t('logistics.geozonePerimeter', {
                                value: formatPerimeterMetric(
                                  zone.metrics?.perimeterKm,
                                ),
                              })}
                            </span>
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1">
                              {t('logistics.geozoneBuffer', {
                                value: formatBufferMetric(
                                  zone.metrics?.bufferMeters,
                                ),
                              })}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('logistics.geozonesEmpty')}
                  </p>
                )}
              </>
            ) : (
              <p className="rounded border border-dashed px-3 py-2 text-xs text-muted-foreground">
                {t('logistics.geozonesDisabledHint', {
                  defaultValue:
                    'Включите переключатель выше, чтобы снова показывать зоны.',
                })}
              </p>
            )}
          </CollapsibleCard>
          <CollapsibleCard
            title={t('logistics.layersTitle')}
            description={t('logistics.layersSummary', {
              defaultValue:
                'Настройте легенду карты по статусам, транспорту и типам задач.',
            })}
            toggleLabels={collapseToggleLabels}
          >
            <div className="space-y-3 border-t border-dashed border-slate-200 pt-3 text-sm">
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t('logistics.layerRouteStatuses', {
                    defaultValue: 'Статусы маршрутов',
                  })}
                </legend>
                <ul className="space-y-1">
                  {routeStatusEntries.map(({ key, count, color }) => {
                    const visible = !hiddenRouteStatusesSet.has(key);
                    const label = t(`logistics.routeStatus.${key}`, {
                      defaultValue: ROUTE_STATUS_LABELS[key],
                    });
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2"
                      >
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleRouteStatusVisibilityChange(
                                key,
                                event.target.checked,
                              )
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t('logistics.legendCount', {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t('logistics.layerTransports', {
                    defaultValue: 'Типы транспорта',
                  })}
                </legend>
                <ul className="space-y-1">
                  {transportEntries.map(({ key, label, count, color }) => {
                    const visible = !hiddenTransportTypesSet.has(key);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2"
                      >
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleTransportVisibilityChange(
                                key,
                                event.target.checked,
                              )
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t('logistics.legendCount', {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-xs font-semibold uppercase text-muted-foreground">
                  {t('logistics.layerTaskTypes', {
                    defaultValue: 'Типы задач',
                  })}
                </legend>
                <ul className="space-y-1">
                  {taskTypeEntries.map(({ key, label, count, color }) => {
                    const visible = !hiddenTaskTypesSet.has(key);
                    return (
                      <li
                        key={key}
                        className="flex items-center justify-between gap-2"
                      >
                        <label className="flex flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={visible}
                            onChange={(event) =>
                              handleTaskTypeVisibilityChange(
                                key,
                                event.target.checked,
                              )
                            }
                          />
                          <span className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: color }}
                              aria-hidden="true"
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">
                          {t('logistics.legendCount', {
                            count,
                            defaultValue: `(${count})`,
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
            <div className="space-y-1 border-t border-dashed border-slate-200 pt-2">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                {t('logistics.viewModeLabel')}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="xs"
                  variant={mapViewMode === 'planar' ? 'default' : 'outline'}
                  onClick={() => setMapViewMode('planar')}
                  aria-pressed={mapViewMode === 'planar'}
                >
                  {t('logistics.viewModePlanar')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={
                    mapViewMode === 'perspective' ? 'default' : 'outline'
                  }
                  onClick={() =>
                    !isRasterFallback && setMapViewMode('perspective')
                  }
                  aria-pressed={mapViewMode === 'perspective'}
                  disabled={isRasterFallback}
                >
                  {t('logistics.viewModeTilted')}
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
                    {t('logistics.linksLabel', { index: index + 1 })}
                  </a>
                ))}
              </div>
            )}
          </CollapsibleCard>
          <CollapsibleCard
            title={t('logistics.legendTitle')}
            description={t('logistics.legendDescription', {
              defaultValue:
                'Заливка маркера соответствует типу транспорта, обводка — статусу маршрута, внутреннее кольцо — типу задачи. Размер и цвет кластера показывают преобладающую категорию.',
            })}
            toggleLabels={collapseToggleLabels}
          >
            <div className="space-y-3 text-sm">
              <ul className="flex flex-col gap-2 sm:grid sm:grid-cols-2">
                <li className="flex items-center gap-2">
                  <span
                    className="legend-symbol legend-symbol--start"
                    aria-hidden="true"
                  >
                    {TASK_START_SYMBOL}
                  </span>
                  <span>{t('logistics.legendStart')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="legend-symbol legend-symbol--finish"
                    aria-hidden="true"
                  >
                    {TASK_FINISH_SYMBOL}
                  </span>
                  <span>{t('logistics.legendFinish')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className="legend-symbol legend-symbol--movement"
                    aria-hidden="true"
                  >
                    {ANIMATION_SYMBOL}
                  </span>
                  <span>{t('logistics.legendMovement')}</span>
                </li>
              </ul>
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {t('logistics.legendStatusesHeading', {
                    defaultValue: 'Статусы задач',
                  })}
                </div>
                <ul className="space-y-2">
                  {legendItems.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="legend-color"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </span>
                      {item.count ? (
                        <span className="text-xs text-muted-foreground">
                          {t('logistics.legendCount', {
                            count: item.count,
                            defaultValue: `(${item.count})`,
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CollapsibleCard>
        </aside>
      </div>
    </div>
  );
}
