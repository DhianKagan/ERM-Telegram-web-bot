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
  const source = new EventSource("/api/v1/logistics/events", {
    withCredentials: true,
  });

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

  source.addEventListener("message", handleMessage);
  source.addEventListener("error", handleError);

  return () => {
    source.removeEventListener("message", handleMessage);
    source.removeEventListener("error", handleError);
    source.close();
  };
}

export default { subscribeLogisticsEvents };
