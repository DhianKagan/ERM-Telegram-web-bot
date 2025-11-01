// Назначение: подписка на серверные события логистики через EventSource.
// Основные модули: shared.

import type { LogisticsEvent } from "shared";

export type LogisticsEventListener = (event: LogisticsEvent) => void;

export function subscribeLogisticsEvents(
  listener: LogisticsEventListener,
  onError?: (event: Event) => void,
): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") {
    return () => undefined;
  }
  const url = "/api/v1/logistics/events";
  let source: EventSource | null = null;
  let closed = false;

  const buildSyntheticEvent = (type: string): Event => {
    if (typeof Event === "function") {
      return new Event(type);
    }
    return { type } as Event;
  };

  const handleMessage = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data) as LogisticsEvent;
      if (payload && typeof payload.type === "string") {
        listener(payload);
      }
    } catch (error) {
      console.error("Не удалось распарсить событие логистики", error);
    }
  };

  const handleError = (event: Event) => {
    if (onError) {
      onError(event);
    }
  };

  const attachSource = () => {
    if (closed) {
      return;
    }
    source = new EventSource(url, { withCredentials: true });
    source.addEventListener("message", handleMessage);
    source.addEventListener("error", handleError);
  };

  const probeStreamSupport = async () => {
    if (typeof fetch !== "function") {
      attachSource();
      return;
    }
    const controller = new AbortController();
    let abortedByProbe = false;
    const timeout = globalThis.setTimeout
      ? globalThis.setTimeout(() => {
          if (!controller.signal.aborted) {
            controller.abort();
          }
        }, 4000)
      : null;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "text/event-stream" },
        credentials: "include",
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") ?? "";
      const isEventStream =
        response.ok && contentType.toLowerCase().includes("text/event-stream");
      if (!controller.signal.aborted) {
        abortedByProbe = true;
        controller.abort();
      }
      if (!isEventStream) {
        console.warn(
          "Сервер логистики не вернул поток событий (text/event-stream), подписка отключена.",
        );
        if (onError) {
          onError(buildSyntheticEvent("logistics:eventstream-unavailable"));
        }
        return;
      }
      attachSource();
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === "AbortError" &&
        controller.signal.aborted &&
        !abortedByProbe
      ) {
        console.warn(
          "Проверка доступности событий логистики завершилась по таймауту.",
        );
      } else {
        console.warn("Не удалось подключиться к событиям логистики", error);
      }
      if (onError) {
        onError(buildSyntheticEvent("logistics:eventstream-error"));
      }
    } finally {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  };

  void probeStreamSupport();

  return () => {
    closed = true;
    if (source) {
      source.removeEventListener("message", handleMessage);
      source.removeEventListener("error", handleError);
      source.close();
      source = null;
    }
  };
}

export default { subscribeLogisticsEvents };
