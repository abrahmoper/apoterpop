/**
 * Booking queries.
 *
 * A booking here is a request, not a payment: the guest asks, the host accepts
 * or declines, and money changes hands offline the way it actually does in
 * Addis. That makes the status machine the important part of this file.
 */
import { getDB, tryGetDB } from "../cf";
import { listingPlaceholder } from "../photos";
import { quote, type Quote } from "../pricing";
import type {
  BookingModel,
  BookingRow,
  BookingStatus,
  ListingRow,
  Locale,
} from "../types";
import { newId } from "../utils";
import { localisedRequired } from "./shared";

/** Human-facing reference, short enough to read down a phone line. */
export function bookingCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `KRY-${out}`;
}

/** Statuses that still hold the calendar. */
export const BLOCKING_STATUSES: BookingStatus[] = ["pending", "confirmed"];

const BOOKING_COLUMNS = `
  b.*,
  l.title_en AS listing_title_en, l.title_am AS listing_title_am,
  l.city AS listing_city, l.neighborhood AS listing_neighborhood,
  g.full_name AS guest_name, g.phone AS guest_phone, g.avatar_key AS guest_avatar_key,
  h.full_name AS host_name, h.phone AS host_phone, h.avatar_key AS host_avatar_key,
  (SELECT key FROM listing_photos WHERE listing_id = l.id ORDER BY sort_order LIMIT 1)
    AS listing_photo
`;

type BookingJoinRow = BookingRow & {
  listing_title_en: string;
  listing_title_am: string | null;
  listing_city: string;
  listing_neighborhood: string | null;
  guest_name: string;
  guest_phone: string | null;
  guest_avatar_key: string | null;
  host_name: string;
  host_phone: string | null;
  host_avatar_key: string | null;
  listing_photo: string | null;
};

/**
 * Phone numbers appear once a booking is confirmed and not before. A pending
 * request is a conversation, not an introduction, and hosts get enough cold
 * calls already.
 */
function toBooking(row: BookingJoinRow, locale: Locale): BookingModel {
  const reveal = row.status === "confirmed" || row.status === "completed";

  return {
    id: row.id,
    code: row.code,
    listing_id: row.listing_id,
    guest_id: row.guest_id,
    host_id: row.host_id,
    start_date: row.start_date,
    end_date: row.end_date,
    rental_type: row.rental_type,
    units: row.units,
    guests: row.guests,
    unit_price: row.unit_price,
    subtotal: row.subtotal,
    service_fee: row.service_fee,
    deposit: row.deposit,
    total: row.total,
    currency: row.currency,
    status: row.status,
    guest_message: row.guest_message,
    host_note: row.host_note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    responded_at: row.responded_at,
    listingTitle: localisedRequired(row.listing_title_en, row.listing_title_am, locale),
    listingPhoto: row.listing_photo ?? listingPlaceholder(row.listing_id, 0),
    listingCity: row.listing_city,
    listingNeighborhood: row.listing_neighborhood,
    guestName: row.guest_name,
    guestPhone: reveal ? row.guest_phone : null,
    guestAvatarKey: row.guest_avatar_key,
    hostName: row.host_name,
    hostPhone: reveal ? row.host_phone : null,
    hostAvatarKey: row.host_avatar_key,
  };
}

/* -------------------------------------------------------------------------- */
/*  Availability                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Overlap test, not containment: two ranges clash when each starts before the
 * other ends. Written as a single query so a race between two guests hitting
 * "request" at the same second still leaves the host with a visible conflict
 * rather than a silently double-booked month.
 */
export async function hasConflict(
  listingId: string,
  from: string,
  to: string,
  excludeBookingId: string | null = null,
): Promise<boolean> {
  const db = await tryGetDB();
  if (!db) return false;

  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM bookings
        WHERE listing_id = ?
          AND status IN (${BLOCKING_STATUSES.map(() => "?").join(", ")})
          AND (? IS NULL OR id != ?)
          AND start_date < ? AND end_date > ?
        LIMIT 1`,
    )
    .bind(listingId, ...BLOCKING_STATUSES, excludeBookingId, excludeBookingId, to, from)
    .first<{ ok: number }>();

  return !!row;
}

/** Booked ranges for the calendar, so the guest never picks a taken week. */
export async function bookedRanges(
  listingId: string,
): Promise<Array<{ from: string; to: string }>> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT start_date, end_date FROM bookings
        WHERE listing_id = ? AND status IN ('pending', 'confirmed')
          AND end_date >= date('now')
        ORDER BY start_date`,
    )
    .bind(listingId)
    .all<{ start_date: string; end_date: string }>();

  return results.map((row) => ({ from: row.start_date, to: row.end_date }));
}

/* -------------------------------------------------------------------------- */
/*  Creating a request                                                         */
/* -------------------------------------------------------------------------- */

export interface BookingRequest {
  listingId: string;
  guestId: string;
  from: string;
  to: string;
  guests: number;
  message: string | null;
}

export type BookingOutcome =
  | { ok: true; id: string; code: string; status: BookingStatus }
  | { ok: false; reason: "missing" | "own_listing" | "dates" | "min_stay" | "conflict" };

