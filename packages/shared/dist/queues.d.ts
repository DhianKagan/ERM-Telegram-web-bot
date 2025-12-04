export type Coordinates = {
  lat: number;
  lng: number;
};
export declare enum QueueName {
  LogisticsGeocoding = 'logistics:geocoding',
  LogisticsRouting = 'logistics:routing',
  DeadLetter = 'logistics:dead-letter',
}
export declare enum QueueJobName {
  GeocodeAddress = 'geocode-address',
  RouteDistance = 'route-distance',
  DeadLetter = 'dead-letter',
}
export type GeocodingJobData = {
  address: string;
};
export type GeocodingJobResult = Coordinates | null;
export type RouteDistanceJobData = {
  start: Coordinates;
  finish: Coordinates;
};
export type RouteDistanceJobResult = {
  distanceKm: number | null;
};
export type DeadLetterJobData = {
  queue: QueueName;
  jobName: QueueJobName;
  payload: unknown;
  failedReason: string;
  attemptsMade: number;
  failedAt: number;
};
