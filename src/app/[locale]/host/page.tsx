import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  Eye,
  Home,
  Inbox,
  Mail,
  Star,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Badge, Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth";
import { completeDueBookings, hostBookings, hostStats } from "@/lib/db/bookings";
import { hostListings } from "@/lib/db/listings";
import { getI18n } from "@/lib/i18n/server";
import { photoUrl } from "@/lib/photos";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ListingStatus, Locale } from "@/lib/types";
import { CreateListingButton } from "./create-listing-button";
import { ListingStatusButton } from "./listing-status-button";
import { BookingRespondButtons } from "./booking-respond-buttons";

/**
 * The host dashboard: the numbers that matter, open booking requests, and
 * every listing with its publish controls.
 */
export default async function HostDashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const user = await getSessionUser();
  if (!user) redirect(href(`/signin?next=${encodeURIComponent(href("/host"))}`));

  await completeDueBookings(user.id);

  const [stats, listings, requests] = await Promise.all([
    hostStats(user.id).catch(() => null),
    hostListings(user.id, locale).catch(() => []),
    hostBookings(user.id, locale).catch(() => []),
  ]);

  const pending = requests.filter((b) => b.status === "pending");

  const statusLabels: Record<ListingStatus, string> = {
    draft: t("host.status.draft"),
    published: t("host.status.published"),
    paused: t("host.status.paused"),
    removed: t("host.status.removed"),
  };

  const statusVariant = (status: ListingStatus) => {
    if (status === "published") return "verified" as const;
    if (status === "draft") return "muted" as const;
    if (status === "paused") return "accent" as const;
    return "destructive" as const;
  };

  const statCards = stats
    ? [
        { icon: TrendingUp, label: t("host.statListings"), value: stats.published },
        { icon: Inbox, label: t("host.statRequests"), value: stats.pending, highlight: stats.pending > 0 },
        { icon: CalendarDays, label: t("booking.upcoming"), value: stats.upcoming },
        { icon: Mail, label: t("nav.messages"), value: stats.unread, highlight: stats.unread > 0 },
        { icon: Eye, label: t("host.statViews"), value: stats.views },
        {
          icon: Star,
          label: t("host.statRating"),
          value: stats.ratingCount > 0 ? stats.ratingAvg.toFixed(1) : "—",
        },
      ]
    : [];

  return (
    <div className="container max-w-5xl space-y-10 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar
            name={user.fullName}
            src={user.avatarKey ? photoUrl(user.avatarKey) : null}
            className="size-12"
          />
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {t("host.greeting", { name: user.fullName.split(" ")[0] })}
            </h1>
            <p className="text-sm text-muted-foreground">{t("nav.hostDashboard")}</p>
          </div>
        </div>
        <CreateListingButton locale={locale} returnTo="/host" />
      </div>

      {stats ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {statCards.map((stat) => (
              <Card
                key={stat.label}
                className={stat.highlight ? "border-primary/30 bg-primary-soft/40" : undefined}
              >
                <CardContent className="p-4">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                    <stat.icon className="size-4" aria-hidden />
                  </span>
                  <p className="tnum mt-3 font-display text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {stats.earned > 0 ? (
            <div className="flex items-center gap-3 rounded-2xl bg-ink-900 p-4 text-paper sm:p-5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10">
                <Wallet className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs text-ink-300">{t("host.statEarnings")}</p>
                <p className="tnum font-display text-xl font-bold">{formatMoney(stats.earned, "ETB")}</p>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Booking requests */}
      <section className="space-y-4">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-foreground">
          {t("booking.requests")}
          {pending.length > 0 ? (
            <span className="tnum grid h-6 min-w-6 place-items-center rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">
              {pending.length}
            </span>
          ) : null}
        </h2>

        {pending.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-muted text-muted-foreground">
                <Inbox className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">{t("booking.noRequests")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("booking.noRequestsBody")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          pending.map((booking) => (
            <Card key={booking.id} className="border-accent/40">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <Link
                  href={href(`/listing/${booking.listing_id}`)}
                  className="block w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-32"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(booking.listingPhoto)}
                    alt={booking.listingTitle}
                    className="aspect-[16/10] w-full object-cover sm:aspect-[4/3]"
                    loading="lazy"
                  />
                </Link>

                <div className="min-w-0 flex-1 space-y-2">
                  <p className="line-clamp-1 font-display text-base font-semibold text-foreground">
                    {booking.listingTitle}
                  </p>
                  <p className="tnum flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-600">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5 text-primary" aria-hidden />
                      {formatDate(booking.start_date)} → {formatDate(booking.end_date)}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{t("common.guests", { count: booking.guests })}</span>
                    <span aria-hidden>·</span>
                    <strong className="text-foreground">{formatMoney(booking.total, booking.currency)}</strong>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <UserAvatar
                      name={booking.guestName}
                      src={booking.guestAvatarKey ? photoUrl(booking.guestAvatarKey) : null}
                      className="size-6"
                    />
                    <span className="font-medium text-ink-700">{booking.guestName}</span>
                    <span aria-hidden>·</span>
                    <span className="font-mono text-[11px]">{t("booking.code", { code: booking.code })}</span>
                    <span aria-hidden>·</span>
                    <span>{formatDate(booking.created_at)}</span>
                  </div>
                  {booking.guest_message ? (
                    <p className="line-clamp-3 rounded-xl bg-muted/60 p-3 text-sm italic text-ink-700">
                      “{booking.guest_message}”
                    </p>
                  ) : null}
                </div>

                <BookingRespondButtons bookingId={booking.id} />
              </CardContent>
            </Card>
          ))
        )}
      </section>

      {/* Listings */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-foreground">
          {t("host.yourListings")}{" "}
          {listings.length > 0 ? (
            <span className="tnum text-sm font-normal text-muted-foreground">({listings.length})</span>
          ) : null}
        </h2>

        {listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
              <Home className="size-7" aria-hidden />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">{t("host.noListings")}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("host.noListingsBody")}</p>
            <CreateListingButton locale={locale} returnTo="/host" className="mt-6" />
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => (
              <Card key={listing.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                  <Link
                    href={href(`/host/listing/${listing.id}`)}
                    className="block w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-32"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(listing.photos[0] ?? null)}
                      alt={listing.title}
                      className="aspect-[16/10] w-full object-cover sm:aspect-[4/3]"
                      loading="lazy"
                    />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={href(`/host/listing/${listing.id}`)}
                        className="line-clamp-1 font-display text-base font-semibold text-foreground hover:text-primary"
                      >
                        {listing.title}
                      </Link>
                      <Badge variant={statusVariant(listing.status)}>{statusLabels[listing.status]}</Badge>
                    </div>
                    <p className="tnum mt-1 text-sm text-muted-foreground">
                      {[listing.neighborhood, listing.city].filter(Boolean).join(", ")} ·{" "}
                      <span className="font-semibold text-foreground">
                        {formatMoney(listing.price, listing.currency)}
                      </span>{" "}
                      / {listing.rentalType === "nightly" ? t("common.night") : t("common.month")}
                    </p>
                    {listing.ratingCount > 0 ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-ink-800">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                        {listing.ratingAvg.toFixed(1)} ({listing.ratingCount})
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={href(`/host/listing/${listing.id}`)}>{t("common.edit")}</Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={href(`/listing/${listing.id}`)}>{t("host.previewListing")}</Link>
                    </Button>
                    <ListingStatusButton listingId={listing.id} status={listing.status} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
