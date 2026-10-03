/**
 * Authentication: phone or email plus a password, sessions in D1.
 *
 * No third-party auth service and no secret to configure. Passwords are stored
 * as PBKDF2-SHA256 with a per-user salt; the session cookie holds a random
 * token whose SHA-256 is what actually lands in the database, so a leaked table
 * dump cannot be replayed as a login.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getDB, tryGetDB } from "./cf";
import { coerceLocale } from "./i18n/config";
import { localeHref } from "./i18n/server";
import type { Locale, SessionUser, UserRow } from "./types";
import { newId } from "./utils";

export const SESSION_COOKIE = "kiray_session";
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;
const HASH_PREFIX = "pbkdf2";

/* -------------------------------------------------------------------------- */
/*  Encoding helpers                                                           */
/* -------------------------------------------------------------------------- */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* -------------------------------------------------------------------------- */
/*  Passwords                                                                  */
/* -------------------------------------------------------------------------- */

async function derive(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
}

/** Returns `pbkdf2$<iterations>$<salt>$<hash>`, all base64. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await derive(password, salt);
  return [HASH_PREFIX, PBKDF2_ITERATIONS, toBase64(salt), toBase64(new Uint8Array(bits))].join(
    "$",
  );
}

/** Constant-time comparison so a wrong password cannot be timed character by character. */
function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== HASH_PREFIX) return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1000) return false;

  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64(parts[2]);
    expected = fromBase64(parts[3]);
  } catch {
    // A corrupted hash must read as "wrong password", not crash sign-in.
    return false;
  }
  if (expected.length === 0) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations, hash: "SHA-256" },
    key,
    expected.length * 8,
  );

  return equalBytes(new Uint8Array(bits), expected);
}

/* -------------------------------------------------------------------------- */
/*  Identifiers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Ethiopian mobile numbers get written every possible way: 0911234567,
 * +251911234567, 251911234567, 0911 23 45 67. All of them normalise to
 * +2519XXXXXXXX so one person cannot end up with three accounts.
 */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let local: string;
  if (digits.startsWith("+251")) local = digits.slice(4);
  else if (digits.startsWith("251")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;

  // Accounts are phone-based, so only mobiles: 9 (Ethio Telecom) and
  // 7 (Safaricom). Landlines (1-5) cannot receive a verification SMS.
  if (!/^[79]\d{8}$/.test(local)) return null;
  return `+251${local}`;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

export type Identifier =
  | { kind: "phone"; value: string }
  | { kind: "email"; value: string }
  | { kind: "invalid" };

/** Works out whether someone typed a phone number or an email address. */
export function parseIdentifier(raw: string): Identifier {
  const value = raw.trim();
  if (!value) return { kind: "invalid" };

  if (value.includes("@")) {
    return isEmail(value) ? { kind: "email", value: normaliseEmail(value) } : { kind: "invalid" };
  }

  const phone = normalisePhone(value);
  return phone ? { kind: "phone", value: phone } : { kind: "invalid" };
}

/** Lives in ./utils (no server imports) so client components can format numbers too. */
export { formatPhone } from "./utils";

/* -------------------------------------------------------------------------- */
/*  Sessions                                                                   */
/* -------------------------------------------------------------------------- */

async function tokenToId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return toHex(digest);
}

function newToken(): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Creates the session row and sets the cookie. Called from server actions. */
export async function createSession(userId: string, userAgent?: string | null): Promise<void> {
  const db = await getDB();
  const token = newToken();
  const id = await tokenToId(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)")
    .bind(id, userId, expires.toISOString(), userAgent?.slice(0, 200) ?? null)
    .run();

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    const db = await tryGetDB();
    if (db) {
      await db.prepare("DELETE FROM sessions WHERE id = ?").bind(await tokenToId(token)).run();
    }
  }

  store.delete(SESSION_COOKIE);
}

/** Housekeeping — cheap enough to run opportunistically on sign-in. */
export async function pruneExpiredSessions(): Promise<void> {
  const db = await tryGetDB();
  if (!db) return;
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

/* -------------------------------------------------------------------------- */
/*  Reading the current user                                                   */
/* -------------------------------------------------------------------------- */

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatarKey: row.avatar_key,
    bio: row.bio,
    locale: coerceLocale(row.locale),
    isHost: row.is_host === 1,
    isAdmin: row.is_admin === 1,
    city: row.city,
    responseRate: row.response_rate,
    createdAt: row.created_at,
  };
}

/**
 * Memoised for the lifetime of one request, so a page, its layout and three
 * components can all ask "who is signed in?" and it costs a single query.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await tryGetDB();
  if (!db) return null;

  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s
        JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > datetime('now')`,
    )
    .bind(await tokenToId(token))
    .first<UserRow>();

  return row ? toSessionUser(row) : null;
});

export async function isSignedIn(): Promise<boolean> {
  return (await getSessionUser()) !== null;
}

/* -------------------------------------------------------------------------- */
/*  Guards                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Redirects to the sign-in page, carrying the current path so the person lands
 * back where they were trying to go.
 */
export async function requireUser(locale: Locale, returnTo?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (user) return user;

  const target = returnTo ? `?next=${encodeURIComponent(returnTo)}` : "";
  redirect(`${localeHref(locale, "/signin")}${target}`);
}

export async function requireHost(locale: Locale, returnTo?: string): Promise<SessionUser> {
  const user = await requireUser(locale, returnTo);
  if (user.isHost) return user;

  // Anyone can become a host; flipping the flag is friendlier than a dead end.
  const db = await getDB();
  await db
    .prepare("UPDATE users SET is_host = 1, updated_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  return { ...user, isHost: true };
}

export async function requireAdmin(locale: Locale): Promise<SessionUser> {
  const user = await requireUser(locale, "/admin");
  if (!user.isAdmin) redirect(localeHref(locale, "/"));
  return user;
}

/* -------------------------------------------------------------------------- */
/*  Lookups used by sign-in and sign-up                                        */
/* -------------------------------------------------------------------------- */

export async function findUserByIdentifier(identifier: Identifier): Promise<UserRow | null> {
  if (identifier.kind === "invalid") return null;
  const db = await getDB();
  const column = identifier.kind === "email" ? "email" : "phone";

  return db
    .prepare(`SELECT * FROM users WHERE ${column} = ? LIMIT 1`)
    .bind(identifier.value)
    .first<UserRow>();
}

export interface NewUserInput {
  fullName: string;
  phone: string | null;
  email: string | null;
  password: string;
  locale: Locale;
  isHost: boolean;
  city?: string | null;
}

export async function createUser(input: NewUserInput): Promise<UserRow> {
  const db = await getDB();
  const id = newId("usr");
  const passwordHash = await hashPassword(input.password);

  await db
    .prepare(
      `INSERT INTO users (id, full_name, email, phone, password_hash, locale, is_host, city)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.fullName,
      input.email,
      input.phone,
      passwordHash,
      input.locale,
      input.isHost ? 1 : 0,
      input.city ?? null,
    )
    .run();

  const row = await db.prepare("SELECT * FROM users WHERE id = ?").bind(id).first<UserRow>();
  if (!row) throw new Error("User row vanished immediately after insert");
  return row;
}
