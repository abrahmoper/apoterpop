/**
 * Nearby-services queries.
 *
 * The services directory is the half of Kiray that a rental site normally
 * leaves out: before you sign a lease you want to know where the supermarket,
 * the pharmacy and the minibus stop are. Same two-mode shape as listings —
 * bounding box in SQL, exact distance in the worker.
 */
import { getDB, tryGetDB } from "../cf";
import {
  boundsAround,
  haversineKm,
  parseBounds,
  type Bounds,
  type LatLng,
} from "../geo";
import { providerPlaceholder } from "../photos";
import { EMPTY_PROVIDER_FILTERS, type ProviderFilters } from "../search";
import { ESSENTIAL_CATEGORIES, SERVICE_CATEGORY_MAP } from "../taxonomy";
import type {
  ListingCardModel,
  Locale,
  NearbyHighlight,
  ProviderCardModel,
  ProviderRow,
} from "../types";
import { newId, safeJSON } from "../utils";
import { capped, localised, localisedRequired, placeholders, toBool } from "./shared";

export const SERVICE_PAGE_SIZE = 30;

/** How far out we are willing to call something "nearby". */
const NEARBY_RADIUS_KM = 2.5;

function toProvider(row: ProviderRow, locale: Locale): ProviderCardModel {
  return {
    id: row.id,
    name: localisedRequired(row.name_en, row.name_am, locale),
    category: row.category,
    description: localised(row.description_en, row.description_am, locale),
    phone: row.phone,
    addressLine: row.address_line,
    city: row.city,
    subcity: row.subcity,
    neighborhood: row.neighborhood,
    lat: row.lat,
    lng: row.lng,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    openDays: safeJSON<number[]>(row.open_days, [0, 1, 2, 3, 4, 5, 6]),
    priceLevel: row.price_level,
    delivery: toBool(row.delivery),
    emergency: toBool(row.emergency_24_7),
    verified: toBool(row.verified),
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    photoKey: row.photo_key ?? providerPlaceholder(row.id),
  };
}

/* -------------------------------------------------------------------------- */
/*  The neighbourhood ring                                                     */
/* -------------------------------------------------------------------------- */

/** One box covering every point in the batch, padded by the search radius. */
function unionBounds(points: LatLng[], padKm: number): Bounds {
  let south = points[0].lat;
  let north = points[0].lat;
  let west = points[0].lng;
  let east = points[0].lng;

  for (const point of points) {
    if (point.lat < south) south = point.lat;
    if (point.lat > north) north = point.lat;
    if (point.lng < west) west = point.lng;
    if (point.lng > east) east = point.lng;
  }

  const low = boundsAround({ lat: south, lng: west }, padKm);
  const high = boundsAround({ lat: north, lng: east }, padKm);
  return { south: low.south, west: low.west, north: high.north, east: high.east };
}

/**
 * Fills in `card.nearby` for a whole page of cards with a single query.
 *
 * The obvious implementation — five nearest-neighbour lookups per card — would
 * be a hundred and twenty queries for one page of search results. Instead we
 * pull every essential service inside one padded box and do the matching here,
 * which is a few thousand cheap distance calculations and one round trip.
 */
export async function attachNearby(
  db: D1Database,
  cards: ListingCardModel[],
  locale: Locale,
): Promise<void> {
  if (cards.length === 0) return;

  const box = unionBounds(
    cards.map((card) => ({ lat: card.lat, lng: card.lng })),
    NEARBY_RADIUS_KM,
  );
  const categories = [...ESSENTIAL_CATEGORIES];

  const { results } = await db
    .prepare(
      `SELECT id, name_en, name_am, category, lat, lng
         FROM providers
        WHERE status = 'published'
          AND category IN (${placeholders(categories.length)})
          AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
        LIMIT 2000`,
    )
    .bind(...categories, box.south, box.north, box.west, box.east)
    .all<Pick<ProviderRow, "id" | "name_en" | "name_am" | "category" | "lat" | "lng">>();

  if (results.length === 0) {
    for (const card of cards) card.nearby = [];
    return;
  }

  for (const card of cards) {
    const best = new Map<string, NearbyHighlight>();

    for (const row of results) {
      const km = haversineKm({ lat: card.lat, lng: card.lng }, { lat: row.lat, lng: row.lng });
      if (km > NEARBY_RADIUS_KM) continue;
      const current = best.get(row.category);
      if (current && current.distanceKm <= km) continue;
      best.set(row.category, {
        category: row.category,
        name: localisedRequired(row.name_en, row.name_am, locale),
        distanceKm: km,
      });
    }

    // Keep the taxonomy order so the ring reads the same on every card.
    card.nearby = categories
      .map((category) => best.get(category))
      .filter((entry): entry is NearbyHighlight => entry !== undefined);
  }
}

