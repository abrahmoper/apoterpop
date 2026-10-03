/**
 * Listing queries.
 *
 * Search works in two modes. Without a location constraint the database does
 * the sorting and paging. With one, we pull the candidates inside a bounding box
 * (index-friendly), compute real haversine distances in the worker, then sort
 * and page in memory — which is the only way to order by distance correctly and
 * still keep the SQL cheap.
 */
import { getDB, tryGetDB } from "../cf";
import { boundsAround, haversineKm, parseBounds, type Bounds, type LatLng } from "../geo";
import { PAGE_SIZE } from "../search";
import { MAX_PHOTOS, listingPlaceholder, withFallbackPhotos } from "../photos";
import { AMENITY_MAP } from "../taxonomy";
import type {
  ListingCardModel,
  ListingDetailModel,
  ListingPhotoRow,
  ListingRow,
  ListingStatus,
  Locale,
  SearchFilters,
  SearchResult,
} from "../types";
import { newId, safeJSON } from "../utils";
import { attachNearby } from "./providers";
import { capped, localised, localisedRequired, placeholders, toBool } from "./shared";

/** Columns needed for a card, plus the host join. Kept in one place. */
const CARD_COLUMNS = `
  l.id, l.host_id, l.title_en, l.title_am, l.summary_en, l.summary_am,
  l.property_type, l.rental_type, l.price, l.currency, l.bedrooms, l.bathrooms,
  l.max_guests, l.area_sqm, l.furnished, l.city, l.subcity, l.neighborhood,
  l.lat, l.lng, l.rating_avg, l.rating_count, l.verified, l.instant_book,
  l.status, l.created_at,
  u.full_name AS host_name, u.avatar_key AS host_avatar_key
`;

type CardRow = ListingRow & { host_name: string; host_avatar_key: string | null };

function toCard(row: CardRow, locale: Locale): ListingCardModel {
  return {
    id: row.id,
    title: localisedRequired(row.title_en, row.title_am, locale),
    summary: localised(row.summary_en, row.summary_am, locale),
    propertyType: row.property_type,
    rentalType: row.rental_type,
    price: row.price,
    currency: row.currency,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    maxGuests: row.max_guests,
    areaSqm: row.area_sqm,
    furnished: row.furnished,
    city: row.city,
    subcity: row.subcity,
    neighborhood: row.neighborhood,
    lat: row.lat,
    lng: row.lng,
    ratingAvg: row.rating_avg,
    ratingCount: row.rating_count,
    verified: toBool(row.verified),
    instantBook: toBool(row.instant_book),
    status: row.status,
    photos: [],
    hostName: row.host_name,
    hostId: row.host_id,
    hostAvatarKey: row.host_avatar_key,
  };
}

/* -------------------------------------------------------------------------- */
/*  Photo and favourite hydration                                              */
/* -------------------------------------------------------------------------- */

/** One query for every card's photos, rather than one query per card. */
async function attachPhotos(
  db: D1Database,
  cards: ListingCardModel[],
  locale: Locale,
): Promise<void> {
  if (cards.length === 0) return;
  const ids = capped(cards.map((card) => card.id));

  const { results } = await db
    .prepare(
      `SELECT listing_id, key, alt_en, alt_am, sort_order
         FROM listing_photos
        WHERE listing_id IN (${placeholders(ids.length)})
        ORDER BY listing_id, sort_order`,
    )
    .bind(...ids)
    .all<ListingPhotoRow>();

  const byListing = new Map<string, string[]>();
  for (const row of results) {
    const bucket = byListing.get(row.listing_id) ?? [];
    bucket.push(row.key);
    byListing.set(row.listing_id, bucket);
  }

  for (const card of cards) {
    const photos = byListing.get(card.id) ?? [];
    // A listing with no uploads still gets a distinct, seeded cover.
    card.photos = photos.length > 0 ? photos : [listingPlaceholder(card.id, 0)];
  }
  void locale;
}

async function attachFavorites(
  db: D1Database,
  cards: ListingCardModel[],
  viewerId: string | null,
): Promise<void> {
  if (!viewerId || cards.length === 0) return;
  const ids = capped(cards.map((card) => card.id));

  const { results } = await db
    .prepare(
      `SELECT listing_id FROM favorites
        WHERE user_id = ? AND listing_id IN (${placeholders(ids.length)})`,
    )
    .bind(viewerId, ...ids)
    .all<{ listing_id: string }>();

  const saved = new Set(results.map((row) => row.listing_id));
  for (const card of cards) card.isFavorite = saved.has(card.id);
}

