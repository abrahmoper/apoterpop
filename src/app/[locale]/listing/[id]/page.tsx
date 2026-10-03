import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bath,
  Bed,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Images,
  MapPin,
  Maximize2,
  Phone,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from "lucide-react";

import { BookingWidget } from "@/components/booking-widget";
import { ListingCard } from "@/components/listing-card";
import { MessageHostDialog } from "@/components/message-host-dialog";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle, Separator } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth";
import { getListing, incrementViews, similarListings } from "@/lib/db/listings";
import { providersAround, isOpenNow } from "@/lib/db/providers";
import { listingReviews } from "@/lib/db/reviews";
import { getI18n } from "@/lib/i18n/server";
import { amenityTerm } from "@/lib/taxonomy";
import { photoUrl } from "@/lib/photos";
import { cn, formatDate, formatDistance, formatMoney, formatPhone } from "@/lib/utils";
import type { Locale } from "@/lib/types";
import { FavoriteButton } from "./favorite-button";
import { ReviewSection } from "./review-section";

/**
 * The listing detail page. Everything the guest needs to decide: photos,
 * honest description, the neighbourhood ring, reviews, and the booking widget.
 * The exact address and host phone only appear for the owner or a confirmed
 * guest; `getListing` enforces that, this page just renders what it gets.
 */
