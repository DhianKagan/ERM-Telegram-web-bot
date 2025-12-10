// apps/web/src/lib/mapLibrary.ts
// Minimal createMap no-op for deployments without a real map.
// If components call createMap, they will get a lightweight stub object
// with commonly used methods (safe no-ops).

type MaybeString = string | undefined | null;

export async function createMap(
  _container: string | HTMLElement,
  _opts?: { center?: [number, number]; zoom?: number },
) {
  // minimal stub map object with safe no-op methods used by the app
  const stub = {
    on: (_ev: string, _cb?: any) => {},
    off: (_ev: string, _cb?: any) => {},
    addControl: (_ctrl: any, _pos?: any) => {},
    addSource: (_id: string, _src: any) => {},
    addLayer: (_layer: any, _before?: string | undefined) => {},
    hasImage: (_id: string) => false,
    addImage: (_id: string, _img: any) => {},
    isStyleLoaded: () => true,
    setStyle: (_style: any, _opts?: any) => {},
    remove: () => {},
  };
  return stub as unknown as any;
}