/* -------------------------------------------------------------------------- */
/*  Filter to SQL                                                              */
/* -------------------------------------------------------------------------- */

interface Clause {
  sql: string[];
  binds: unknown[];
}

/** Which box, if any, constrains this search. */
export function searchBounds(filters: SearchFilters): Bounds | null {
  const explicit = parseBounds(filters.bounds);
  if (explicit) return explicit;

  if (filters.nearLat !== null && filters.nearLng !== null) {
    return boundsAround(
      { lat: filters.nearLat, lng: filters.nearLng },
      filters.radiusKm && filters.radiusKm > 0 ? filters.radiusKm : 5,
    );
  }
  return null;
}

function buildClause(filters: SearchFilters, box: Bounds | null): Clause {
  const sql: string[] = ["l.status = 'published'"];
  const binds: unknown[] = [];

  if (box) {
    sql.push("l.lat BETWEEN ? AND ?", "l.lng BETWEEN ? AND ?");
    binds.push(box.south, box.north, box.west, box.east);
  }

  if (filters.q) {
    const like = `%${filters.q}%`;
    sql.push(
      `(l.title_en LIKE ? OR l.title_am LIKE ? OR l.summary_en LIKE ? OR l.summary_am LIKE ?
        OR l.neighborhood LIKE ? OR l.subcity LIKE ? OR l.city LIKE ?)`,
    );
    binds.push(like, like, like, like, like, like, like);
  }

  if (filters.city) {
    sql.push("l.city = ?");
    binds.push(filters.city);
  }

  if (filters.subcity) {
    sql.push("l.subcity = ?");
    binds.push(filters.subcity);
  }

  if (filters.rentalType) {
    sql.push("l.rental_type = ?");
    binds.push(filters.rentalType);
  }

  if (filters.propertyTypes.length) {
    sql.push(`l.property_type IN (${placeholders(filters.propertyTypes.length)})`);
    binds.push(...filters.propertyTypes);
  }

  if (filters.minPrice !== null) {
    sql.push("l.price >= ?");
    binds.push(filters.minPrice);
  }

  if (filters.maxPrice !== null) {
    sql.push("l.price <= ?");
    binds.push(filters.maxPrice);
  }

  if (filters.bedrooms !== null) {
    sql.push("l.bedrooms >= ?");
    binds.push(filters.bedrooms);
  }

  if (filters.bathrooms !== null) {
    sql.push("l.bathrooms >= ?");
    binds.push(filters.bathrooms);
  }

  if (filters.furnished) {
    sql.push("l.furnished = ?");
    binds.push(filters.furnished);
  }

  // amenities is a JSON array of keys; the quoted match avoids "wifi" hitting
  // a hypothetical "wifi_paid".
  for (const key of filters.amenities) {
    if (!(key in AMENITY_MAP)) continue;
    sql.push("l.amenities LIKE ?");
    binds.push(`%"${key}"%`);
  }

  if (filters.instantBook) sql.push("l.instant_book = 1");
  if (filters.verifiedOnly) sql.push("l.verified = 1");

  return { sql, binds };
}

const ORDER_BY: Record<string, string> = {
  recommended: "l.verified DESC, l.rating_avg DESC, l.rating_count DESC, l.created_at DESC",
  price_asc: "l.price ASC, l.rating_avg DESC",
  price_desc: "l.price DESC, l.rating_avg DESC",
  rating: "l.rating_avg DESC, l.rating_count DESC",
  newest: "l.created_at DESC",
};

/** SQL ordering for a sort mode; distance is resolved in the worker instead. */
function orderFor(sort: string): string {
  return ORDER_BY[sort] ?? ORDER_BY.recommended;
}

/**
 * How many rows we are willing to pull into the worker when ordering by
 * distance. Generous enough for any real Addis viewport, small enough that a
 * pathological "whole country" box cannot blow the request budget.
 */
const MAX_CANDIDATES = 600;

