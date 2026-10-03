/**
 * The i18n entry point for client and server alike.
 *
 * `messages.ts` holds every string as an [English, Amharic] tuple — that is the
 * single source of truth. This file just re-exports the pieces pages need so
 * imports stay short: `import { makeT, localeHref } from "@/lib/i18n"`.
 *
 * Nothing here touches `next/headers`, so client components can import it.
 * Server-only helpers (cookies, Accept-Language) live in `./server`.
 */
export {
  LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  isLocale,
  coerceLocale,
  localeFromHeader,
  switchLocalePath,
  localeHref,
  stripLocale,
} from "./config";

export { MESSAGES, translate, makeT } from "./messages";
export type { MessageKey, Translator } from "./messages";

import { translate, type MessageKey, type Translator } from "./messages";
import type { Locale } from "../types";

/**
 * Amharic and English agree on plural shape for everything Kiray shows: one
 * form, or many. Pass the two keys and the count picks between them.
 */
export function plural(
  t: Translator,
  count: number,
  oneKey: MessageKey,
  manyKey: MessageKey,
): string {
  return count === 1 ? t(oneKey, { count }) : t(manyKey, { count });
}

/** One-off translation without building a translator first. */
export function tr(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  return translate(locale, key, vars);
}

/** Picks the right side of a bilingual DB column pair, falling back to English. */
export function pick(
  locale: Locale,
  englishValue: string | null | undefined,
  amharicValue: string | null | undefined,
): string {
  if (locale === "am") return (amharicValue || englishValue || "").trim();
  return (englishValue || amharicValue || "").trim();
}

export type { Locale };
