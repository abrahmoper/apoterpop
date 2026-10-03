import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Compass,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { ListingCard } from "@/components/listing-card";
import { ProviderCard } from "@/components/provider-card";
import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import {
  featuredListings,
  newestListings,
  affordableListings,
} from "@/lib/db/listings";
import { searchProviders, isOpenNow } from "@/lib/db/providers";
import { CITIES } from "@/lib/geo";
import { getI18n } from "@/lib/i18n/server";
import { PROPERTY_TYPES } from "@/lib/taxonomy";
import type { Locale } from "@/lib/types";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { t, href, locale } = await getI18n(params);

  // Fetch initial showcases with error resilience
  const [featured, newest, affordable, providersResult] = await Promise.all([
    featuredListings(locale, 6).catch(() => []),
    newestListings(locale, 4).catch(() => []),
    affordableListings(locale, 4).catch(() => []),
    searchProviders({ city: "Addis Ababa" }, locale).catch(() => ({ providers: [], total: 0 })),
  ]);

  const providers = providersResult.providers.slice(0, 4);

  return (
    <div className="flex flex-col gap-12 sm:gap-16 lg:gap-20 pb-16">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-primary-soft/40 via-background to-background py-14 sm:py-20 lg:py-24">
        {/* Subtle patterned background */}
        <div className="absolute inset-0 bg-[radial-gradient(#1D6F52_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

        <div className="container relative flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm mb-6">
            <Sparkles className="size-3.5 text-accent fill-accent" aria-hidden />
            <span>{t("home.heroBadge")}</span>
          </div>

          <h1 className="max-w-3xl font-display text-3xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl leading-[1.15]">
            {t("home.heroTitle")}
          </h1>

          <p className="mt-4 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
            {t("home.heroBody")}
          </p>

          {/* Hero Search Bar */}
          <div className="mt-8 sm:mt-10 w-full flex justify-center">
            <SearchBar variant="hero" />
          </div>

          {/* Quick Property Type Links */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
            <span className="text-muted-foreground mr-1">{t("search.propertyType")}:</span>
            {PROPERTY_TYPES.slice(0, 5).map((pt) => (
              <Link
                key={pt.key}
                href={href(`/search?propertyType=${pt.key}`)}
                className="rounded-full border border-border bg-card px-3 py-1 text-ink-700 transition-colors hover:border-primary hover:text-primary"
              >
                {locale === "am" ? pt.am : pt.en}
              </Link>
            ))}
            <Link
              href={href("/search?rentalType=nightly")}
              className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-accent-foreground transition-colors hover:bg-accent hover:text-white"
            >
              {t("search.nightlyStays")}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Featured Homes */}
      <section className="container">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <Badge variant="verified" className="mb-2">
              {t("common.verified")}
            </Badge>
            <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {t("home.featuredTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("home.featuredBody")}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex rounded-full">
            <Link href={href("/search")} className="flex items-center gap-1.5">
              <span>{t("common.seeAll")}</span>
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>

        {featured.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-muted-foreground">{t("search.noResults")}</p>
          </div>
        )}

        <div className="mt-6 text-center sm:hidden">
          <Button asChild variant="outline" className="w-full rounded-full">
            <Link href={href("/search")}>{t("common.seeAll")}</Link>
          </Button>
        </div>
      </section>

      {/* 3. Essential Neighbourhood Services Showcase */}
      <section className="border-y border-border bg-muted/40 py-12 sm:py-16">
        <div className="container">
          <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase mb-1">
                <MapPin className="size-4" aria-hidden />
                <span>{t("home.servicesBadge")}</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                {t("home.servicesTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground max-w-xl">
                {t("home.servicesBody")}
              </p>
            </div>
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex rounded-full">
              <Link href={href("/services")} className="flex items-center gap-1.5">
                <span>{t("common.seeAll")}</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          {providers.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {providers.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} isOpen={isOpenNow(provider)} />
              ))}
            </div>
          ) : null}

          <div className="mt-6 text-center sm:hidden">
            <Button asChild variant="outline" className="w-full rounded-full">
              <Link href={href("/services")}>{t("common.seeAll")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 4. Newly Listed */}
      {newest.length > 0 ? (
        <section className="container">
          <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                {t("home.newestTitle")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("home.newestBody")}
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href={href("/search?sort=newest")} className="flex items-center gap-1.5">
                <span>{t("common.seeAll")}</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {newest.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      ) : null}

      {/* 5. Cities Across Ethiopia */}
      <section className="container">
        <div className="text-center max-w-xl mx-auto mb-8 sm:mb-10">
          <h2 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("home.citiesTitle")}
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("home.citiesBody")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CITIES.slice(0, 6).map((city) => (
            <Link
              key={city.key}
              href={href(`/search?city=${encodeURIComponent(city.key)}`)}
              className="group flex flex-col items-center justify-center rounded-2xl border border-border bg-card p-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-card"
            >
              <div className="grid size-12 place-items-center rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white mb-3">
                <Building2 className="size-6" aria-hidden />
              </div>
              <span className="font-display font-semibold text-foreground group-hover:text-primary transition-colors">
                {locale === "am" ? city.am : city.en}
              </span>
              <span className="mt-0.5 text-xs text-muted-foreground">
                {t("search.exploreCities")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. Why Kiray Trust Factors */}
      <section className="container">
        <div className="rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-card">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-eucalyptus-100 text-primary">
                <ShieldCheck className="size-6" aria-hidden />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {t("home.trustVerifiedTitle")}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {t("home.trustVerifiedBody")}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-tibeb-100 text-amber-800">
                <MapPin className="size-6" aria-hidden />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {t("home.trustNeighbourhoodTitle")}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {t("home.trustNeighbourhoodBody")}
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                <HeartHandshake className="size-6" aria-hidden />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {t("home.trustDirectTitle")}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
                  {t("home.trustDirectBody")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Host Call-to-Action Banner */}
      <section className="container">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 sm:px-12 sm:py-16 text-paper shadow-lift">
          <div className="absolute right-0 top-0 -translate-y-12 translate-x-12 size-96 rounded-full bg-primary/20 blur-3xl" />

          <div className="relative max-w-2xl">
            <Badge variant="accent" className="mb-3">
              {t("nav.becomeHost")}
            </Badge>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
              {t("home.hostCtaTitle")}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-ink-300 leading-relaxed">
              {t("home.hostCtaBody")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-full shadow-lg">
                <Link href={href("/host")}>{t("nav.becomeHost")}</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full border-white/20 bg-white/10 text-white hover:bg-white/20">
                <Link href={href("/search")}>{t("nav.explore")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
