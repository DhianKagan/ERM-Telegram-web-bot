// Сервис событий живого трекинга транспорта
// Основные модули: events, shared/TrackingEvent
import { EventEmitter } from 'node:events';
import type { TrackingEvent } from 'shared';

type TrackingListener = (event: TrackingEvent) => void;

const emitter = new EventEmitter();

emitter.setMaxListeners(100);

export function publishTrackingEvent(event: TrackingEvent): void {
  emitter.emit('event', event);
}

export function subscribeTrackingEvents(
  listener: TrackingListener,
): () => void {
  emitter.on('event', listener);
  return () => {
    emitter.off('event', listener);
  };
}

export function getTrackingEmitter(): EventEmitter {
  return emitter;
}