/**
 * Re-prices the request on the server from the listing's own row. The quote the
 * guest saw is a preview; this is the number that gets stored, so a tampered
 * form field cannot buy a cheaper lease.
 */
export async function requestBooking(input: BookingRequest): Promise<BookingOutcome> {
  const db = await getDB();

  const listing = await db
    .prepare("SELECT * FROM listings WHERE id = ? AND status = 'published'")
    .bind(input.listingId)
    .first<ListingRow>();

  if (!listing) return { ok: false, reason: "missing" };
  if (listing.host_id === input.guestId) return { ok: false, reason: "own_listing" };

  const priced = quote({
    rentalType: listing.rental_type,
    price: listing.price,
    currency: listing.currency,
    depositMonths: listing.deposit_months,
    minStayMonths: listing.min_stay_months,
    minNights: listing.min_nights,
    from: input.from,
    to: input.to,
  });

  if (!priced.valid) {
    return { ok: false, reason: priced.problem === "min_stay" ? "min_stay" : "dates" };
  }
  if (await hasConflict(input.listingId, input.from, input.to)) {
    return { ok: false, reason: "conflict" };
  }

  return insertBooking(db, listing, input, priced);
}

async function insertBooking(
  db: D1Database,
  listing: ListingRow,
  input: BookingRequest,
  priced: Quote,
): Promise<BookingOutcome> {
  const id = newId("bkg");
  const code = bookingCode();
  // Instant-book listings skip the host's inbox entirely.
  const status: BookingStatus = listing.instant_book === 1 ? "confirmed" : "pending";
  const guests = Math.min(Math.max(1, Math.round(input.guests)), listing.max_guests);

  await db
    .prepare(
      `INSERT INTO bookings (
         id, code, listing_id, guest_id, host_id, start_date, end_date,
         rental_type, units, guests, unit_price, subtotal, service_fee,
         deposit, total, currency, status, guest_message, created_at, responded_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                 datetime('now'), ?)`,
    )
    .bind(
      id,
      code,
      listing.id,
      input.guestId,
      listing.host_id,
      input.from,
      input.to,
      listing.rental_type,
      priced.units,
      guests,
      priced.unitPrice,
      priced.subtotal,
      priced.serviceFee,
      priced.deposit,
      priced.total,
      priced.currency,
      status,
      input.message?.trim() || null,
      status === "confirmed" ? new Date().toISOString() : null,
    )
    .run();

  return { ok: true, id, code, status };
}

/* -------------------------------------------------------------------------- */
/*  Reading                                                                    */
/* -------------------------------------------------------------------------- */

async function bookingsWhere(
  where: string,
  binds: unknown[],
  locale: Locale,
  limit = 100,
): Promise<BookingModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT ${BOOKING_COLUMNS}
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         JOIN users g ON g.id = b.guest_id
         JOIN users h ON h.id = b.host_id
        WHERE ${where}
        ORDER BY CASE b.status WHEN 'pending' THEN 0 ELSE 1 END,
                 b.start_date DESC
        LIMIT ?`,
    )
    .bind(...binds, limit)
    .all<BookingJoinRow>();

  return results.map((row) => toBooking(row, locale));
}

/** The guest's trips. */
export async function guestBookings(
  guestId: string,
  locale: Locale,
): Promise<BookingModel[]> {
  const bookings = await bookingsWhere("b.guest_id = ?", [guestId], locale);
  return withReviewFlags(bookings);
}

/** The host's inbox of requests. */
export async function hostBookings(hostId: string, locale: Locale): Promise<BookingModel[]> {
  return bookingsWhere("b.host_id = ?", [hostId], locale);
}

export async function listingBookings(
  listingId: string,
  hostId: string,
  locale: Locale,
): Promise<BookingModel[]> {
  return bookingsWhere("b.listing_id = ? AND b.host_id = ?", [listingId, hostId], locale);
}

/**
 * Marks which completed trips still owe a review, so the trips page can nudge
 * once and then stop.
 */
async function withReviewFlags(bookings: BookingModel[]): Promise<BookingModel[]> {
  const db = await tryGetDB();
  const finished = bookings.filter((booking) => booking.status === "completed");
  if (!db || finished.length === 0) return bookings;

  const ids = finished.map((booking) => booking.id);
  const { results } = await db
    .prepare(
      `SELECT booking_id FROM reviews
        WHERE booking_id IN (${ids.map(() => "?").join(", ")})`,
    )
    .bind(...ids)
    .all<{ booking_id: string }>();

  const reviewed = new Set(results.map((row) => row.booking_id));
  for (const booking of finished) booking.hasReview = reviewed.has(booking.id);
  return bookings;
}

/** One booking, visible only to the two people in it (or an admin). */
export async function getBooking(
  id: string,
  viewerId: string,
  locale: Locale,
  privileged = false,
): Promise<BookingModel | null> {
  const db = await tryGetDB();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT ${BOOKING_COLUMNS}
         FROM bookings b
         JOIN listings l ON l.id = b.listing_id
         JOIN users g ON g.id = b.guest_id
         JOIN users h ON h.id = b.host_id
        WHERE b.id = ? OR b.code = ?`,
    )
    .bind(id, id)
    .first<BookingJoinRow>();

  if (!row) return null;
  if (!privileged && row.guest_id !== viewerId && row.host_id !== viewerId) return null;
  return toBooking(row, locale);
}

