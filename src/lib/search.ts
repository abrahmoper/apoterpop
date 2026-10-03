/**
 * Search filters live entirely in the URL.
 *
 * That is a deliberate choice: every result page is shareable, the back button
 * works, and the map can push a new viewport without any client state library.
 */
import { parseBounds, serialiseBounds, type Bounds } from "./geo";
import { AMENITY_MAP, PROPERTY_TYPE_MAP, SERVICE_CATEGORY_MAP } from "./taxonomy";
import type { Furnished, RentalType, SearchFilters, SearchSort } from "./types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 24;

const SORTS: SearchSort[] = [
  "recommended",
  "price_asc",
  "price_desc",
  "rating",
  "newest",
  "distance",
];

function one(params: RawSearchParams, key: string): string {
  const value = params[key];
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return value?.trim() ?? "";
}

/** Accepts both `?amenities=wifi,parking` and repeated `?amenities=wifi`. */
function many(params: RawSearchParams, key: string): string[] {
  const value = params[key];
  const parts = Array.isArray(value) ? value : value ? [value] : [];
  return parts
    .flatMap((part) => part.split(","))
    .map((part) => part.trim())
    .filter(Boolean);
}

function num(params: RawSearchParams, key: string): number | null {
  const raw = one(params, key).replace(/,/g, "");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function bool(params: RawSearchParams, key: string): boolean {
  const raw = one(params, key).toLowerCase();
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

export const EMPTY_FILTERS: SearchFilters = {
  q: "",
  city: "",
  subcity: "",
  rentalType: "",
  propertyTypes: [],
  minPrice: null,
  maxPrice: null,
  bedrooms: null,
  bathrooms: null,
  furnished: "",
  amenities: [],
  instantBook: false,
  verifiedOnly: false,
  nearLat: null,
  nearLng: null,
  radiusKm: null,
  bounds: "",
  sort: "recommended",
  page: 1,
};

/** Back to a query string, dropping everything at its default. */
export function filtersToQuery(filters: Partial<SearchFilters>): string {
  const sp = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "" ) return;
    sp.set(key, String(value));
  };

  set("q", filters.q);
  set("city", filters.city);
  set("subcity", filters.subcity);
  set("rentalType", filters.rentalType);
  if (filters.propertyTypes?.length) sp.set("propertyType", filters.propertyTypes.join(","));
  set("minPrice", filters.minPrice);
  set("maxPrice", filters.maxPrice);
  set("bedrooms", filters.bedrooms);
  set("bathrooms", filters.bathrooms);
  set("furnished", filters.furnished);
  if (filters.amenities?.length) sp.set("amenities", filters.amenities.join(","));
  if (filters.instantBook) sp.set("instantBook", "1");
  if (filters.verifiedOnly) sp.set("verified", "1");
  set("lat", filters.nearLat);
  set("lng", filters.nearLng);
  set("radius", filters.radiusKm);
  set("bounds", filters.bounds);
  if (filters.sort && filters.sort !== "recommended") sp.set("sort", filters.sort);
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page));

  const query = sp.toString();
  return query ? `?${query}` : "";
}

/** How many filters the person has actually chosen — drives the badge count. */
export function activeFilterCount(filters: SearchFilters): number {
  let count = 0;
  if (filters.rentalType) count += 1;
  if (filters.propertyTypes.length) count += 1;
  if (filters.minPrice !== null || filters.maxPrice !== null) count += 1;
  if (filters.bedrooms !== null) count += 1;
  if (filters.bathrooms !== null) count += 1;
  if (filters.furnished) count += 1;
  if (filters.amenities.length) count += 1;
  if (filters.instantBook) count += 1;
  if (filters.verifiedOnly) count += 1;
  return count;
}

/** Everything except location and paging, used by "clear all". */
export function withoutFilters(filters: SearchFilters): SearchFilters {
  return {
    ...EMPTY_FILTERS,
    q: filters.q,
    city: filters.city,
    subcity: filters.subcity,
    nearLat: filters.nearLat,
    nearLng: filters.nearLng,
    radiusKm: filters.radiusKm,
    bounds: filters.bounds,
    sort: filters.sort,
  };
}

export function filterBounds(filters: SearchFilters): Bounds | null {
  return parseBounds(filters.bounds);
}

export function withBounds(filters: SearchFilters, bounds: Bounds): SearchFilters {
  return { ...filters, bounds: serialiseBounds(bounds), page: 1 };
}

