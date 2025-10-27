// Назначение: события синхронизации геозон между страницей Logistics и TaskDialog
// Модули: geozones
import { cloneGeozoneCollection, type GeozoneFeatureCollection } from "./geozones";

export const LOGISTICS_GEOZONES_EVENT = "logistics:geozones";

export type LogisticsGeozonesEventDetail =
  | { type: "request" }
  | { type: "change"; collection: GeozoneFeatureCollection }
  | { type: "apply"; collection: GeozoneFeatureCollection };

export type LogisticsGeozonesCustomEvent = CustomEvent<LogisticsGeozonesEventDetail>;

const dispatchEventSafe = (detail: LogisticsGeozonesEventDetail) => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(LOGISTICS_GEOZONES_EVENT, { detail }));
};

export const dispatchLogisticsGeozonesRequest = () =>
  dispatchEventSafe({ type: "request" });

export const dispatchLogisticsGeozonesChange = (
  collection: GeozoneFeatureCollection,
) => dispatchEventSafe({ type: "change", collection: cloneGeozoneCollection(collection) });

export const dispatchLogisticsGeozonesApply = (
  collection: GeozoneFeatureCollection,
) => dispatchEventSafe({ type: "apply", collection: cloneGeozoneCollection(collection) });
