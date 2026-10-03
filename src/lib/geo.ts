/**
 * Geography for a marketplace whose every list can be ordered by distance.
 *
 * Exact maths happen in the worker, not in SQLite: the database only runs a
 * cheap, index-friendly bounding-box prefilter, and `boundsAround` is what
 * draws that box. Everything here is pure — the search and provider modules
 * call it inside query builders.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Where the pin lands before anyone says where they are looking. */
export const ADDIS_CENTER: LatLng = { lat: 9.0192, lng: 38.7525 };

const EARTH_RADIUS_KM = 6371;
const METERS_PER_DEG_LAT = 110_574;

/**
 * Great-circle distance in kilometres. Good to about half a metre here, which
 * is far below the accuracy of anyone's pins anyway.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const mid =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(mid)));
}

/**
 * The box that contains every point within `radiusKm` of the centre.
 * Longitude degrees shrink away from the equator, so the half-width is
 * widened by the cosine of the centre — at Addis latitude that is about 1%.
 */
export function boundsAround(point: LatLng, radiusKm: number): Bounds {
  const radius = Math.max(0.1, radiusKm);
  const dLat = radius * 1000 / METERS_PER_DEG_LAT;
  const cos = Math.max(Math.cos((point.lat * Math.PI) / 180), 0.01);
  const dLng = radius * 1000 / (METERS_PER_DEG_LAT * cos);

  const clampLat = (value: number) => Math.max(-85, Math.min(85, value));
  const clampLng = (value: number) => Math.max(-180, Math.min(180, value));

  return {
    south: clampLat(point.lat - dLat),
    north: clampLat(point.lat + dLat),
    west: clampLng(point.lng - dLng),
    east: clampLng(point.lng + dLng),
  };
}

/**
 * Bounds travel through URLs as `south,west,north,east`, four decimals — about
 * 10 m of precision, which is plenty and keeps links short.
 */
export function serialiseBounds(bounds: Bounds): string {
  const round = (value: number) => Math.round(value * 10_000) / 10_000;
  return [bounds.south, bounds.west, bounds.north, bounds.east].map(round).join(",");
}

/** Inverse of `serialiseBounds`; junk or reversed boxes mean "no box". */
export function parseBounds(value: string | null | undefined): Bounds | null {
  if (!value) return null;
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [south, west, north, east] = parts;
  if (south >= north || west >= east) return null;
  if (Math.abs(south) > 90 || Math.abs(north) > 90) return null;
  if (Math.abs(west) > 180 || Math.abs(east) > 180) return null;
  return { south, west, north, east };
}

/** Ethiopian cities the product actively covers, with Amharic names. */
export const CITIES: Array<{ key: string; en: string; am: string; center: LatLng }> = [
  { key: "Addis Ababa", en: "Addis Ababa", am: "አዲስ አበባ", center: ADDIS_CENTER },
  { key: "Adama", en: "Adama", am: "አዳማ", center: { lat: 8.5426, lng: 39.2706 } },
  { key: "Bahir Dar", en: "Bahir Dar", am: "ባሕር ዳር", center: { lat: 11.5936, lng: 37.3908 } },
  { key: "Hawassa", en: "Hawassa", am: "ሀዋሳ", center: { lat: 7.0621, lng: 38.4764 } },
  { key: "Dire Dawa", en: "Dire Dawa", am: "ድሬዳዋ", center: { lat: 9.6007, lng: 41.8561 } },
  { key: "Mekelle", en: "Mekelle", am: "መቀሌ", center: { lat: 13.4967, lng: 39.4753 } },
  { key: "Gondar", en: "Gondar", am: "ጎንደር", center: { lat: 12.6101, lng: 37.4653 } },
  { key: "Jimma", en: "Jimma", am: "ጅማ", center: { lat: 7.6761, lng: 36.8341 } },
];

/** Addis Ababa's sub-cities, for the filter dropdowns and seeded data. */
export const ADDIS_SUBCITIES: string[] = [
  "Bole",
  "Yeka",
  "Kirkos",
  "Arada",
  "Lideta",
  "Addis Ketema",
  "Nifas Silk-Lafto",
  "Kolfe Keranio",
  "Gullele",
  "Akaky Kaliti",
  "Lemi Kura",
];