export function parseSearchFilters(params: RawSearchParams): SearchFilters {
  const rentalTypeRaw = one(params, "rentalType");
  const furnishedRaw = one(params, "furnished");
  const sortRaw = one(params, "sort") as SearchSort;
  const page = num(params, "page") ?? 1;

  return {
    q: one(params, "q"),
    city: one(params, "city"),
    subcity: one(params, "subcity"),
    rentalType: rentalTypeRaw === "monthly" || rentalTypeRaw === "nightly" ? rentalTypeRaw : "",
    propertyTypes: many(params, "propertyType").filter((key) => key in PROPERTY_TYPE_MAP),
    minPrice: num(params, "minPrice"),
    maxPrice: num(params, "maxPrice"),
    bedrooms: num(params, "bedrooms"),
    bathrooms: num(params, "bathrooms"),
    furnished:
      furnishedRaw === "furnished" || furnishedRaw === "semi" || furnishedRaw === "unfurnished"
        ? (furnishedRaw as Furnished)
        : "",
    amenities: many(params, "amenities").filter((key) => key in AMENITY_MAP),
    instantBook: bool(params, "instantBook"),
    verifiedOnly: bool(params, "verified"),
    nearLat: num(params, "lat"),
    nearLng: num(params, "lng"),
    radiusKm: num(params, "radius"),
    bounds: one(params, "bounds"),
    sort: SORTS.includes(sortRaw) ? sortRaw : "recommended",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/* -------------------------------------------------------------------------- */
/*  Services directory                                                        */
/* -------------------------------------------------------------------------- */

export const SERVICE_SORTS = ["nearest", "rating", "name"] as const;
export type ServiceSort = (typeof SERVICE_SORTS)[number];

/** The directory has its own, much smaller filter set. */
export interface ProviderFilters {
  q: string;
  category: string;
  city: string;
  subcity: string;
  openNow: boolean;
  delivery: boolean;
  emergency: boolean;
  verifiedOnly: boolean;
  nearLat: number | null;
  nearLng: number | null;
  radiusKm: number | null;
  bounds: string;
  sort: ServiceSort;
  page: number;
}

export const EMPTY_PROVIDER_FILTERS: ProviderFilters = {
  q: "",
  category: "",
  city: "",
  subcity: "",
  openNow: false,
  delivery: false,
  emergency: false,
  verifiedOnly: false,
  nearLat: null,
  nearLng: null,
  radiusKm: null,
  bounds: "",
  sort: "nearest",
  page: 1,
};

export function parseProviderFilters(params: RawSearchParams): ProviderFilters {
  const categoryRaw = one(params, "category");
  const sortRaw = one(params, "sort") as ServiceSort;
  const page = num(params, "page") ?? 1;

  return {
    q: one(params, "q"),
    category: categoryRaw in SERVICE_CATEGORY_MAP ? categoryRaw : "",
    city: one(params, "city"),
    subcity: one(params, "subcity"),
    openNow: bool(params, "openNow"),
    delivery: bool(params, "delivery"),
    emergency: bool(params, "emergency"),
    verifiedOnly: bool(params, "verified"),
    nearLat: num(params, "lat"),
    nearLng: num(params, "lng"),
    radiusKm: num(params, "radius"),
    bounds: one(params, "bounds"),
    sort: SERVICE_SORTS.includes(sortRaw) ? sortRaw : "nearest",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

export function providerFiltersToQuery(filters: Partial<ProviderFilters>): string {
  const sp = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === "") return;
    sp.set(key, String(value));
  };

  set("q", filters.q);
  set("category", filters.category);
  set("city", filters.city);
  set("subcity", filters.subcity);
  if (filters.openNow) sp.set("openNow", "1");
  if (filters.delivery) sp.set("delivery", "1");
  if (filters.emergency) sp.set("emergency", "1");
  if (filters.verifiedOnly) sp.set("verified", "1");
  set("lat", filters.nearLat);
  set("lng", filters.nearLng);
  set("radius", filters.radiusKm);
  set("bounds", filters.bounds);
  if (filters.sort && filters.sort !== "nearest") sp.set("sort", filters.sort);
  if (filters.page && filters.page > 1) sp.set("page", String(filters.page));

  const query = sp.toString();
  return query ? `?${query}` : "";
}

export function activeProviderFilterCount(filters: ProviderFilters): number {
  let count = 0;
  if (filters.category) count += 1;
  if (filters.openNow) count += 1;
  if (filters.delivery) count += 1;
  if (filters.emergency) count += 1;
  if (filters.verifiedOnly) count += 1;
  return count;
}
