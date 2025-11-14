export interface Coords {
  lat: number;
  lng: number;
}
export declare function extractCoords(url: string): Coords | null;
export declare function generateRouteLink(
  start: Coords | null | undefined,
  end: Coords | null | undefined,
  mode?: string,
): string;
export declare function generateMultiRouteLink(
  points?: Coords[],
  mode?: string,
): string;
declare const _default: {
  extractCoords: typeof extractCoords;
  generateRouteLink: typeof generateRouteLink;
  generateMultiRouteLink: typeof generateMultiRouteLink;
};
export default _default;
