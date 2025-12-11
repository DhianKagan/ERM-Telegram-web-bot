// apps/web/src/lib/mapLibrary.ts
// Minimal createMap no-op для окружений без карт.
// Возвращает заглушку с безопасными методами.

type MapEventHandler = (event: unknown) => void;

interface MapStub {
  on: (eventName: string, handler?: MapEventHandler) => void;
  off: (eventName: string, handler?: MapEventHandler) => void;
  addControl: (control: unknown, position?: unknown) => void;
  addSource: (id: string, source: unknown) => void;
  addLayer: (layer: unknown, before?: string) => void;
  hasImage: (id: string) => boolean;
  addImage: (id: string, image: unknown) => void;
  isStyleLoaded: () => boolean;
  setStyle: (style: unknown, options?: unknown) => void;
  remove: () => void;
}

export async function createMap(
  container: string | HTMLElement,
  options: { center?: [number, number]; zoom?: number } = {},
): Promise<MapStub> {
  void container;
  void options;

  const stub: MapStub = {
    on: (eventName, handler) => {
      void eventName;
      void handler;
    },
    off: (eventName, handler) => {
      void eventName;
      void handler;
    },
    addControl: (control, position) => {
      void control;
      void position;
    },
    addSource: (id, source) => {
      void id;
      void source;
    },
    addLayer: (layer, before) => {
      void layer;
      void before;
    },
    hasImage: (id) => {
      void id;
      return false;
    },
    addImage: (id, image) => {
      void id;
      void image;
    },
    isStyleLoaded: () => true,
    setStyle: (style, opts) => {
      void style;
      void opts;
    },
    remove: () => {},
  };

  return stub;
}
