import type { Job } from 'bullmq';
import type { GeocodingJobResult } from 'shared';
/**
 * Main exported function.
 * Accepts: Job or address string or undefined.
 * Returns: GeocodingJobResult (Coordinates | null)
 */
export declare function geocodeAddress(jobOrAddress: Job | string | undefined): Promise<GeocodingJobResult>;
