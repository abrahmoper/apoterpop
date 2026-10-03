/**
 * Small helpers shared by the query modules.
 *
 * The bilingual pattern is always the same: prefer the column for the active
 * language, fall back to English, because a host may publish in one language
 * and fill in the other later.
 */
import type { Locale } from "../types";

export function localised(
  en: string | null | undefined,
  am: string | null | undefined,
  locale: Locale,
): string | null {
  if (locale === "am") return (am && am.trim()) || en || null;
  return (en && en.trim()) || am || null;
}

export function localisedRequired(
  en: string,
  am: string | null | undefined,
  locale: Locale,
): string {
  if (locale === "am" && am && am.trim()) return am;
  return en;
}

/** `?, ?, ?` for an IN clause, with the values bound separately. */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

/** Guards against an unbounded IN clause when a page asks for too much. */
export function capped<T>(items: T[], max = 400): T[] {
  return items.length > max ? items.slice(0, max) : items;
}

export function toBool(value: number | null | undefined): boolean {
  return value === 1;
}
