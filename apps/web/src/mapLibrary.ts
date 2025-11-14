import maplibregl, { type Map as MapInstance, type MapOptions } from 'maplibre-gl';
import { MAP_STYLE_URL, DEFAULT_CENTER, DEFAULT_ZOOM } from './config/map';

export type CreateMapOptions = {
  container: string | HTMLElement;
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
};

export function createMap(opts: CreateMapOptions): MapInstance {
  const options: MapOptions = {
    container: opts.container,
    style: opts.styleUrl ?? MAP_STYLE_URL,
    center: opts.center ?? DEFAULT_CENTER,
    zoom: opts.zoom ?? DEFAULT_ZOOM,
  };
  return new maplibregl.Map(options);
}