/* -------------------------------------------------------------------------- */
/*  Opening hours                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ethiopia has no daylight saving and sits permanently at UTC+3, so "now" for
 * an Addis shop is a fixed offset from the worker's clock. Doing this here
 * rather than in SQL also means `open_days` can stay a readable JSON array.
 */
function addisNow(): { day: number; minutes: number } {
  const utc = new Date();
  const local = new Date(utc.getTime() + 3 * 60 * 60 * 1000);
  return {
    day: local.getUTCDay(),
    minutes: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  const hours = Number(h);
  const mins = Number(m ?? "0");
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

/** True when the provider is open at this moment in Addis. */
export function isOpenNow(provider: ProviderCardModel): boolean {
  if (provider.emergency) return true;

  const { day, minutes } = addisNow();
  if (provider.openDays.length > 0 && !provider.openDays.includes(day)) return false;

  const opens = toMinutes(provider.opensAt);
  const closes = toMinutes(provider.closesAt);
  // No hours recorded means we cannot claim it is shut.
  if (opens === null || closes === null) return true;

  // A bar that closes at 02:00 is open past midnight, not shut all day.
  if (closes <= opens) return minutes >= opens || minutes < closes;
  return minutes >= opens && minutes < closes;
}

/* -------------------------------------------------------------------------- */
/*  Directory search                                                           */
/* -------------------------------------------------------------------------- */

export interface ProviderSearchResult {
  providers: ProviderCardModel[];
  total: number;
  page: number;
  pageSize: number;
}

export function providerBounds(filters: ProviderFilters): Bounds | null {
  const explicit = parseBounds(filters.bounds);
  if (explicit) return explicit;

  if (filters.nearLat !== null && filters.nearLng !== null) {
    return boundsAround(
      { lat: filters.nearLat, lng: filters.nearLng },
      filters.radiusKm && filters.radiusKm > 0 ? filters.radiusKm : 3,
    );
  }
  return null;
}

function providerClause(
  filters: ProviderFilters,
  box: Bounds | null,
): { sql: string[]; binds: unknown[] } {
  const sql: string[] = ["p.status = 'published'"];
  const binds: unknown[] = [];

  if (box) {
    sql.push("p.lat BETWEEN ? AND ?", "p.lng BETWEEN ? AND ?");
    binds.push(box.south, box.north, box.west, box.east);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    sql.push(
      `(p.name_en LIKE ? OR p.name_am LIKE ? OR p.description_en LIKE ?
        OR p.description_am LIKE ? OR p.neighborhood LIKE ? OR p.subcity LIKE ?)`,
    );
    binds.push(like, like, like, like, like, like);
  }

  if (filters.category && filters.category in SERVICE_CATEGORY_MAP) {
    sql.push("p.category = ?");
    binds.push(filters.category);
  }

  if (filters.city) {
    sql.push("p.city = ?");
    binds.push(filters.city);
  }

  if (filters.subcity) {
    sql.push("p.subcity = ?");
    binds.push(filters.subcity);
  }

  if (filters.delivery) sql.push("p.delivery = 1");
  if (filters.emergency) sql.push("p.emergency_24_7 = 1");
  if (filters.verifiedOnly) sql.push("p.verified = 1");

  return { sql, binds };
}

const PROVIDER_ORDER: Record<string, string> = {
  nearest: "p.verified DESC, p.rating_avg DESC, p.rating_count DESC",
  rating: "p.rating_avg DESC, p.rating_count DESC",
  name: "p.name_en ASC",
};

const MAX_PROVIDER_CANDIDATES = 800;

/**
 * The directory pages in the worker rather than in SQL, because two of its
 * filters — "open now" and the radius circle — cannot be expressed in SQLite
 * without either a stored timezone or trigonometry. The result set is small
 * enough that this is the simpler correct answer.
 */
export async function searchProviders(
  filters: Partial<ProviderFilters>,
  locale: Locale,
): Promise<ProviderSearchResult> {
  const fullFilters: ProviderFilters = { ...EMPTY_PROVIDER_FILTERS, ...filters };
  const db = await tryGetDB();
  const page = Math.max(1, fullFilters.page);
  if (!db) return { providers: [], total: 0, page, pageSize: SERVICE_PAGE_SIZE };

  const box = providerBounds(fullFilters);
  const { sql, binds } = providerClause(fullFilters, box);

  const { results } = await db
    .prepare(
      `SELECT * FROM providers p
        WHERE ${sql.join(" AND ")}
        ORDER BY ${PROVIDER_ORDER[fullFilters.sort] ?? PROVIDER_ORDER.nearest}
        LIMIT ?`,
    )
    .bind(...binds, MAX_PROVIDER_CANDIDATES)
    .all<ProviderRow>();

  let providers = results.map((row) => toProvider(row, locale));

  if (fullFilters.nearLat !== null && fullFilters.nearLng !== null) {
    const centre: LatLng = { lat: fullFilters.nearLat, lng: fullFilters.nearLng };
    const radius = fullFilters.radiusKm && fullFilters.radiusKm > 0 ? fullFilters.radiusKm : null;
    for (const provider of providers) {
      provider.distanceKm = haversineKm(centre, { lat: provider.lat, lng: provider.lng });
    }
    if (radius) providers = providers.filter((p) => (p.distanceKm ?? 0) <= radius);
    if (fullFilters.sort === "nearest") {
      providers.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
  }

  if (fullFilters.openNow) providers = providers.filter(isOpenNow);

  const total = providers.length;
  const start = (page - 1) * SERVICE_PAGE_SIZE;
  return {
    providers: providers.slice(start, start + SERVICE_PAGE_SIZE),
    total,
    page,
    pageSize: SERVICE_PAGE_SIZE,
  };
}

/** Every match for the services map, unpaged and capped. */
export async function providerPins(
  filters: ProviderFilters,
  locale: Locale,
  max = MAX_PROVIDER_CANDIDATES,
): Promise<ProviderCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const box = providerBounds(filters);
  const { sql, binds } = providerClause(filters, box);

  const { results } = await db
    .prepare(
      `SELECT * FROM providers p
        WHERE ${sql.join(" AND ")}
        ORDER BY p.verified DESC, p.rating_avg DESC
        LIMIT ?`,
    )
    .bind(...binds, max)
    .all<ProviderRow>();

  const providers = results.map((row) => toProvider(row, locale));
  if (filters.nearLat !== null && filters.nearLng !== null) {
    const centre: LatLng = { lat: filters.nearLat, lng: filters.nearLng };
    for (const provider of providers) {
      provider.distanceKm = haversineKm(centre, { lat: provider.lat, lng: provider.lng });
    }
  }
  if (filters.openNow) return providers.filter(isOpenNow);
  return providers;
}

/* -------------------------------------------------------------------------- */
/*  Detail and "around this home"                                              */
/* -------------------------------------------------------------------------- */

export async function getProvider(
  id: string,
  locale: Locale,
): Promise<ProviderCardModel | null> {
  const db = await tryGetDB();
  if (!db) return null;
  const row = await db
    .prepare("SELECT * FROM providers WHERE id = ?")
    .bind(id)
    .first<ProviderRow>();
  if (!row || row.status !== "published") return null;
  return toProvider(row, locale);
}

/**
 * The services shown on a listing detail page: nearest first, a few per
 * category so the list is useful rather than twelve identical kiosks.
 */
export async function providersAround(
  point: LatLng,
  locale: Locale,
  radiusKm = NEARBY_RADIUS_KM,
  perCategory = 3,
): Promise<ProviderCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const box = boundsAround(point, radiusKm);
  const { results } = await db
    .prepare(
      `SELECT * FROM providers
        WHERE status = 'published'
          AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
        LIMIT 600`,
    )
    .bind(box.south, box.north, box.west, box.east)
    .all<ProviderRow>();

  const providers = results
    .map((row) => toProvider(row, locale))
    .map((provider) => {
      provider.distanceKm = haversineKm(point, { lat: provider.lat, lng: provider.lng });
      return provider;
    })
    .filter((provider) => (provider.distanceKm ?? 0) <= radiusKm)
    .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));

  const seen = new Map<string, number>();
  const kept: ProviderCardModel[] = [];
  for (const provider of providers) {
    const count = seen.get(provider.category) ?? 0;
    if (count >= perCategory) continue;
    seen.set(provider.category, count + 1);
    kept.push(provider);
  }
  return kept;
}

