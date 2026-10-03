/**
 * The root layout — and it lives under [locale] on purpose.
 *
 * `<html lang>` has to be right on the first byte, because the Ethiopic font and
 * line-height rules in globals.css hang off `:lang(am)`. Putting the document
 * shell inside the locale segment is the one arrangement where that is true
 * without a client-side correction flashing at the reader.
 *
 * Everything below the header is a server component by default. The header and
 * the mobile tab bar are client components only because they own popovers and
 * the current-path highlight.
 */
import type { Metadata, Viewport } from "next";
import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";

import "../globals.css";

import { MobileTabs } from "@/components/mobile-tabs";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { unreadCount } from "@/lib/db/conversations";
import { I18nProvider } from "@/lib/i18n/client";
import { isLocale, LOCALES } from "@/lib/i18n/config";
import { i18nFor } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

export function generateStaticParams(): Array<{ locale: Locale }> {
  return LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#1D6F52",
  width: "device-width",
  initialScale: 1,
  // Zooming a rental listing's photos is a real need; never disable it.
  maximumScale: 5,
  // Lets the tab bar pad itself clear of the iPhone home indicator.
  viewportFit: "cover",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: raw } = await params;
  const { t, locale } = i18nFor(isLocale(raw) ? raw : "en");

  return {
    title: {
      default: `${t("app.name")} — ${t("app.tagline")}`,
      template: `%s · ${t("app.name")}`,
    },
    description: t("home.heroBody"),
    applicationName: t("app.name"),
    metadataBase: new URL("https://kiray.et"),
    alternates: {
      canonical: `/${locale}`,
      languages: { en: "/en", am: "/am" },
    },
    openGraph: {
      title: `${t("app.name")} — ${t("app.tagline")}`,
      description: t("home.heroBody"),
      locale: locale === "am" ? "am_ET" : "en_ET",
      type: "website",
    },
    formatDetection: { telephone: true },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;

  const user = await getSessionUser();
  const unread = user ? await unreadCount(user.id) : 0;
  const { t } = i18nFor(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <I18nProvider locale={locale}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lift"
          >
            {t("common.skipToContent")}
          </a>

          <Suspense fallback={<div className="h-[var(--header-h)] border-b border-border" />}>
            <SiteHeader user={user} unread={unread} />
          </Suspense>

          {/* pb-20 keeps the mobile tab bar from sitting on top of page content. */}
          <main id="main" className="pb-20 md:pb-0">
            {children}
          </main>

          <SiteFooter locale={locale} />

          <Suspense fallback={null}>
            <MobileTabs signedIn={!!user} isHost={!!user?.isHost} unread={unread} />
          </Suspense>

          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