/* -------------------------------------------------------------------------- */
/*  Status transitions                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Who may move a booking where. Encoded as data rather than a pile of ifs
 * because every page that touches a booking needs to ask the same question.
 */
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "declined", "cancelled"],
  confirmed: ["cancelled", "completed"],
  declined: [],
  cancelled: [],
  completed: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export type RespondOutcome =
  | { ok: true }
  | { ok: false; reason: "missing" | "not_allowed" | "conflict" };

/** Host accepts or declines. Accepting re-checks the calendar first. */
export async function respondToBooking(
  bookingId: string,
  hostId: string,
  decision: "confirmed" | "declined",
  note: string | null = null,
): Promise<RespondOutcome> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM bookings WHERE id = ? AND host_id = ?")
    .bind(bookingId, hostId)
    .first<BookingRow>();

  if (!row) return { ok: false, reason: "missing" };
  if (!canTransition(row.status, decision)) return { ok: false, reason: "not_allowed" };

  if (decision === "confirmed") {
    // Another request may have been accepted for the same dates in the meantime.
    if (await hasConflict(row.listing_id, row.start_date, row.end_date, row.id)) {
      return { ok: false, reason: "conflict" };
    }
  }

  await db
    .prepare(
      `UPDATE bookings
          SET status = ?, host_note = ?, responded_at = datetime('now'),
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .bind(decision, note?.trim() || row.host_note, bookingId)
    .run();

  return { ok: true };
}

/** Either side can cancel while the stay has not started. */
export async function cancelBooking(
  bookingId: string,
  userId: string,
): Promise<RespondOutcome> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT * FROM bookings WHERE id = ? AND (guest_id = ? OR host_id = ?)")
    .bind(bookingId, userId, userId)
    .first<BookingRow>();

  if (!row) return { ok: false, reason: "missing" };
  if (!canTransition(row.status, "cancelled")) return { ok: false, reason: "not_allowed" };

  await db
    .prepare(
      `UPDATE bookings SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ?`,
    )
    .bind(bookingId)
    .run();

  return { ok: true };
}

/**
 * Ages confirmed bookings into completed ones once the end date has passed.
 * Called opportunistically when someone opens their trips or dashboard, which
 * is enough without a cron and keeps the review prompt honest.
 */
export async function completeDueBookings(userId: string): Promise<void> {
  const db = await tryGetDB();
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE bookings
            SET status = 'completed', updated_at = datetime('now')
          WHERE status = 'confirmed'
            AND end_date < date('now')
            AND (guest_id = ? OR host_id = ?)`,
      )
      .bind(userId, userId)
      .run();
  } catch {
    // A page render must not fail because of housekeeping.
  }
}

/* -------------------------------------------------------------------------- */
/*  Host dashboard numbers                                                     */
/* -------------------------------------------------------------------------- */

export interface HostStats {
  published: number;
  drafts: number;
  pending: number;
  upcoming: number;
  /** Confirmed and completed value, in the host's own currency. */
  earned: number;
  ratingAvg: number;
  ratingCount: number;
  unread: number;
  views: number;
}

export async function hostStats(hostId: string): Promise<HostStats> {
  const db = await tryGetDB();
  const empty: HostStats = {
    published: 0,
    drafts: 0,
    pending: 0,
    upcoming: 0,
    earned: 0,
    ratingAvg: 0,
    ratingCount: 0,
    unread: 0,
    views: 0,
  };
  if (!db) return empty;

  const [listings, bookings, messages] = await db.batch<Record<string, number | null>>([
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
           SUM(view_count) AS views,
           ROUND(AVG(CASE WHEN rating_count > 0 THEN rating_avg END), 2) AS rating_avg,
           SUM(rating_count) AS rating_count
         FROM listings WHERE host_id = ?`,
      )
      .bind(hostId),
    db
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'confirmed' AND start_date >= date('now') THEN 1 ELSE 0 END)
             AS upcoming,
           SUM(CASE WHEN status IN ('confirmed', 'completed') THEN total ELSE 0 END) AS earned
         FROM bookings WHERE host_id = ?`,
      )
      .bind(hostId),
    db
      .prepare("SELECT SUM(host_unread) AS unread FROM conversations WHERE host_id = ?")
      .bind(hostId),
  ]);

  const pick = (
    result: { results?: Array<Record<string, number | null>> },
    key: string,
  ): number => result.results?.[0]?.[key] ?? 0;

  return {
    published: pick(listings, "published"),
    drafts: pick(listings, "drafts"),
    views: pick(listings, "views"),
    ratingAvg: pick(listings, "rating_avg"),
    ratingCount: pick(listings, "rating_count"),
    pending: pick(bookings, "pending"),
    upcoming: pick(bookings, "upcoming"),
    earned: pick(bookings, "earned"),
    unread: pick(messages, "unread"),
  };
}
