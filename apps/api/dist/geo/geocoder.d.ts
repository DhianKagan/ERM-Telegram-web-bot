import type { Coordinates } from '../db/model';
export declare const geocodeAddress: (address: string) => Promise<Coordinates | null>;
export declare const geocodeAddresses: (addresses: string[]) => Promise<Coordinates[]>;
