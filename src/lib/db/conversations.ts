/**
 * Messaging.
 *
 * One conversation per guest–host–listing triple, so asking about two different
 * homes does not collapse into one confusing thread. Unread counts are kept on
 * the conversation row rather than derived, because "do I have messages" is
 * asked on every page load and must not cost a scan of the messages table.
 */
import { getDB, tryGetDB } from "../cf";
import { listingPlaceholder } from "../photos";
import type {
  ConversationModel,
  ConversationRow,
  Locale,
  MessageRow,
} from "../types";
import { newId, truncate } from "../utils";
import { localisedRequired } from "./shared";

type ConversationJoinRow = ConversationRow & {
  listing_title_en: string | null;
  listing_title_am: string | null;
  listing_photo: string | null;
  guest_name: string;
  guest_avatar_key: string | null;
  host_name: string;
  host_avatar_key: string | null;
};

const CONVERSATION_COLUMNS = `
  c.*,
  l.title_en AS listing_title_en, l.title_am AS listing_title_am,
  (SELECT key FROM listing_photos WHERE listing_id = c.listing_id
    ORDER BY sort_order LIMIT 1) AS listing_photo,
  g.full_name AS guest_name, g.avatar_key AS guest_avatar_key,
  h.full_name AS host_name, h.avatar_key AS host_avatar_key
`;

const CONVERSATION_JOINS = `
  FROM conversations c
  LEFT JOIN listings l ON l.id = c.listing_id
  JOIN users g ON g.id = c.guest_id
  JOIN users h ON h.id = c.host_id
`;

/** The model is written from the viewer's side: "the other person", not "host". */
function toConversation(
  row: ConversationJoinRow,
  viewerId: string,
  locale: Locale,
): ConversationModel {
  const asGuest = row.guest_id === viewerId;

  return {
    ...row,
    otherId: asGuest ? row.host_id : row.guest_id,
    otherName: asGuest ? row.host_name : row.guest_name,
    otherAvatarKey: asGuest ? row.host_avatar_key : row.guest_avatar_key,
    listingTitle:
      row.listing_title_en === null
        ? null
        : localisedRequired(row.listing_title_en, row.listing_title_am, locale),
    listingPhoto:
      row.listing_id === null
        ? null
        : (row.listing_photo ?? listingPlaceholder(row.listing_id, 0)),
    unread: asGuest ? row.guest_unread : row.host_unread,
    role: asGuest ? "guest" : "host",
  };
}

/* -------------------------------------------------------------------------- */
/*  Inbox                                                                      */
/* -------------------------------------------------------------------------- */