export interface SearchOptions {
  locale: Locale;
  viewerId?: string | null;
  /** Adds the neighbourhood ring data. Off for the map, on for the list. */
  withNearby?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Search                                                                     */
/* -------------------------------------------------------------------------- */

export async function searchListings(
  filters: SearchFilters,
  opts: SearchOptions | Locale,
): Promise<SearchResult> {
  const options: SearchOptions = typeof opts === "string" ? { locale: opts, withNearby: true } : opts;
  const db = await tryGetDB();
  const page = Math.max(1, filters.page);
  const empty: SearchResult = { listings: [], total: 0, page, pageSize: PAGE_SIZE };
  if (!db) return empty;

  const box = searchBounds(filters);
  const { sql, binds } = buildClause(filters, box);
  const where = sql.join(" AND ");
  const centre: LatLng | null =
    filters.nearLat !== null && filters.nearLng !== null
      ? { lat: filters.nearLat, lng: filters.nearLng }
      : null;

  const cards = box
    ? await searchInBox(db, where, binds, filters, centre, options.locale, page)
    : await searchPaged(db, where, binds, filters, options.locale, page);

  await attachPhotos(db, cards.listings, options.locale);
  await attachFavorites(db, cards.listings, options.viewerId ?? null);
  if (options.withNearby) await attachNearby(db, cards.listings, options.locale);

  return cards;
}

/** No location constraint: let SQLite sort, count and page. */
async function searchPaged(
  db: D1Database,
  where: string,
  binds: unknown[],
  filters: SearchFilters,
  locale: Locale,
  page: number,
): Promise<SearchResult> {
  const offset = (page - 1) * PAGE_SIZE;

  const countRow = await db
    .prepare(`SELECT COUNT(*) AS n FROM listings l WHERE ${where}`)
    .bind(...binds)
    .first<{ n: number }>();

  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE ${where}
        ORDER BY ${orderFor(filters.sort)}
        LIMIT ? OFFSET ?`,
    )
    .bind(...binds, PAGE_SIZE, offset)
    .all<CardRow>();

  return {
    listings: results.map((row) => toCard(row, locale)),
    total: countRow?.n ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}

/**
 * Inside a box: the bounding box is a cheap index lookup, but a box is a square
 * and a radius is a circle, and "nearest first" cannot be expressed in SQL
 * without trigonometry SQLite does not have. So we take the candidates in the
 * SQL order (which keeps the best rows if we ever hit the cap), measure them
 * properly, then trim, sort and page here.
 */
async function searchInBox(
  db: D1Database,
  where: string,
  binds: unknown[],
  filters: SearchFilters,
  centre: LatLng | null,
  locale: Locale,
  page: number,
): Promise<SearchResult> {
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE ${where}
        ORDER BY ${orderFor(filters.sort)}
        LIMIT ?`,
    )
    .bind(...binds, MAX_CANDIDATES)
    .all<CardRow>();

  let cards = results.map((row) => toCard(row, locale));

  if (centre) {
    const radius = filters.radiusKm && filters.radiusKm > 0 ? filters.radiusKm : null;
    for (const card of cards) {
      card.distanceKm = haversineKm(centre, { lat: card.lat, lng: card.lng });
    }
    // Drop the corners of the box that fall outside the actual circle.
    if (radius) cards = cards.filter((card) => (card.distanceKm ?? 0) <= radius);
    if (filters.sort === "distance") {
      cards.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    }
  }

  const total = cards.length;
  const start = (page - 1) * PAGE_SIZE;
  return { listings: cards.slice(start, start + PAGE_SIZE), total, page, pageSize: PAGE_SIZE };
}

/**
 * Every match for the map, not just the current page — a map that only showed
 * page one would be lying about where the homes are. Capped, and without the
 * photo or favourite joins, because a pin only needs a price and a point.
 */
export async function mapPins(
  filters: SearchFilters,
  locale: Locale,
  max = MAX_CANDIDATES,
): Promise<ListingCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const box = searchBounds(filters);
  const { sql, binds } = buildClause(filters, box);

  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE ${sql.join(" AND ")}
        ORDER BY ${orderFor(filters.sort)}
        LIMIT ?`,
    )
    .bind(...binds, max)
    .all<CardRow>();

  const cards = results.map((row) => toCard(row, locale));
  if (filters.nearLat !== null && filters.nearLng !== null) {
    const centre: LatLng = { lat: filters.nearLat, lng: filters.nearLng };
    for (const card of cards) {
      card.distanceKm = haversineKm(centre, { lat: card.lat, lng: card.lng });
    }
  }
  return cards;
}

/* -------------------------------------------------------------------------- */
/*  Curated rows for the home page                                             */
/* -------------------------------------------------------------------------- */

/** Shared tail for the small "here are some homes" rows. */
async function cardRow(
  where: string,
  binds: unknown[],
  order: string,
  limit: number,
  locale: Locale,
  viewerId: string | null,
  withNearby: boolean,
  orderBinds: unknown[] = [],
): Promise<ListingCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ?`,
    )
    .bind(...binds, ...orderBinds, limit)
    .all<CardRow>();

  const cards = results.map((row) => toCard(row, locale));
  await attachPhotos(db, cards, locale);
  await attachFavorites(db, cards, viewerId);
  if (withNearby) await attachNearby(db, cards, locale);
  return cards;
}