/** Counts per category inside a radius — drives the category chips. */
export async function categoryCounts(
  point: LatLng,
  radiusKm = NEARBY_RADIUS_KM,
): Promise<Record<string, number>> {
  const db = await tryGetDB();
  if (!db) return {};

  const box = boundsAround(point, radiusKm);
  const { results } = await db
    .prepare(
      `SELECT category, COUNT(*) AS n FROM providers
        WHERE status = 'published'
          AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
        GROUP BY category`,
    )
    .bind(box.south, box.north, box.west, box.east)
    .all<{ category: string; n: number }>();

  const counts: Record<string, number> = {};
  for (const row of results) counts[row.category] = row.n;
  return counts;
}

/** Hydrates a known set of ids, keeping the order they were asked for. */
export async function providersByIds(
  ids: string[],
  locale: Locale,
): Promise<ProviderCardModel[]> {
  const db = await tryGetDB();
  const wanted = capped(ids);
  if (!db || wanted.length === 0) return [];

  const { results } = await db
    .prepare(`SELECT * FROM providers WHERE id IN (${placeholders(wanted.length)})`)
    .bind(...wanted)
    .all<ProviderRow>();

  const byId = new Map(results.map((row) => [row.id, toProvider(row, locale)]));
  return wanted
    .map((id) => byId.get(id))
    .filter((provider): provider is ProviderCardModel => provider !== undefined);
}

