"use server";

/**
 * Favourites.
 *
 * One toggle action, optimistically rendered on the client: the returned
 * boolean is the truth, so a failed save cannot leave a heart that lies.
 * Signed-out callers get `signedOut: true` back instead of a redirect throw,
 * so the client can send them to sign-in and return them to the same page.
 */
import { revalidatePath } from "next/cache";

import { getSessionUser } from "@/lib/auth";
import { toggleFavorite } from "@/lib/db/listings";
import { getDB } from "@/lib/cf";

export interface FavoriteResult {
  ok: boolean;
  saved: boolean;
  signedOut?: boolean;
}

/** Flips saved state and reports the new one. */
export async function toggleFavoriteAction(listingId: string): Promise<FavoriteResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, saved: false, signedOut: true };

  // Refuse ids that do not point at a real listing, so a tampered call cannot
  // fill the favorites table with ghosts.
  const db = await getDB();
  const exists = await db
    .prepare("SELECT 1 AS ok FROM listings WHERE id = ? AND status = 'published'")
    .bind(listingId)
    .first<{ ok: number }>();
  if (!exists) return { ok: false, saved: false };

  const saved = await toggleFavorite(user.id, listingId);

  revalidatePath("/[locale]/favorites", "page");
  return { ok: true, saved };
}