export async function featuredListings(
  locale: Locale,
  viewerIdOrLimit: string | null | number = null,
  maybeLimit = 8,
): Promise<ListingCardModel[]> {
  const limit = typeof viewerIdOrLimit === "number" ? viewerIdOrLimit : maybeLimit;
  const viewerId = typeof viewerIdOrLimit === "string" ? viewerIdOrLimit : null;
  return cardRow(
    "l.status = 'published' AND l.verified = 1",
    [],
    "l.rating_avg DESC, l.rating_count DESC, l.created_at DESC",
    limit,
    locale,
    viewerId,
    true,
  );
}

export async function newestListings(
  locale: Locale,
  viewerIdOrLimit: string | null | number = null,
  maybeLimit = 8,
): Promise<ListingCardModel[]> {
  const limit = typeof viewerIdOrLimit === "number" ? viewerIdOrLimit : maybeLimit;
  const viewerId = typeof viewerIdOrLimit === "string" ? viewerIdOrLimit : null;
  return cardRow(
    "l.status = 'published'",
    [],
    "l.created_at DESC",
    limit,
    locale,
    viewerId,
    false,
  );
}

/** Cheapest published homes of a rental type — the "budget" row. */
export async function affordableListings(
  rentalTypeOrLocale: string | Locale,
  localeOrLimit?: Locale | number,
  viewerIdOrLimit: string | null | number = null,
  maybeLimit = 8,
): Promise<ListingCardModel[]> {
  let rentalType = "monthly";
  let locale: Locale = "en";
  let viewerId: string | null = null;
  let limit = 8;

  if (rentalTypeOrLocale === "en" || rentalTypeOrLocale === "am") {
    locale = rentalTypeOrLocale;
    if (typeof localeOrLimit === "number") limit = localeOrLimit;
  } else {
    rentalType = rentalTypeOrLocale;
    if (localeOrLimit === "en" || localeOrLimit === "am") locale = localeOrLimit;
    if (typeof viewerIdOrLimit === "number") {
      limit = viewerIdOrLimit;
    } else {
      viewerId = viewerIdOrLimit;
      limit = maybeLimit;
    }
  }

  return cardRow(
    "l.status = 'published' AND l.rental_type = ? AND l.price > 0",
    [rentalType],
    "l.price ASC, l.rating_avg DESC",
    limit,
    locale,
    viewerId,
    false,
  );
}

/**
 * Homes like this one: same city, similar size and price, never itself.
 * Ordered by how close the price is, so the row reads as a real alternative
 * rather than a random sample.
 */
export async function similarListings(
  listing: ListingCardModel,
  locale: Locale,
  viewerId: string | null = null,
  limit = 4,
): Promise<ListingCardModel[]> {
  const span = Math.max(listing.price * 0.45, 1);
  return cardRow(
    `l.status = 'published' AND l.id != ? AND l.city = ? AND l.rental_type = ?
       AND l.price BETWEEN ? AND ?`,
    [listing.id, listing.city, listing.rentalType, listing.price - span, listing.price + span],
    "ABS(l.price - ?) ASC, l.rating_avg DESC",
    limit,
    locale,
    viewerId,
    false,
    [Math.round(listing.price)],
  );
}

/* -------------------------------------------------------------------------- */
/*  Detail                                                                     */
/* -------------------------------------------------------------------------- */

type DetailRow = ListingRow & {
  host_name: string;
  host_avatar_key: string | null;
  host_bio: string | null;
  host_phone: string | null;
  host_since: string;
  host_response_rate: number;
};

interface DetailOptions {
  locale: Locale;
  viewerId?: string | null;
  /** Pass true to see the street address and host phone regardless. */
  privileged?: boolean;
}

