import type { Locale } from "../types";

export const LOCALES: Locale[] = ["en", "am"];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "kiray_locale";

export const LOCALE_LABELS: Record<Locale, { native: string; english: string; flagText: string }> = {
  en: { native: "English", english: "English", flagText: "EN" },
  am: { native: "አማርኛ", english: "Amharic", flagText: "አማ" },
};

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "am";
}

export function coerceLocale(value: string | undefined | null): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Picks the best locale from an Accept-Language header. */
export function localeFromHeader(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const lower = header.toLowerCase();
  const amIndex = lower.indexOf("am");
  const enIndex = lower.indexOf("en");
  if (amIndex === -1) return DEFAULT_LOCALE;
  if (enIndex === -1) return "am";
  return amIndex < enIndex ? "am" : "en";
}

/** Swaps the locale segment on a path: /am/search -> /en/search */
export function switchLocalePath(pathname: string, next: Locale): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${next}`;
  if (isLocale(segments[0])) {
    segments[0] = next;
  } else {
    segments.unshift(next);
  }
  return `/${segments.join("/")}`;
}

/**
 * Prefixes an app path with the active locale: localeHref("am", "/search")
 * gives "/am/search". Pure, so client components can use it for Link hrefs.
 */
export function localeHref(locale: Locale, path: string): string {
  if (!path || path === "/") return `/${locale}`;
  if (path.startsWith("http") || path.startsWith("#")) return path;
  const withSlash = path.startsWith("/") ? path : `/${path}`;
  // Already localised (e.g. an href built twice) — leave it alone.
  const first = withSlash.split("/")[1];
  if (isLocale(first)) return withSlash;
  return `/${locale}${withSlash}`;
}

/** Strips a leading locale segment: /am/search -> /search */
export function stripLocale(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length && isLocale(segments[0])) segments.shift();
  return `/${segments.join("/")}`;
}
