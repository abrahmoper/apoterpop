/**
 * Shared, dependency-free helpers.
 *
 * This module is imported by both server and client code — including the
 * pricing math — so it must never touch `next/headers`, the D1 bindings or any
 * other server-only API. Anything that needs the runtime belongs in `./cf`.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** The one class-name joiner every component uses. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/*  Identity                                                                    */
/* -------------------------------------------------------------------------- */

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Prefixed, roughly sortable ids for primary keys. The timestamp keeps rows
 * that matter together on disk; the random tail makes collisions a non-event.
 */
export function newId(prefix: string): string {
  let tail = "";
  const random = crypto.getRandomValues(new Uint8Array(10));
  for (const byte of random) tail += ID_ALPHABET[byte % ID_ALPHABET.length];
  return `${prefix}_${Date.now().toString(36)}${tail}`;
}

/** "Abebe Kebede" -> "AK", for avatar fallbacks. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/* -------------------------------------------------------------------------- */
/*  Data                                                                        */
/* -------------------------------------------------------------------------- */

/** Parses a stored JSON column, falling back when it is empty or malformed. */
export function safeJSON<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Shortens for previews; the ellipsis is part of the deal. */
export function truncate(value: string, max: number): string {
  const clean = value.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/*  Dates                                                                       */
/* -------------------------------------------------------------------------- */

/** UTC-safe midnight, so "2025-01-01" never shifts by a timezone. */
function dayStart(date: string): number {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(parsed) ? parsed : NaN;
}

const DAYS_PER_MONTH = 30.4375;

/** Nights for a stay: check-in to check-out, exclusive of the last day. */
export function nightsBetween(from: string, to: string): number {
  const start = dayStart(from);
  const end = dayStart(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const nights = Math.round((end - start) / 86_400_000);
  return nights > 0 ? nights : 0;
}

/**
 * Months for a lease. Calendar months drift by a few days, so the difference
 * is measured against the mean month and snapped to the nearest quarter —
 * Jan 1 to Apr 1 reads as 3, not 2.98.
 */
export function monthsBetween(from: string, to: string): number {
  const start = dayStart(from);
  const end = dayStart(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  const months = (end - start) / 86_400_000 / DAYS_PER_MONTH;
  if (months <= 0) return 0;
  return Math.round(months * 4) / 4;
}

/* -------------------------------------------------------------------------- */
/*  FormData                                                                    */
/* -------------------------------------------------------------------------- */

/** A trimmed string from a form; non-string entries count as empty. */
export function field(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

/** Checkbox/radio/hidden flags accept several spellings of yes. */
export function boolField(form: FormData, key: string): boolean {
  const value = field(form, key).toLowerCase();
  return value === "on" || value === "1" || value === "true" || value === "yes";
}

/**
 * True only for same-site paths. Rejects protocol-relative URLs ("//evil.com"),
 * backslash tricks ("/\\evil.com", which browsers treat as "//") and control
 * characters (the URL parser strips tabs/newlines, turning "/\t/x" into "//x").
 */
export function isSafeRedirectPath(raw: unknown): raw is string {
  if (typeof raw !== "string" || !raw.startsWith("/")) return false;
  if (raw.startsWith("//") || raw.includes("\\")) return false;
  // eslint-disable-next-line no-control-regex
  return !/[\u0000-\u001f\u007f]/.test(raw);
}

/* -------------------------------------------------------------------------- */
/*  Phones                                                                      */
/* -------------------------------------------------------------------------- */

/** "+251911234567" -> "0911 234 567", which is how people read it back. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const match = /^\+251(\d{9})$/.exec(phone);
  if (!match) return phone;
  const d = match[1];
  return `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/* -------------------------------------------------------------------------- */
/*  Formatting                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Money in the listing's own currency. Birr gets no decimals — kobo accounts
 * for nothing in a rent — but other currencies keep their usual shape.
 */
export function formatMoney(amount: number, currency = "ETB"): string {
  const fractionDigits = currency === "ETB" ? 0 : 2;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("en")} ${currency}`;
  }
}

/** Compact distance: 350 m under a kilometre, else 2.4 km. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** "2025-06-01" -> "Jun 1, 2025", without trusting the local timezone. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "";
  const parsed = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return date;
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}