/**
 * The exact address and the host's phone number are withheld until there is a
 * reason to share them: you own the listing, or you have a booking on it. This
 * is the one privacy rule the whole product hangs on, so it lives here rather
 * than in a page.
 */
async function canSeeContact(
  db: D1Database,
  listingId: string,
  hostId: string,
  viewerId: string | null,
): Promise<boolean> {
  if (!viewerId) return false;
  if (viewerId === hostId) return true;

  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM bookings
        WHERE listing_id = ? AND guest_id = ?
          AND status IN ('confirmed', 'completed')
        LIMIT 1`,
    )
    .bind(listingId, viewerId)
    .first<{ ok: number }>();

  return !!row;
}

export async function getListing(
  id: string,
  opts: DetailOptions,
): Promise<ListingDetailModel | null> {
  const db = await tryGetDB();
  if (!db) return null;
  const { locale } = opts;
  const viewerId = opts.viewerId ?? null;

  const row = await db
    .prepare(
      `SELECT l.*,
              u.full_name AS host_name, u.avatar_key AS host_avatar_key,
              u.bio AS host_bio, u.phone AS host_phone,
              u.created_at AS host_since, u.response_rate AS host_response_rate
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE l.id = ?`,
    )
    .bind(id)
    .first<DetailRow>();

  if (!row) return null;

  const isOwner = viewerId !== null && viewerId === row.host_id;
  // A listing that is not published is only visible to its host.
  if (row.status !== "published" && !isOwner && !opts.privileged) return null;

  const card = toCard(row as unknown as CardRow, locale);
  const reveal =
    opts.privileged === true || (await canSeeContact(db, row.id, row.host_id, viewerId));

  const { results: photoRows } = await db
    .prepare(
      `SELECT listing_id, key, alt_en, alt_am, sort_order
         FROM listing_photos WHERE listing_id = ? ORDER BY sort_order`,
    )
    .bind(id)
    .all<ListingPhotoRow>();

  const photos = photoRows.map((photo) => photo.key);
  const alts = photoRows.map((photo) => localised(photo.alt_en, photo.alt_am, locale) ?? "");

  // The gallery grid wants five tiles; seeded listings without uploads still
  // get five distinct placeholders rather than one repeated four times.
  card.photos = withFallbackPhotos(photos, row.id, 5);

  const breakdown = await db
    .prepare(
      `SELECT AVG(cleanliness) AS cleanliness, AVG(accuracy) AS accuracy,
              AVG(location_score) AS location, AVG(value_score) AS value,
              AVG(communication) AS communication
         FROM reviews WHERE listing_id = ?`,
    )
    .bind(id)
    .first<Record<string, number | null>>();

  const score = (value: number | null | undefined): number =>
    value === null || value === undefined ? row.rating_avg : Math.round(value * 10) / 10;

  if (viewerId) {
    const fav = await db
      .prepare("SELECT 1 AS ok FROM favorites WHERE user_id = ? AND listing_id = ?")
      .bind(viewerId, id)
      .first<{ ok: number }>();
    card.isFavorite = !!fav;
  }

  await attachNearby(db, [card], locale);

  return {
    ...card,
    description: localised(row.description_en, row.description_am, locale),
    houseRules: localised(row.house_rules_en, row.house_rules_am, locale),
    amenityKeys: safeJSON<string[]>(row.amenities, []).filter((key) => key in AMENITY_MAP),
    beds: row.beds,
    depositMonths: row.deposit_months,
    currency: row.currency,
    minStayMonths: row.min_stay_months,
    minNights: row.min_nights,
    availableFrom: row.available_from,
    addressLine: reveal ? row.address_line : null,
    viewCount: row.view_count,
    createdAt: row.created_at,
    hostBio: row.host_bio,
    hostSince: row.host_since,
    hostResponseRate: row.host_response_rate,
    hostPhone: reveal ? row.host_phone : null,
    photoAlts: alts,
    ratingBreakdown: {
      cleanliness: score(breakdown?.cleanliness),
      accuracy: score(breakdown?.accuracy),
      location: score(breakdown?.location),
      value: score(breakdown?.value),
      communication: score(breakdown?.communication),
    },
  };
}

/** Fire-and-forget: a failed view count must never break a page render. */
export async function incrementViews(id: string): Promise<void> {
  const db = await tryGetDB();
  if (!db) return;
  try {
    await db
      .prepare("UPDATE listings SET view_count = view_count + 1 WHERE id = ?")
      .bind(id)
      .run();
  } catch {
    // ignored on purpose
  }
}

/* -------------------------------------------------------------------------- */
/*  Host side                                                                  */
/* -------------------------------------------------------------------------- */

/** Every listing a host owns, drafts included, newest first. */
export async function hostListings(
  hostId: string,
  locale: Locale,
): Promise<ListingCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM listings l
         JOIN users u ON u.id = l.host_id
        WHERE l.host_id = ?
        ORDER BY CASE l.status WHEN 'draft' THEN 0 WHEN 'published' THEN 1
                              WHEN 'paused' THEN 2 ELSE 3 END,
                 l.created_at DESC`,
    )
    .bind(hostId)
    .all<CardRow>();

  const cards = results.map((row) => toCard(row, locale));
  await attachPhotos(db, cards, locale);
  return cards;
}

