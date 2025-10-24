// Назначение: подключение к серверным событиям живого трекинга транспорта
// Основные модули: shared/TrackingEvent, EventSource API
import type { TrackingEvent } from "shared";

export interface LiveTrackingOptions {
  onEvent?: (event: TrackingEvent) => void;
  onOpen?: () => void;
  onError?: (event: Event) => void;
}

export type LiveTrackingDisconnect = () => void;

const noop: LiveTrackingDisconnect = () => undefined;

export function connectLiveTracking(
  options: LiveTrackingOptions = {},
): LiveTrackingDisconnect {
  if (typeof window === "undefined" || typeof window.EventSource !== "function") {
    return noop;
  }
  const source = new window.EventSource("/api/v1/tracking/stream", {
    withCredentials: true,
  });
  if (typeof options.onOpen === "function") {
    source.onopen = () => options.onOpen?.();
  }
  if (typeof options.onError === "function") {
    source.onerror = (event) => options.onError?.(event);
  }
  if (typeof options.onEvent === "function") {
    source.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as TrackingEvent;
        options.onEvent?.(parsed);
      } catch (error) {
        console.error("Не удалось разобрать событие трекинга", error);
      }
    };
  }
  return () => {
    source.close();
  };
}