/* -------------------------------------------------------------------------- */
/*  Owner and admin side                                                       */
/* -------------------------------------------------------------------------- */

/** Directory entries this user submitted, including ones awaiting review. */
export async function ownedProviders(
  ownerId: string,
  locale: Locale,
): Promise<ProviderCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];
  const { results } = await db
    .prepare(
      `SELECT * FROM providers WHERE owner_id = ?
        ORDER BY CASE status WHEN 'draft' THEN 0 WHEN 'published' THEN 1
                             WHEN 'paused' THEN 2 ELSE 3 END,
                 created_at DESC`,
    )
    .bind(ownerId)
    .all<ProviderRow>();
  return results.map((row) => toProvider(row, locale));
}

export interface NewProvider {
  ownerId: string | null;
  nameEn: string;
  nameAm: string | null;
  category: string;
  descriptionEn: string | null;
  descriptionAm: string | null;
  phone: string | null;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  addressLine: string | null;
  lat: number;
  lng: number;
  opensAt: string | null;
  closesAt: string | null;
  openDays: number[];
  delivery: boolean;
  emergency: boolean;
}

/**
 * A community submission starts as a draft. Anyone can add the kiosk on their
 * corner, but an admin publishes it — the directory is only worth anything if
 * someone is checking it.
 */
export async function createProvider(input: NewProvider): Promise<string> {
  const db = await getDB();
  const id = newId("prv");

  await db
    .prepare(
      `INSERT INTO providers (
         id, owner_id, name_en, name_am, category, description_en, description_am,
         phone, address_line, city, subcity, neighborhood, lat, lng,
         opens_at, closes_at, open_days, delivery, emergency_24_7,
         status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft',
                 datetime('now'))`,
    )
    .bind(
      id,
      input.ownerId,
      input.nameEn.trim(),
      input.nameAm?.trim() || null,
      input.category,
      input.descriptionEn,
      input.descriptionAm,
      input.phone,
      input.addressLine,
      input.city || "Addis Ababa",
      input.subcity,
      input.neighborhood,
      input.lat,
      input.lng,
      input.opensAt,
      input.closesAt,
      JSON.stringify(input.openDays.length ? input.openDays : [0, 1, 2, 3, 4, 5, 6]),
      input.delivery ? 1 : 0,
      input.emergency ? 1 : 0,
    )
    .run();

  return id;
}

