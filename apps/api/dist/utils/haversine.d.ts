export interface Coord {
    lat: number;
    lng: number;
}
export default function haversine(a: Coord, b: Coord): number;