/** Raw row for the editor, and the ownership gate for every mutation below. */
export async function getOwnedListing(
  id: string,
  hostId: string,
): Promise<ListingRow | null> {
  const db = await tryGetDB();
  if (!db) return null;
  return db
    .prepare("SELECT * FROM listings WHERE id = ? AND host_id = ?")
    .bind(id, hostId)
    .first<ListingRow>();
}

/**
 * A draft starts with sensible Addis defaults so the wizard never shows an
 * empty map or a zero price; the host overwrites what matters.
 */
export async function createListingDraft(hostId: string, title: string): Promise<string> {
  const db = await getDB();
  const id = newId("lst");

  await db
    .prepare(
      `INSERT INTO listings (
         id, host_id, title_en, property_type, rental_type, price, deposit_months,
         currency, bedrooms, beds, bathrooms, max_guests, furnished, amenities,
         city, lat, lng, min_stay_months, min_nights, status, created_at
       ) VALUES (?, ?, ?, 'apartment', 'monthly', 0, 2, 'ETB', 1, 1, 1, 2,
                 'unfurnished', '[]', 'Addis Ababa', 9.0108, 38.7613, 6, 1,
                 'draft', datetime('now'))`,
    )
    .bind(id, hostId, title.trim() || "Untitled listing")
    .run();

  return id;
}

/**
 * Columns the wizard is allowed to write. Anything not on this list is dropped
 * rather than rejected, so a stray form field can never become SQL and can
 * never let a host set their own `verified` flag.
 */
const EDITABLE_COLUMNS = new Set([
  "title_en", "title_am", "summary_en", "summary_am",
  "description_en", "description_am", "house_rules_en", "house_rules_am",
  "property_type", "rental_type", "price", "deposit_months", "currency",
  "bedrooms", "beds", "bathrooms", "max_guests", "area_sqm", "furnished",
  "amenities", "city", "subcity", "neighborhood", "address_line",
  "lat", "lng", "min_stay_months", "min_nights", "available_from",
  "instant_book",
]);

export type ListingPatch = Record<string, string | number | null>;