const PROVIDER_COLUMNS = new Set([
  "name_en", "name_am", "category", "description_en", "description_am",
  "phone", "phone_alt", "website", "address_line", "city", "subcity",
  "neighborhood", "lat", "lng", "opens_at", "closes_at", "open_days",
  "price_level", "delivery", "emergency_24_7", "photo_key",
]);

/** Owner edit. `verified` and `status` are deliberately not on the list. */
export async function updateProvider(
  id: string,
  ownerId: string,
  patch: Record<string, string | number | null>,
): Promise<boolean> {
  const db = await getDB();
  const columns: string[] = [];
  const binds: unknown[] = [];

  for (const [column, value] of Object.entries(patch)) {
    if (!PROVIDER_COLUMNS.has(column)) continue;
    columns.push(`${column} = ?`);
    binds.push(value);
  }
  if (columns.length === 0) return false;

  const result = await db
    .prepare(`UPDATE providers SET ${columns.join(", ")} WHERE id = ? AND owner_id = ?`)
    .bind(...binds, id, ownerId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/** Admin moderation: publish, pause, remove, and the verified badge. */
export async function setProviderStatus(id: string, status: string): Promise<void> {
  const db = await getDB();
  await db.prepare("UPDATE providers SET status = ? WHERE id = ?").bind(status, id).run();
}

export async function setProviderVerified(id: string, verified: boolean): Promise<void> {
  const db = await getDB();
  await db
    .prepare("UPDATE providers SET verified = ? WHERE id = ?")
    .bind(verified ? 1 : 0, id)
    .run();
}

export async function getOwnedProvider(
  id: string,
  ownerId: string,
): Promise<ProviderRow | null> {
  const db = await tryGetDB();
  if (!db) return null;
  return db
    .prepare("SELECT * FROM providers WHERE id = ? AND owner_id = ?")
    .bind(id, ownerId)
    .first<ProviderRow>();
}

/* -------------------------------------------------------------------------- */
/*  Provider reviews                                                           */
/* -------------------------------------------------------------------------- */

export interface ProviderReviewModel {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  authorName: string;
  authorAvatarKey: string | null;
}

export async function providerReviews(
  providerId: string,
  limit = 20,
): Promise<ProviderReviewModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.full_name AS author_name, u.avatar_key AS author_avatar_key
         FROM provider_reviews r
         JOIN users u ON u.id = r.author_id
        WHERE r.provider_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?`,
    )
    .bind(providerId, limit)
    .all<{
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      author_name: string;
      author_avatar_key: string | null;
    }>();

  return results.map((row) => ({
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
    authorName: row.author_name,
    authorAvatarKey: row.author_avatar_key,
  }));
}

/**
 * One review per person per place, upserted rather than duplicated, and the
 * provider's aggregate is recomputed in the same batch so the card and the
 * detail page can never disagree.
 */
export async function rateProvider(
  providerId: string,
  authorId: string,
  rating: number,
  comment: string | null,
): Promise<void> {
  const db = await getDB();
  const score = Math.min(5, Math.max(1, Math.round(rating)));

  const existing = await db
    .prepare("SELECT id FROM provider_reviews WHERE provider_id = ? AND author_id = ?")
    .bind(providerId, authorId)
    .first<{ id: string }>();

  const write = existing
    ? db
        .prepare("UPDATE provider_reviews SET rating = ?, comment = ? WHERE id = ?")
        .bind(score, comment, existing.id)
    : db
        .prepare(
          `INSERT INTO provider_reviews (id, provider_id, author_id, rating, comment, created_at)
           VALUES (?, ?, ?, ?, ?, datetime('now'))`,
        )
        .bind(newId("prr"), providerId, authorId, score, comment);

  await db.batch([
    write,
    db
      .prepare(
        `UPDATE providers SET
           rating_avg = (SELECT ROUND(AVG(rating), 2) FROM provider_reviews WHERE provider_id = ?),
           rating_count = (SELECT COUNT(*) FROM provider_reviews WHERE provider_id = ?)
         WHERE id = ?`,
      )
      .bind(providerId, providerId, providerId),
  ]);
}