export async function inbox(
  viewerId: string,
  locale: Locale,
  limit = 60,
): Promise<ConversationModel[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT ${CONVERSATION_COLUMNS}
       ${CONVERSATION_JOINS}
        WHERE c.guest_id = ? OR c.host_id = ?
        ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
        LIMIT ?`,
    )
    .bind(viewerId, viewerId, limit)
    .all<ConversationJoinRow>();

  return results.map((row) => toConversation(row, viewerId, locale));
}

/** Total unread across every thread — the dot on the header icon. */
export async function unreadCount(viewerId: string): Promise<number> {
  const db = await tryGetDB();
  if (!db) return 0;
  const row = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN guest_id = ? THEN guest_unread ELSE 0 END), 0)
       + COALESCE(SUM(CASE WHEN host_id = ? THEN host_unread ELSE 0 END), 0) AS n
       FROM conversations
       WHERE guest_id = ? OR host_id = ?`,
    )
    .bind(viewerId, viewerId, viewerId, viewerId)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function getConversation(
  id: string,
  viewerId: string,
  locale: Locale,
): Promise<ConversationModel | null> {
  const db = await tryGetDB();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT ${CONVERSATION_COLUMNS}
       ${CONVERSATION_JOINS}
        WHERE c.id = ? AND (c.guest_id = ? OR c.host_id = ?)`,
    )
    .bind(id, viewerId, viewerId)
    .first<ConversationJoinRow>();

  return row ? toConversation(row, viewerId, locale) : null;
}

/* -------------------------------------------------------------------------- */
/*  One thread                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Messages oldest-first so the page reads downwards like a chat. The join to
 * conversations is not decoration: it is the permission check, so a guessed
 * thread id returns nothing rather than someone else's conversation.
 */
export async function threadMessages(
  conversationId: string,
  viewerId: string,
  limit = 200,
): Promise<MessageRow[]> {
  const db = await tryGetDB();
  if (!db) return [];

  const { results } = await db
    .prepare(
      `SELECT m.* FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
        WHERE m.conversation_id = ?
          AND (c.guest_id = ? OR c.host_id = ?)
        ORDER BY m.created_at
        LIMIT ?`,
    )
    .bind(conversationId, viewerId, viewerId, limit)
    .all<MessageRow>();

  return results;
}

/**
 * Clears only the viewer's half of the counter. Naming the viewer on both
 * branches means a guest opening a thread cannot wipe the host's badge.
 */
export async function markRead(conversationId: string, viewerId: string): Promise<void> {
  const db = await tryGetDB();
  if (!db) return;
  try {
    await db
      .prepare(
        `UPDATE conversations
            SET guest_unread = CASE WHEN guest_id = ? THEN 0 ELSE guest_unread END,
                host_unread  = CASE WHEN host_id  = ? THEN 0 ELSE host_unread  END
          WHERE id = ? AND (guest_id = ? OR host_id = ?)`,
      )
      .bind(viewerId, viewerId, conversationId, viewerId, viewerId)
      .run();
  } catch {
    // Opening a thread must not fail because of bookkeeping.
  }
}

/* -------------------------------------------------------------------------- */
/*  Writing                                                                    */
/* -------------------------------------------------------------------------- */

export interface ThreadKey {
  guestId: string;
  hostId: string;
  listingId: string | null;
  bookingId?: string | null;
}

const THREAD_LOOKUP = `
  SELECT id FROM conversations
   WHERE guest_id = ? AND host_id = ?
     AND ((? IS NULL AND listing_id IS NULL) OR listing_id = ?)
   LIMIT 1
`;

/**
 * Finds the thread for a guest–host–listing triple, or opens it. SQLite counts
 * NULLs as distinct in a unique index, so listing-less threads are matched with
 * an explicit IS NULL branch instead of leaning on the constraint. The insert
 * ignores conflicts and then re-reads, which means two taps on "Message host" in
 * the same second end up in one thread rather than two.
 */
export async function ensureConversation(key: ThreadKey): Promise<string> {
  const db = await getDB();
  const lookup = db
    .prepare(THREAD_LOOKUP)
    .bind(key.guestId, key.hostId, key.listingId, key.listingId);

  const found = await lookup.first<{ id: string }>();
  if (found) return found.id;

  const id = newId("cnv");
  await db
    .prepare(
      `INSERT INTO conversations (id, listing_id, booking_id, guest_id, host_id, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT DO NOTHING`,
    )
    .bind(id, key.listingId, key.bookingId ?? null, key.guestId, key.hostId)
    .run();

  const settled = await lookup.first<{ id: string }>();

  return settled?.id ?? id;
}

export const MAX_MESSAGE_LENGTH = 2000;

export type MessageOutcome =
  | { ok: true; conversationId: string; messageId: string }
  | { ok: false; reason: "empty" | "not_allowed" };

/**
 * One batch writes the message, the preview shown in the inbox, and the other
 * side's unread counter. They succeed or fail together — a message that lands
 * without bumping the badge is a message nobody answers.
 */
export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<MessageOutcome> {
  const db = await getDB();
  const body = input.body.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!body) return { ok: false, reason: "empty" };

  const thread = await db
    .prepare(
      `SELECT id, guest_id, host_id FROM conversations
        WHERE id = ? AND (guest_id = ? OR host_id = ?)`,
    )
    .bind(input.conversationId, input.senderId, input.senderId)
    .first<{ id: string; guest_id: string; host_id: string }>();

  if (!thread) return { ok: false, reason: "not_allowed" };

  const messageId = newId("msg");
  const fromGuest = thread.guest_id === input.senderId;

  await db.batch([
    db
      .prepare(
        `INSERT INTO messages (id, conversation_id, sender_id, body, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`,
      )
      .bind(messageId, thread.id, input.senderId, body),
    db
      .prepare(
        `UPDATE conversations
            SET last_message = ?, last_message_at = datetime('now'),
                guest_unread = guest_unread + ?,
                host_unread = host_unread + ?
          WHERE id = ?`,
      )
      .bind(truncate(body, 120), fromGuest ? 0 : 1, fromGuest ? 1 : 0, thread.id),
  ]);

  return { ok: true, conversationId: thread.id, messageId };
}

/** Opens the thread if it does not exist yet and posts the first line. */
export async function startThread(
  input: ThreadKey & { senderId: string; body: string },
): Promise<MessageOutcome> {
  if (input.senderId !== input.guestId && input.senderId !== input.hostId) {
    return { ok: false, reason: "not_allowed" };
  }
  if (input.guestId === input.hostId) return { ok: false, reason: "not_allowed" };
  if (!input.body.trim()) return { ok: false, reason: "empty" };

  const conversationId = await ensureConversation(input);
  return sendMessage({ conversationId, senderId: input.senderId, body: input.body });
}
