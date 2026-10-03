"use server";

/**
 * Review actions.
 *
 * Eligibility lives in the queries layer — a completed booking is required and
 * the author must be its guest — so the form cannot fabricate a review. Host
 * replies are restricted to the listing's owner by the UPDATE's own WHERE.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createReview, replyToReview } from "@/lib/db/reviews";
import type { MessageKey } from "@/lib/i18n/messages";
import { field } from "@/lib/utils";

export interface ReviewFormState {
  ok?: boolean;
  error?: MessageKey;
}

function subscore(form: FormData, key: string): number | null {
  const value = Number(field(form, key));
  return Number.isFinite(value) && value >= 1 && value <= 5 ? value : null;
}

/** A guest rates the stay; aggregates are rebuilt in the same write. */
export async function submitReviewAction(
  _prev: ReviewFormState,
  form: FormData,
): Promise<ReviewFormState> {
  const user = await requireUser("en", "/trips");

  const listingId = field(form, "listingId");
  const bookingId = field(form, "bookingId") || null;
  const rating = Number(field(form, "rating"));

  if (!listingId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    return { error: "review.ratingRequired" };
  }

  const outcome = await createReview({
    listingId,
    authorId: user.id,
    bookingId,
    rating,
    cleanliness: subscore(form, "cleanliness"),
    accuracy: subscore(form, "accuracy"),
    location: subscore(form, "location"),
    value: subscore(form, "value"),
    communication: subscore(form, "communication"),
    comment: field(form, "comment") || null,
  });

  if (!outcome.ok) {
    return { error: outcome.reason === "not_eligible" ? "error.notAllowed" : "error.generic" };
  }

  revalidatePath("/[locale]/listing/[id]", "page");
  revalidatePath("/[locale]/trips", "page");
  return { ok: true };
}

/** The host answers one review, editing in place. */
export async function replyReviewAction(
  reviewId: string,
  reply: string,
): Promise<{ ok: boolean; error?: MessageKey }> {
  const user = await requireUser("en", "/host");
  if (!user.isHost) return { ok: false, error: "error.notAllowed" };

  const updated = await replyToReview(reviewId, user.id, reply);
  if (!updated) return { ok: false, error: "error.notAllowed" };

  revalidatePath("/[locale]/listing/[id]", "page");
  revalidatePath("/[locale]/host", "page");
  return { ok: true };
}
