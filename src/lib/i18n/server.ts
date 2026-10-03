/**
 * Server-side locale plumbing.
 *
 * Every page lives under /[locale]/…, so the route segment is the source of
 * truth. The cookie only decides where "/" sends a first-time visitor, and gets
 * refreshed whenever someone uses the language switcher.
 */
import { cookies, headers } from "next/headers";

import type { Locale } from "../types";
import { makeT, type Translator } from "./messages";
import { coerceLocale, isLocale, localeFromHeader, localeHref, LOCALE_COOKIE } from "./config";

export { localeHref };

/** Next 15 hands route params in as a promise. Accept either shape. */
type MaybeParams =
  | { locale?: string | string[] }
  | Promise<{ locale?: string | string[] }>
  | undefined;

export async function resolveLocale(params?: MaybeParams): Promise<Locale> {
  const resolved = params ? await params : undefined;
  const raw = resolved?.locale;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return coerceLocale(value);
}

/** What "/" should redirect to: an explicit choice, else the browser's hint. */
export async function preferredLocale(): Promise<Locale> {
  const store = await cookies();
  const saved = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  const header = await headers();
  return localeFromHeader(header.get("accept-language"));
}

export interface PageI18n {
  locale: Locale;
  t: Translator;
  /** Prefixes a path with the active locale: href("/search") -> "/am/search" */
  href: (path: string) => string;
  /** `lang` attribute value, also used to trigger the Ethiopic font rules. */
  lang: Locale;
}

export function i18nFor(locale: Locale): PageI18n {
  return {
    locale,
    lang: locale,
    t: makeT(locale),
    href: (path: string) => localeHref(locale, path),
  };
}

/** The one call almost every page makes. */
export async function getI18n(params?: MaybeParams): Promise<PageI18n> {
  return i18nFor(await resolveLocale(params));
}
