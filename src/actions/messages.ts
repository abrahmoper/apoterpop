"use server";

/**
 * Messaging actions.
 *
 * Threads are keyed by guest–host–listing, so "Message host" from the same
 * listing twice always lands in the same conversation. After sending, the
 * guest is dropped into the thread itself.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { sendMessage, startThread } from "@/lib/db/conversations";
import { coerceLocale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/types";
import { field } from "@/lib/utils";

export type MessageResult = { ok: true } | { ok: false; error: MessageKey };

/** First message on a listing — opens the thread if needed, then redirects. */
export async function startThreadAction(form: FormData): Promise<void> {
  const locale: Locale = coerceLocale(field(form, "locale"));
  const user = await requireUser(locale, field(form, "returnTo") || undefined);

  const hostId = field(form, "hostId");
  const listingId = field(form, "listingId") || null;
  const body = field(form, "body");

  const outcome = await startThread({
    guestId: user.id,
    hostId,
    listingId,
    senderId: user.id,
    body,
  });

  if (!outcome.ok) {
    redirect(
      `${localeHref(locale, `/listing/${listingId ?? ""}`)}?message=${outcome.reason === "empty" ? "empty" : "not_allowed"}`,
    );
  }

  revalidatePath("/[locale]/messages", "page");
  redirect(`${localeHref(locale, "/messages")}?c=${outcome.conversationId}`);
}

/** A reply inside an open thread. The client clears the box on ok. */
export async function sendMessageAction(
  conversationId: string,
  body: string,
): Promise<MessageResult> {
  const user = await requireUser("en", "/messages");

  const outcome = await sendMessage({ conversationId, senderId: user.id, body });
  if (!outcome.ok) {
    return { ok: false, error: outcome.reason === "empty" ? "error.messageEmpty" : "error.notAllowed" };
  }

  revalidatePath("/[locale]/messages", "page");
  return { ok: true };
}
