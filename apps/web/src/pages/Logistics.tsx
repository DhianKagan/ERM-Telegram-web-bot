// Страница отображения логистики с картой, маршрутами и фильтрами
// Основные модули: React, Leaflet, Breadcrumbs, i18next
import React from "react";
import fetchRouteGeometry from "../services/osrm";
import { fetchTasks } from "../services/tasks";
import optimizeRoute from "../services/optimizer";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "../components/Breadcrumbs";
import TaskTable from "../components/TaskTable";
import createMultiRouteLink from "../utils/createMultiRouteLink";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import useTasks from "../context/useTasks";
import { useTaskIndex } from "../controllers/taskStateController";
import { listFleetVehicles } from "../services/fleets";
import type { Coords, FleetVehicleDto } from "shared";
import type { TaskRow } from "../columns/taskColumns";

type RouteTask = TaskRow & {
  startCoordinates?: Coords;
  finishCoordinates?: Coords;
};

const TRACK_INTERVAL_MS = 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 60 * 1000;

export default function LogisticsPage() {
  const { t } = useTranslation();
  const tasks = useTaskIndex("logistics:all") as RouteTask[];
  const [sorted, setSorted] = React.useState<RouteTask[]>([]);
  const [vehicles, setVehicles] = React.useState(1);
  const [method, setMethod] = React.useState("angle");
  const [links, setLinks] = React.useState<string[]>([]);
  const mapRef = React.useRef<L.Map | null>(null);
  const optLayerRef = React.useRef<L.LayerGroup | null>(null);
  const tasksLayerRef = React.useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = React.useRef<L.LayerGroup | null>(null);
  const [availableVehicles, setAvailableVehicles] = React.useState<
    FleetVehicleDto[]
  >([]);
  const [fleetError, setFleetError] = React.useState("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState<string>("");
  const [fleetInfo, setFleetInfo] = React.useState<FleetVehicleDto | null>(null);
  const [fleetVehicles, setFleetVehicles] = React.useState<FleetVehicleDto[]>([]);
  const [vehiclesHint, setVehiclesHint] = React.useState("");
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false);
  const [autoRefresh, setAutoRefresh] = React.useState(false);
  const [withTrack, setWithTrack] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const hasDialog = params.has("task") || params.has("newTask");
  const { user } = useAuth();
  const { controller } = useTasks();
  const role = user?.role ?? null;

  React.useEffect(() => {
    const content = "/hero/logistics.png";
    let meta = document.querySelector('meta[property="og:image"]');
    if (meta) {
      meta.setAttribute("content", content);
    } else {
      meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      meta.setAttribute("content", content);
      document.head.appendChild(meta);
    }
  }, []);

  const openTask = React.useCallback(
    (id: string) => {
      const params = new URLSearchParams(location.search);
      params.set("task", id);
      navigate({ search: params.toString() }, { replace: true });
    },
    [location, navigate],
  );

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
      controller.setIndex("logistics:all", list, {
        kind: "task",
        mine: false,
        userId,
        pageSize: 0,
        total: list.length,
        sort: "desc",
      });
      setSorted(list);
    });
  }, [controller, user]);

  const loadFleetVehicles = React.useCallback(async () => {
    if (role !== "admin") return;
    setVehiclesLoading(true);
    setVehiclesHint("");
    try {
      const data = await listFleetVehicles("", 1, 100);
      setAvailableVehicles(data.items);
      setFleetError("");
      if (!data.items.length) {
        setSelectedVehicleId("");
        setVehiclesHint(t("logistics.noVehicles"));
        return;
      }
      const selected =
        selectedVehicleId &&
        data.items.find((vehicle) => vehicle.id === selectedVehicleId);
      if (!selected) {
        setSelectedVehicleId(data.items[0].id);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("logistics.loadError");
      setVehiclesHint(message);
      setAvailableVehicles([]);
      setFleetVehicles([]);
      setFleetInfo(null);
      setFleetError(message);
    } finally {
      setVehiclesLoading(false);
    }
  }, [role, selectedVehicleId, t]);

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
  }, [loadFleetVehicles, role, t]);

  const calculate = React.useCallback(() => {
    const ids = sorted.map((t) => t._id);
    optimizeRoute(ids, vehicles, method).then((r) => {
      if (!r || !mapRef.current) return;
      if (optLayerRef.current) {
        optLayerRef.current.remove();
      }
      const group = L.layerGroup().addTo(mapRef.current);
      optLayerRef.current = group;
      const colors = ["red", "green", "orange"];
      const newLinks: string[] = [];
      r.routes.forEach((route: string[], idx: number) => {
        const tasksPoints = route
          .map((id) => sorted.find((t) => t._id === id))
          .filter((task): task is RouteTask => Boolean(task));
        const points: Coords[] = tasksPoints.flatMap((task) => {
          const start = task.startCoordinates as Coords | undefined;
          const finish = task.finishCoordinates as Coords | undefined;
          return start && finish ? [start, finish] : [];
        });
        if (points.length < 2) return;
        const latlngs = points.map((point) =>
          [point.lat, point.lng] as [number, number],
        );
        L.polyline(latlngs, { color: colors[idx % colors.length] }).addTo(
          group,
        );
        newLinks.push(createMultiRouteLink(points));
      });
      setLinks(newLinks);
    });
  }, [sorted, vehicles, method]);

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
    if (role !== "admin") {
      setAvailableVehicles([]);
      setFleetError(
        role === "manager" ? t("logistics.adminOnly") : "",
      );
      setSelectedVehicleId("");
      setFleetInfo(null);
      setFleetVehicles([]);
      setVehiclesHint(role ? t("logistics.noAccess") : "");
      setAutoRefresh(false);
      setWithTrack(false);
      if (vehiclesLayerRef.current) {
        vehiclesLayerRef.current.clearLayers();
      }
      return;
    }
    setFleetError("");
    void loadFleetVehicles();
  }, [loadFleetVehicles, role]);

  React.useEffect(() => {
    if (role !== "admin") return;
    if (!selectedVehicleId) {
      setFleetInfo(null);
      setFleetVehicles([]);
      if (vehiclesLayerRef.current) {
        vehiclesLayerRef.current.clearLayers();
      }
      return;
    }
    const selected = availableVehicles.find(
      (vehicle) => vehicle.id === selectedVehicleId,
    );
    if (selected) {
      setFleetInfo(selected);
      setFleetVehicles([selected]);
    } else {
      setFleetInfo(null);
      setFleetVehicles([]);
    }
  }, [availableVehicles, role, selectedVehicleId]);

  React.useEffect(() => {
    if (role === "admin" && selectedVehicleId) return;
    setFleetInfo(null);
    setFleetVehicles([]);
    if (vehiclesLayerRef.current) {
      vehiclesLayerRef.current.clearLayers();
    }
  }, [role, selectedVehicleId]);

  React.useEffect(() => {
    if (role !== "admin" || !autoRefresh) return;
    const timer = window.setInterval(() => {
      void loadFleetVehicles();
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [autoRefresh, loadFleetVehicles, role]);

  React.useEffect(() => {
    if (hasDialog) return;
    if (mapRef.current) return;
    const map = L.map("logistics-map").setView([48.3794, 31.1656], 6);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    tasksLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    setMapReady(true);
    return () => {
      map.remove();
      if (optLayerRef.current) optLayerRef.current.remove();
      if (vehiclesLayerRef.current) {
        vehiclesLayerRef.current.remove();
        vehiclesLayerRef.current = null;
      }
      tasksLayerRef.current = null;
      mapRef.current = null;
      setMapReady(false);
    };
  }, [hasDialog]);

  React.useEffect(() => {
    const group = tasksLayerRef.current;
    if (!mapRef.current || !group || !mapReady) return;
    group.clearLayers();
    if (!sorted.length) return;
    const startIcon = L.divIcon({ className: "start-marker" });
    const finishIcon = L.divIcon({ className: "finish-marker" });
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
        L.polyline(latlngs, { color: "blue" }).addTo(group);
        const startMarker = L.marker(latlngs[0], {
          icon: startIcon,
        }).bindTooltip(
          `<a href="#" class="text-accentPrimary" data-id="${t._id}">${t.title}</a>`,
        );
        const endMarker = L.marker(latlngs[latlngs.length - 1], {
          icon: finishIcon,
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
  }, [sorted, openTask, mapReady]);

  React.useEffect(() => {
    const group = vehiclesLayerRef.current;
    if (!mapRef.current || !group || !mapReady) return;
    group.clearLayers();
    if (!fleetVehicles.length) return;
    fleetVehicles.forEach((vehicle) => {
      if (vehicle.position) {
        const updatedAt = vehicle.position.updatedAt
          ? new Date(vehicle.position.updatedAt).toLocaleString()
          : "";
        const speed =
          typeof vehicle.position.speed === "number"
            ? `${vehicle.position.speed.toFixed(1)} км/ч`
            : "";
        const tooltip = [
          '<div class="space-y-1">',
          `<div class="font-semibold">${vehicle.name}</div>`,
          updatedAt
            ? `<div class="text-xs text-muted-foreground">${updatedAt}</div>`
            : "",
          speed ? `<div class="text-xs">Скорость: ${speed}</div>` : "",
          "</div>",
        ].join("");
        L.marker([vehicle.position.lat, vehicle.position.lon], {
          title: vehicle.name,
        })
          .bindTooltip(tooltip, { direction: "top", offset: [0, -8] })
          .addTo(group);
      }
      if (withTrack && vehicle.track?.length) {
        const latlngs = vehicle.track.map(
          (point) => [point.lat, point.lon] as [number, number],
        );
        L.polyline(latlngs, {
          color: "#8b5cf6",
          weight: 3,
          opacity: 0.7,
        }).addTo(group);
      }
    });
  }, [fleetVehicles, mapReady, withTrack]);

  return (
    <div className="space-y-4">
      <Breadcrumbs
        items={[
          {
            label: t("logistics.title"),
            href:
              role === "admin"
                ? "/cp/logistics"
                : role === "manager"
                  ? "/mg/logistics"
                  : undefined,
          },
          { label: t("logistics.title") },
        ]}
      />
      <h2 className="text-xl font-semibold">{t("logistics.title")}</h2>
      {role === "admin" ? (
        <div className="space-y-2 rounded border p-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span>{t("logistics.transport")}</span>
              <select
                value={selectedVehicleId}
                onChange={(event) => setSelectedVehicleId(event.target.value)}
                className="rounded border px-2 py-1"
                disabled={!availableVehicles.length || vehiclesLoading}
              >
                <option value="">{t("logistics.unselectedVehicle")}</option>
                {availableVehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              onClick={refreshFleet}
              disabled={!availableVehicles.length || vehiclesLoading}
            >
              {vehiclesLoading
                ? t("loading")
                : t("logistics.refreshFleet")}
            </Button>
            <label
              className="flex items-center gap-1 text-sm"
              htmlFor="routes-with-track"
            >
              <input
                id="routes-with-track"
                name="withTrack"
                type="checkbox"
                className="size-4"
                checked={withTrack}
                onChange={(event) => setWithTrack(event.target.checked)}
              />
              <span>{t("logistics.trackLabel")}</span>
            </label>
            <label
              className="flex items-center gap-1 text-sm"
              htmlFor="routes-auto-refresh"
            >
              <input
                id="routes-auto-refresh"
                name="autoRefresh"
                type="checkbox"
                className="size-4"
                checked={autoRefresh}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAutoRefresh(checked);
                  if (checked) refreshFleet();
                }}
                disabled={!selectedVehicleId}
              />
              <span>{t("logistics.autoRefresh")}</span>
            </label>
          </div>
          {fleetInfo ? (
            <div className="text-sm text-muted-foreground">
              {t("logistics.selectedVehicle", { name: fleetInfo.name })}
              {fleetInfo.registrationNumber
                ? ` (${fleetInfo.registrationNumber})`
                : ""}
            </div>
          ) : null}
          {vehiclesHint ? (
            <div className="text-sm text-red-600">{vehiclesHint}</div>
          ) : null}
          {fleetError ? (
            <div className="text-sm text-red-600">{fleetError}</div>
          ) : null}
        </div>
      ) : fleetError ? (
        <p className="rounded border border-dashed p-3 text-sm text-muted-foreground">
          {fleetError}
        </p>
      ) : null}
      <div
        id="logistics-map"
        className={`h-96 w-full rounded border ${hasDialog ? "hidden" : ""}`}
      />
      <div className="flex justify-end space-x-2">
        <select
          value={vehicles}
          onChange={(e) => setVehicles(Number(e.target.value))}
          className="rounded border px-2 py-1"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="rounded border px-2 py-1"
        >
          <option value="angle">angle</option>
          <option value="trip">trip</option>
        </select>
        <Button onClick={calculate}>{t("logistics.optimize")}</Button>
        <Button onClick={reset}>{t("reset")}</Button>
        <Button onClick={refreshAll}>{t("refresh")}</Button>
      </div>
      {!!links.length && (
        <div className="flex flex-col items-end space-y-1">
          {links.map((u, i) => (
            <a
              key={i}
              href={u}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accentPrimary underline"
            >
              {t("logistics.linksLabel", { index: i + 1 })}
            </a>
          ))}
        </div>
      )}
      <div className="max-w-full space-y-2">
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
      </div>
    </div>
  );
}
