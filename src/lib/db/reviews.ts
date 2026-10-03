/**
 * Review queries.
 *
 * Only a guest who actually stayed can review, which is enforced here by
 * requiring a completed booking rather than trusted from the page. Writing a
 * review also rewrites the listing's aggregate in the same batch, so the card,
 * the search ranking and the detail page never drift apart.
 */
import { getDB, tryGetDB } from "../cf";
import type { ReviewModel, ReviewRow } from "../types";
import { newId } from "../utils";
import { capped, placeholders } from "./shared";

export interface ReviewInput {
  listingId: string;
  authorId: string;
  bookingId: string | null;
  rating: number;
  cleanliness?: number | null;
  accuracy?: number | null;
  location?: number | null;
  value?: number | null;
  communication?: number | null;
  comment: string | null;
}

type ReviewJoinRow = ReviewRow & {
  author_name: string;
  author_avatar_key: string | null;
};

function toReview(row: ReviewJoinRow): ReviewModel {
  return {
    ...row,
    authorName: row.author_name,
    authorAvatarKey: row.author_avatar_key,
  };
}

const clamp5 = (value: number | null | undefined): number | null =>
  value === null || value === undefined
    ? null
    : Math.min(5, Math.max(1, Math.round(value)));

export async function listingReviews(
  listingId: string,
  limit = 20,
  offset = 0,
): Promise<ReviewModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT r.*, u.full_name AS author_name, u.avatar_key AS author_avatar_key
         FROM reviews r
         JOIN users u ON u.id = r.author_id
        WHERE r.listing_id = ?
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?`,
    )
    .bind(listingId, limit, offset)
    .all<ReviewJoinRow>();

  return results.map(toReview);
}

export async function reviewCount(listingId: string): Promise<number> {
  const db = await tryGetDB();
  if (!db) return 0;
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM reviews WHERE listing_id = ?")
    .bind(listingId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

/** Reviews the guest has written, for the "you said" list on their profile. */
export async function authoredReviews(
  authorId: string,
  limit = 20,
): Promise<ReviewModel[]> {
  const db = await tryGetDB();
  if (!db) return [];
  const { results } = await db
    .prepare(
      `SELECT r.*, u.full_name AS author_name, u.avatar_key AS author_avatar_key
         FROM reviews r
         JOIN users u ON u.id = r.author_id
        WHERE r.author_id = ?
        ORDER BY r.created_at DESC
        LIMIT ?`,
    )
    .bind(authorId, limit)
    .all<ReviewJoinRow>();
  return results.map(toReview);
}

/** Which of these bookings already have a review. */
export async function reviewedBookings(bookingIds: string[]): Promise<Set<string>> {
  const db = await tryGetDB();
  const ids = capped(bookingIds);
  if (!db || ids.length === 0) return new Set();

  const { results } = await db
    .prepare(`SELECT booking_id FROM reviews WHERE booking_id IN (${placeholders(ids.length)})`)
    .bind(...ids)
    .all<{ booking_id: string | null }>();

  return new Set(
    results
      .map((row) => row.booking_id)
      .filter((id): id is string => id !== null),
  );
}

/* -------------------------------------------------------------------------- */
/*  Writing                                                                    */
/* -------------------------------------------------------------------------- */

export type ReviewOutcome =
  | { ok: true; id: string }
  | { ok: false; reason: "not_eligible" | "already_reviewed" };

/**
 * Eligibility is a completed booking on this listing by this author. Without
 * that, a listing's rating is just a comment box, and the whole search ranking
 * downstream of it stops meaning anything.
 */
async function eligibleBooking(
  db: D1Database,
  input: ReviewInput,
): Promise<{ id: string } | null> {
  if (input.bookingId) {
    return db
      .prepare(
        `SELECT id FROM bookings
          WHERE id = ? AND listing_id = ? AND guest_id = ? AND status = 'completed'`,
      )
      .bind(input.bookingId, input.listingId, input.authorId)
      .first<{ id: string }>();
  }

  return db
    .prepare(
      `SELECT id FROM bookings
        WHERE listing_id = ? AND guest_id = ? AND status = 'completed'
        ORDER BY end_date DESC LIMIT 1`,
    )
    .bind(input.listingId, input.authorId)
    .first<{ id: string }>();
}

export async function createReview(input: ReviewInput): Promise<ReviewOutcome> {
  const db = await getDB();

  const booking = await eligibleBooking(db, input);
  if (!booking) return { ok: false, reason: "not_eligible" };

  const existing = await db
    .prepare("SELECT id FROM reviews WHERE booking_id = ?")
    .bind(booking.id)
    .first<{ id: string }>();
  if (existing) return { ok: false, reason: "already_reviewed" };

  const id = newId("rev");
  const rating = Math.min(5, Math.max(1, Math.round(input.rating)));

  await db.batch([
    db
      .prepare(
        `INSERT INTO reviews (
           id, listing_id, author_id, booking_id, rating, cleanliness, accuracy,
           location_score, value_score, communication, comment, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(
        id,
        input.listingId,
        input.authorId,
        booking.id,
        rating,
        clamp5(input.cleanliness),
        clamp5(input.accuracy),
        clamp5(input.location),
        clamp5(input.value),
        clamp5(input.communication),
        input.comment?.trim() || null,
      ),
    aggregateStatement(db, input.listingId),
  ]);

  return { ok: true, id };
}

/** Recomputes the denormalised rating on the listing row. */
function aggregateStatement(db: D1Database, listingId: string): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE listings SET
         rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE listing_id = ?), 0),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE listing_id = ?)
       WHERE id = ?`,
    )
    .bind(listingId, listingId, listingId);
}

/** The host's public answer. One reply per review, editable in place. */
export async function replyToReview(
  reviewId: string,
  hostId: string,
  reply: string,
): Promise<boolean> {
  const db = await getDB();
  const result = await db
    .prepare(
      `UPDATE reviews SET host_reply = ?
        WHERE id = ?
          AND listing_id IN (SELECT id FROM listings WHERE host_id = ?)`,
    )
    .bind(reply.trim() || null, reviewId, hostId)
    .run();

  return (result.meta?.changes ?? 0) > 0;
}

/** Admin removal, aggregate rebuilt so the rating does not lie afterwards. */
export async function deleteReview(reviewId: string): Promise<void> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT listing_id FROM reviews WHERE id = ?")
    .bind(reviewId)
    .first<{ listing_id: string }>();
  if (!row) return;

  await db.batch([
    db.prepare("DELETE FROM reviews WHERE id = ?").bind(reviewId),
    aggregateStatement(db, row.listing_id),
  ]);
}
