import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, localeFromHeader } from "@/lib/i18n/config";

/**
 * Locale routing.
 *
 * Every page lives under /en/… or /am/…, which keeps URLs shareable and lets
 * `<html lang>` be correct on the very first byte — the Ethiopic font rules in
 * globals.css hang off that attribute.
 *
 * A request without a locale prefix gets redirected to one: the saved cookie if
 * the visitor has ever chosen, otherwise their Accept-Language header. Once
 * they are inside a locale the segment wins, and the cookie is refreshed to
 * match so the next bare link lands in the same language.
 */

/** Anything served as-is: assets, uploads, API routes, files with extensions. */
const BYPASS = ["/_next", "/api", "/photos", "/favicon", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest"];

const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (BYPASS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return NextResponse.next();
  }
  // e.g. /pin.svg, /og.png — static files at the root.
  if (/\.[a-z0-9]+$/i.test(pathname)) return NextResponse.next();

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  if (isLocale(first)) {
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== first) {
      response.cookies.set(LOCALE_COOKIE, first, {
        path: "/",
        maxAge: ONE_YEAR,
        sameSite: "lax",
      });
    }
    return response;
  }

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(saved)
    ? saved
    : localeFromHeader(request.headers.get("accept-language")) || DEFAULT_LOCALE;

  const url = request.nextUrl.clone();
  url.pathname = segments.length ? `/${locale}/${segments.join("/")}` : `/${locale}`;
  url.search = search;

  const response = NextResponse.redirect(url);
  response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
