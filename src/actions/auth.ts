"use server";

/**
 * Auth server actions: phone number + password.
 *
 * Validation happens here, not in the browser, and every failure comes back as a
 * message *key* rather than an English sentence, so the client can translate it.
 * The submitted values (never the password) are echoed back so a failed attempt
 * does not wipe the form.
 *
 * `redirect()` works by throwing, so it always sits after the checks.
 */
import { redirect } from "next/navigation";
import { headers } from "next/headers";

import {
  createSession,
  createUser,
  destroySession,
  findUserByIdentifier,
  getSessionUser,
  hashPassword,
  normalisePhone,
  pruneExpiredSessions,
  verifyPassword,
} from "@/lib/auth";
import { getDB } from "@/lib/cf";
import { coerceLocale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import { localeHref } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";
import { boolField, field, isSafeRedirectPath } from "@/lib/utils";

export interface AuthValues {
  phone?: string;
  fullName?: string;
  isHost?: boolean;
}

export interface AuthState {
  /** A MessageKey the form translates, or undefined when nothing is wrong. */
  error?: MessageKey;
  /** What the person typed, so the form can be refilled after an error. */
  values?: AuthValues;
}

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const MAX_NAME = 80;

/** Only ever follow a same-site path, so `?next=` cannot become an open redirect. */
function safeNext(raw: string, locale: Locale, fallbackPath = "/"): string {
  return isSafeRedirectPath(raw) ? raw : localeHref(locale, fallbackPath);
}

async function userAgent(): Promise<string | null> {
  const store = await headers();
  return store.get("user-agent");
}

export async function signInAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = coerceLocale(field(form, "locale"));
  const rawPhone = field(form, "phone");
  const password = field(form, "password");
  const values: AuthValues = { phone: rawPhone };

  if (!rawPhone) return { error: "error.phoneRequired", values };
  const phone = normalisePhone(rawPhone);
  if (!phone) return { error: "error.invalidPhone", values };
  if (!password) return { error: "error.required", values };
  if (password.length > MAX_PASSWORD) return { error: "error.badCredentials", values };

  const row = await findUserByIdentifier({ kind: "phone", value: phone });

  // Same message whether the account is missing or the password is wrong, and
  // the same PBKDF2 cost too: otherwise response time alone would reveal which
  // numbers have accounts.
  if (!row) {
    await hashPassword(password);
    return { error: "error.badCredentials", values };
  }
  if (!(await verifyPassword(password, row.password_hash))) {
    return { error: "error.badCredentials", values };
  }

  await createSession(row.id, await userAgent());
  await pruneExpiredSessions();

  redirect(safeNext(field(form, "next"), locale));
}

export async function signUpAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const locale = coerceLocale(field(form, "locale"));
  const fullName = field(form, "fullName").replace(/\s+/g, " ");
  const rawPhone = field(form, "phone");
  const password = field(form, "password");
  const confirm = field(form, "confirmPassword");
  const wantsHost = boolField(form, "isHost");
  const values: AuthValues = { fullName, phone: rawPhone, isHost: wantsHost };

  if (fullName.length < 2 || fullName.length > MAX_NAME) {
    return { error: "error.nameRequired", values };
  }
  if (!rawPhone) return { error: "error.phoneRequired", values };

  const phone = normalisePhone(rawPhone);
  if (!phone) return { error: "error.invalidPhone", values };

  if (password.length < MIN_PASSWORD) return { error: "error.passwordShort", values };
  if (password.length > MAX_PASSWORD) return { error: "error.passwordLong", values };
  if (confirm !== password) return { error: "error.passwordMismatch", values };

  const db = await getDB();
  const clash = await db
    .prepare("SELECT id FROM users WHERE phone = ? LIMIT 1")
    .bind(phone)
    .first<{ id: string }>();
  if (clash) return { error: "error.accountExists", values };

  let userId: string;
  try {
    const created = await createUser({
      fullName,
      phone,
      email: null,
      password,
      locale,
      isHost: wantsHost,
      city: field(form, "city") || null,
    });
    userId = created.id;
  } catch (err) {
    // Two sign-ups racing for one number: the UNIQUE index decides.
    if (err instanceof Error && /UNIQUE/i.test(err.message)) {
      return { error: "error.accountExists", values };
    }
    throw err;
  }

  await createSession(userId, await userAgent());

  redirect(safeNext(field(form, "next"), locale, wantsHost ? "/host" : "/"));
}

export async function signOutAction(locale: Locale): Promise<void> {
  await destroySession();
  redirect(localeHref(coerceLocale(locale), "/"));
}

/**
 * Turns hosting on for an existing account. The mode switch calls this before it
 * navigates, so someone can go from renting to hosting without a second form.
 */
export async function enableHostingAction(): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user) return { ok: false };
  if (user.isHost) return { ok: true };

  const db = await getDB();
  await db
    .prepare("UPDATE users SET is_host = 1, updated_at = datetime('now') WHERE id = ?")
    .bind(user.id)
    .run();

  return { ok: true };
}

/** Phone number normalisation, exposed so the sign-up form can echo it back. */
export async function previewPhone(raw: string): Promise<string | null> {
  return normalisePhone(raw);
}