export async function updateListing(
  id: string,
  hostId: string,
  patch: ListingPatch,
): Promise<boolean> {
  const db = await getDB();
  const columns: string[] = [];
  const binds: unknown[] = [];

  for (const [column, value] of Object.entries(patch)) {
    if (!EDITABLE_COLUMNS.has(column)) continue;
    columns.push(`${column} = ?`);
    binds.push(value);
  }
  if (columns.length === 0) return false;

  const result = await db
    .prepare(
      `UPDATE listings SET ${columns.join(", ")}, updated_at = datetime('now')
        WHERE id = ? AND host_id = ?`,
    )
    .bind(...binds, id, hostId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

export async function setListingStatus(
  id: string,
  hostId: string,
  status: ListingStatus,
): Promise<boolean> {
  const db = await getDB();
  const result = await db
    .prepare(
      `UPDATE listings SET status = ?, updated_at = datetime('now')
        WHERE id = ? AND host_id = ?`,
    )
    .bind(status, id, hostId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

/**
 * Hosts never hard-delete: a removed listing still has bookings, messages and
 * reviews hanging off it that other people are entitled to see.
 */
export async function removeListing(id: string, hostId: string): Promise<boolean> {
  return setListingStatus(id, hostId, "removed");
}

/** What the wizard needs to know before it will let a host publish. */
export function publishBlockers(row: ListingRow, photoCount: number): string[] {
  const missing: string[] = [];
  if (!row.title_en.trim()) missing.push("title");
  if (!row.summary_en?.trim()) missing.push("summary");
  if (!row.description_en?.trim()) missing.push("description");
  if (!row.city.trim()) missing.push("city");
  if (!row.neighborhood?.trim()) missing.push("neighborhood");
  if (row.price <= 0) missing.push("price");
  if (photoCount === 0) missing.push("photos");
  return missing;
}

/* -------------------------------------------------------------------------- */
/*  Photos                                                                     */
/* -------------------------------------------------------------------------- */

export async function listingPhotos(listingId: string): Promise<ListingPhotoRow[]> {
  const db = await tryGetDB();
  if (!db) return [];
  const { results } = await db
    .prepare("SELECT * FROM listing_photos WHERE listing_id = ? ORDER BY sort_order")
    .bind(listingId)
    .all<ListingPhotoRow>();
  return results;
}

/** Appends after the current last photo, so uploads keep their arrival order. */
export async function addPhoto(
  listingId: string,
  key: string,
  altEn: string | null = null,
  altAm: string | null = null,
): Promise<string> {
  const db = await getDB();
  const last = await db
    .prepare("SELECT MAX(sort_order) AS n FROM listing_photos WHERE listing_id = ?")
    .bind(listingId)
    .first<{ n: number | null }>();

  const id = newId("pho");
  await db
    .prepare(
      `INSERT INTO listing_photos (id, listing_id, key, alt_en, alt_am, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, listingId, key, altEn, altAm, (last?.n ?? -1) + 1)
    .run();

  return id;
}

export async function removePhoto(photoId: string, listingId: string): Promise<void> {
  const db = await getDB();
  await db
    .prepare("DELETE FROM listing_photos WHERE id = ? AND listing_id = ?")
    .bind(photoId, listingId)
    .run();
}

/**
 * Rewrites the whole order rather than nudging one row: the ids arrive from the
 * host's drag-and-drop already in the order they want, and a single batch keeps
 * the numbering dense and gap-free.
 */
export async function reorderPhotos(listingId: string, orderedIds: string[]): Promise<void> {
  const db = await getDB();
  const ids = capped(orderedIds, MAX_PHOTOS);
  if (ids.length === 0) return;

  await db.batch(
    ids.map((photoId, index) =>
      db
        .prepare("UPDATE listing_photos SET sort_order = ? WHERE id = ? AND listing_id = ?")
        .bind(index, photoId, listingId),
    ),
  );
}

/** Promotes one photo to the cover by moving it to the front of the order. */
export async function setCoverPhoto(listingId: string, photoId: string): Promise<void> {
  const photos = await listingPhotos(listingId);
  if (!photos.some((photo) => photo.id === photoId)) return;
  const reordered = [photoId, ...photos.map((photo) => photo.id).filter((id) => id !== photoId)];
  await reorderPhotos(listingId, reordered);
}

/* -------------------------------------------------------------------------- */
/*  Favourites                                                                 */
/* -------------------------------------------------------------------------- */

/** Saved homes, most recently saved first. */
export async function favoriteListings(
  userId: string,
  locale: Locale,
): Promise<ListingCardModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
         FROM favorites f
         JOIN listings l ON l.id = f.listing_id
         JOIN users u ON u.id = l.host_id
        WHERE f.user_id = ? AND l.status = 'published'
        ORDER BY f.created_at DESC
        LIMIT 200`,
    )
    .bind(userId)
    .all<CardRow>();

  const cards = results.map((row) => toCard(row, locale));
  await attachPhotos(db, cards, locale);
  for (const card of cards) card.isFavorite = true;
  await attachNearby(db, cards, locale);
  return cards;
}

/** Toggles and reports the new state, so the button can render optimistically. */
export async function toggleFavorite(userId: string, listingId: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db
    .prepare("SELECT 1 AS ok FROM favorites WHERE user_id = ? AND listing_id = ?")
    .bind(userId, listingId)
    .first<{ ok: number }>();

  if (existing) {
    await db
      .prepare("DELETE FROM favorites WHERE user_id = ? AND listing_id = ?")
      .bind(userId, listingId)
      .run();
    return false;
  }

  await db
    .prepare(
      `INSERT INTO favorites (user_id, listing_id, created_at)
       VALUES (?, ?, datetime('now'))`,
    )
    .bind(userId, listingId)
    .run();
  return true;
}
