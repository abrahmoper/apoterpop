"use client";

/**
 * Client-side locale access.
 *
 * The locale comes from the URL segment, so the provider is given it by the
 * layout rather than working it out itself. Components then call `useT()`
 * instead of taking a `t` prop through four levels of tree.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "../types";
import { localeHref } from "./config";
import { makeT, type Translator } from "./messages";

interface I18nValue {
  locale: Locale;
  t: Translator;
  /** href("/search") -> "/am/search" */
  href: (path: string) => string;
  isAmharic: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      t: makeT(locale),
      href: (path: string) => localeHref(locale, path),
      isAmharic: locale === "am",
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Falls back to English rather than throwing when a component is rendered
 * outside the provider — a missing provider should not blank out a page.
 */
export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (value) return value;
  return {
    locale: "en",
    t: makeT("en"),
    href: (path: string) => localeHref("en", path),
    isAmharic: false,
  };
}

export function useT(): Translator {
  return useI18n().t;
}

export function useLocale(): Locale {
  return useI18n().locale;
}

/** Builds locale-aware hrefs for `<Link>`. */
export function useHref(): (path: string) => string {
  return useI18n().href;
}
