"use server";

/**
 * Booking server actions.
 *
 * Every rule is enforced here, never on the client: dates are validated,
 * prices are re-derived from the listing row, and ownership checks happen
 * before anything is written. Failures come back as message keys so the
 * widget can speak the visitor's language.
 */
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import {
  cancelBooking,
  requestBooking,
  respondToBooking,
} from "@/lib/db/bookings";
import { coerceLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import type { BookingStatus } from "@/lib/types";
import { field } from "@/lib/utils";

export interface BookingFormState {
  ok?: boolean;
  error?: MessageKey;
  code?: string;
  status?: BookingStatus;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Yesterday in UTC. One day of slack so a visitor west of UTC picking their
 * local "today" is never rejected, while genuinely past dates still are.
 */
function earliestStart(): string {
  return new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

/** A guest asks for a stay. The widget shows the outcome in place. */
export async function requestBookingAction(
  _prev: BookingFormState,
  form: FormData,
): Promise<BookingFormState> {
  const user = await requireUser(coerceLocale(field(form, "locale")), field(form, "returnTo"));

  const listingId = field(form, "listingId");
  const from = field(form, "from");
  const to = field(form, "to");
  const guests = Number(field(form, "guests")) || 1;
  const message = field(form, "message").slice(0, 2000) || null;

  if (!listingId) return { error: "error.generic" };
  if (!from || !to || !DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return { error: "error.datesRequired" };
  }
  if (to <= from) return { error: "error.datesOrder" };
  if (from < earliestStart()) return { error: "error.datesPast" };

  const outcome = await requestBooking({ listingId, guestId: user.id, from, to, guests, message });

  if (!outcome.ok) {
    const reasons: Record<typeof outcome.reason, MessageKey> = {
      missing: "error.notFound",
      own_listing: "error.ownListing",
      dates: "error.datesOrder",
      min_stay: "error.minStay",
      conflict: "error.datesTaken",
    };
    return { error: reasons[outcome.reason] };
  }

  revalidatePath("/[locale]/trips", "page");
  revalidatePath("/[locale]/host", "page");
  revalidatePath("/", "layout");

  return { ok: true, code: outcome.code, status: outcome.status };
}

/** The host accepts or declines a request. */
export async function respondBookingAction(
  bookingId: string,
  decision: "confirmed" | "declined",
  note?: string,
  locale: string = "en",
): Promise<{ ok: boolean; error?: MessageKey }> {
  const user = await requireUser(coerceLocale(locale), "/host");
  if (!user.isHost) return { ok: false, error: "error.notAllowed" };
  if (decision !== "confirmed" && decision !== "declined") {
    return { ok: false, error: "error.notAllowed" };
  }

  const outcome = await respondToBooking(bookingId, user.id, decision, note?.slice(0, 1000) ?? null);
  if (!outcome.ok) {
    const reasons: Record<typeof outcome.reason, MessageKey> = {
      missing: "error.notFound",
      not_allowed: "error.notAllowed",
      conflict: "error.datesTaken",
    };
    return { ok: false, error: reasons[outcome.reason] };
  }

  revalidatePath("/[locale]/host", "page");
  revalidatePath("/[locale]/trips", "page");
  return { ok: true };
}

/** Either side cancels while the stay has not started. */
export async function cancelBookingAction(
  bookingId: string,
  locale: string = "en",
): Promise<{ ok: boolean; error?: MessageKey }> {
  const user = await requireUser(coerceLocale(locale), "/trips");

  const outcome = await cancelBooking(bookingId, user.id);
  if (!outcome.ok) {
    const reasons: Record<typeof outcome.reason, MessageKey> = {
      missing: "error.notFound",
      not_allowed: "error.notAllowed",
      conflict: "error.datesTaken",
    };
    return { ok: false, error: reasons[outcome.reason] };
  }

  revalidatePath("/[locale]/trips", "page");
  revalidatePath("/[locale]/host", "page");
  return { ok: true };
}