export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const { id } = await params;

  const user = await getSessionUser();
  const listing = await getListing(id, {
    locale,
    viewerId: user?.id ?? null,
  });

  if (!listing) notFound();

  // Fire-and-forget: never block the render on a counter.
  void incrementViews(listing.id);

  const [reviews, nearbyProviders, similar] = await Promise.all([
    listingReviews(listing.id).catch(() => []),
    providersAround({ lat: listing.lat, lng: listing.lng }, locale).catch(() => []),
    similarListings(listing, locale, user?.id ?? null).catch(() => []),
  ]);

  const isOwner = user?.id === listing.hostId;
  const locationText = [listing.neighborhood, listing.subcity, listing.city]
    .filter(Boolean)
    .join(", ");

  // A five-tile mosaic only works with five photos; anything less gets one
  // wide hero instead of a grid with holes in it.
  const photos = listing.photos.slice(0, 5);
  const mosaic = photos.length >= 5;

  return (
    <div className="container space-y-8 py-6 sm:space-y-10 sm:py-10">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={href("/search")}
          className="inline-flex items-center gap-1 rounded-full py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("nav.explore")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {listing.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {listing.ratingAvg > 0 ? (
                <a
                  href="#reviews"
                  className="inline-flex items-center gap-1 font-semibold text-ink-800 hover:underline"
                >
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                  {listing.ratingAvg.toFixed(1)}
                  <span className="font-normal text-muted-foreground">
                    ({t("common.reviews", { count: listing.ratingCount })})
                  </span>
                </a>
              ) : null}
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-4" aria-hidden />
                {locationText}
              </span>
              {listing.verified ? (
                <Badge variant="verified" className="gap-1">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  {t("common.verified")}
                </Badge>
              ) : null}
              {listing.instantBook ? (
                <Badge variant="accent" className="gap-1">
                  <Zap className="size-3.5" aria-hidden />
                  {t("listing.instantBook")}
                </Badge>
              ) : null}
            </div>
          </div>
          <FavoriteButton listingId={listing.id} saved={listing.isFavorite ?? false} />
        </div>

        {listing.status !== "published" ? (
          <Badge variant="muted">{t("listing.draftNotice")}</Badge>
        ) : null}
      </div>

      {/* Photo gallery */}
      <div className="relative">
        <div
          className={cn(
            "grid gap-2 overflow-hidden rounded-3xl",
            mosaic ? "grid-cols-4 grid-rows-2 sm:h-[26rem] lg:h-[30rem]" : "grid-cols-1",
          )}
        >
          {(mosaic ? photos : photos.slice(0, 1)).map((key, index) => (
            <div
              key={key}
              className={cn(
                "overflow-hidden bg-muted",
                mosaic
                  ? index === 0
                    ? "col-span-4 row-span-2 aspect-[4/3] sm:col-span-2 sm:aspect-auto"
                    : "hidden sm:block"
                  : "aspect-[4/3] sm:aspect-[21/9]",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl(key)}
                alt={listing.photoAlts[index] ?? listing.title}
                className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]"
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : undefined}
              />
            </div>
          ))}
        </div>
        {listing.photos.length > 1 ? (
          <span className="tnum pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
            <Images className="size-3.5" aria-hidden />
            {listing.photos.length}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-10">
        {/* Booking column: first on phones so the price and dates are one
            scroll away, sticky beside the content on desktop. */}
        <div
          id="book"
          className="order-first lg:order-last lg:sticky lg:top-24 lg:self-start"
        >
          {isOwner ? (
            <Card>
              <CardHeader>
                <CardTitle>{t("nav.hostDashboard")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button asChild className="w-full rounded-full">
                  <Link href={href(`/host/listing/${listing.id}`)}>{t("common.edit")}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full rounded-full">
                  <Link href={href("/host")}>
                    {t("host.dashboard")}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <BookingWidget listing={listing} userSignedIn={!!user} />
          )}

          {listing.depositMonths > 0 && listing.rentalType === "monthly" ? (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              {t("listing.deposit")}:{" "}
              {t("listing.depositMonths", { count: listing.depositMonths })} ·{" "}
              {formatMoney(listing.price * listing.depositMonths, listing.currency)}
            </p>
          ) : null}
        </div>

        {/* Main column */}
        <div className="min-w-0 space-y-10 lg:col-span-2">
          {/* Quick facts */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { icon: Bed, label: t("common.bedrooms", { count: listing.bedrooms }) },
              { icon: Bath, label: t("common.bathrooms", { count: listing.bathrooms }) },
              { icon: Users, label: t("common.guests", { count: listing.maxGuests }) },
              ...(listing.areaSqm
                ? [{ icon: Maximize2, label: t("common.sqm", { count: listing.areaSqm }) }]
                : []),
              {
                icon: Calendar,
                label: listing.availableFrom
                  ? t("listing.availableFrom", { date: formatDate(listing.availableFrom) })
                  : t("listing.availableNow"),
              },
              {
                icon: Clock,
                label:
                  listing.rentalType === "monthly"
                    ? t("listing.minStay", { count: listing.minStayMonths })
                    : t("listing.minNights", { count: listing.minNights }),
              },
            ].map((fact) => (
              <li
                key={fact.label}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-3 text-sm text-ink-700"
              >
                <fact.icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">{fact.label}</span>
              </li>
            ))}
          </ul>

          {/* Host card */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar name={listing.hostName} className="size-12" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">
                    {t("listing.hostedBy", { name: listing.hostName })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("listing.hostSince", { date: formatDate(listing.hostSince) })}
                    {listing.hostResponseRate > 0
                      ? ` · ${t("listing.responseRate", { rate: listing.hostResponseRate })}`
                      : ""}
                  </p>
                </div>
              </div>
              {!isOwner ? (
                <MessageHostDialog
                  listingId={listing.id}
                  hostId={listing.hostId}
                  hostName={listing.hostName}
                  userSignedIn={!!user}
                />
              ) : null}
            </div>

            {listing.hostPhone || listing.addressLine ? (
              <div className="mt-4 space-y-2 rounded-xl border border-primary/20 bg-primary-soft/50 p-4 text-sm">
                {listing.hostPhone ? (
                  <a
                    href={`tel:${listing.hostPhone}`}
                    className="tnum inline-flex items-center gap-2 font-semibold text-primary hover:underline"
                  >
                    <Phone className="size-4" aria-hidden />
                    {formatPhone(listing.hostPhone)}
                  </a>
                ) : null}
                {listing.addressLine ? (
                  <p className="flex items-start gap-2 text-ink-700">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {listing.addressLine}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 p-3.5 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {t("listing.areaNote")}
              </p>
            )}
          </div>

          {listing.description ? (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">{t("listing.about")}</h2>
              <p className="pretty mt-3 whitespace-pre-line text-[15px] leading-relaxed text-ink-700">
                {listing.description}
              </p>
            </section>
          ) : null}

          {listing.amenityKeys.length > 0 ? (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">{t("listing.offers")}</h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {listing.amenityKeys.map((key) => {
                  const term = amenityTerm(key);
                  if (!term) return null;
                  return (
                    <li
                      key={key}
                      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink-700"
                    >
                      <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden />
                      {locale === "am" ? term.am : term.en}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {listing.houseRules ? (
            <section>
              <h2 className="font-display text-xl font-bold text-foreground">{t("listing.rules")}</h2>
              <p className="mt-3 whitespace-pre-line rounded-2xl bg-muted/50 p-4 text-sm leading-relaxed text-ink-700">
                {listing.houseRules}
              </p>
            </section>
          ) : null}

          <Separator />

          <section>
            <h2 className="font-display text-xl font-bold text-foreground">{t("listing.nearby")}</h2>
            {nearbyProviders.length > 0 ? (
              <>
                <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {nearbyProviders.map((provider) => {
                    const open = isOpenNow(provider);
                    return (
                      <li
                        key={provider.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{provider.name}</p>
                          <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span
                              className={cn("size-1.5 rounded-full", open ? "bg-eucalyptus-500" : "bg-ink-300")}
                              aria-hidden
                            />
                            {open ? t("services.openNow") : t("services.closed")}
                          </p>
                        </div>
                        {provider.distanceKm !== undefined ? (
                          <span className="tnum shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-ink-700">
                            {formatDistance(provider.distanceKm)}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <Link
                  href={href("/services")}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                >
                  {t("listing.showAllNearby")}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("listing.nearbyEmpty")}</p>
            )}
          </section>

          {/* ReviewSection renders its own <section id="reviews"> */}
          <div>
            <ReviewSection
              listingId={listing.id}
              reviews={reviews}
              breakdown={listing.ratingBreakdown}
              ratingAvg={listing.ratingAvg}
              ratingCount={listing.ratingCount}
              isOwner={isOwner}
            />
          </div>
        </div>
      </div>

      {similar.length > 0 ? (
        <section className="border-t border-border pt-10">
          <h2 className="font-display text-2xl font-bold text-foreground">{t("listing.similar")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((other) => (
              <ListingCard key={other.id} listing={other} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
