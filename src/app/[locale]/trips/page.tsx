import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Compass, MessageSquare, Phone } from "lucide-react";

import { Badge, Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/auth";
import { completeDueBookings, guestBookings } from "@/lib/db/bookings";
import { getI18n } from "@/lib/i18n/server";
import { photoUrl } from "@/lib/photos";
import { formatDate, formatMoney, formatPhone } from "@/lib/utils";
import type { BookingModel, Locale } from "@/lib/types";
import { BookingActions } from "./booking-actions";
import { ReviewForm } from "./review-form";

/**
 * The guest's rentals. Pending first (they need attention), then everything
 * else newest-move-in first. Completed stays carry the review prompt once.
 */
export default async function TripsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const user = await getSessionUser();
  if (!user) redirect(href(`/signin?next=${encodeURIComponent(href("/trips"))}`));

  await completeDueBookings(user.id);
  const bookings = await guestBookings(user.id, locale).catch(() => []);

  const upcoming = bookings.filter((b) => b.status === "pending" || b.status === "confirmed");
  const past = bookings.filter(
    (b) => b.status === "completed" || b.status === "cancelled" || b.status === "declined",
  );

  const statusLabels: Record<BookingModel["status"], string> = {
    pending: t("booking.status.pending"),
    confirmed: t("booking.status.confirmed"),
    declined: t("booking.status.declined"),
    cancelled: t("booking.status.cancelled"),
    completed: t("booking.status.completed"),
  };

  const statusVariant = (status: BookingModel["status"]) => {
    if (status === "confirmed") return "verified" as const;
    if (status === "pending") return "accent" as const;
    if (status === "declined" || status === "cancelled") return "destructive" as const;
    return "muted" as const;
  };

  const renderBooking = (booking: BookingModel) => (
    <Card key={booking.id} className="overflow-hidden">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <Link
          href={href(`/listing/${booking.listing_id}`)}
          className="block w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-44"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl(booking.listingPhoto)}
            alt={booking.listingTitle}
            className="aspect-[16/10] w-full object-cover transition-transform duration-500 hover:scale-105 sm:aspect-[4/3]"
            loading="lazy"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={href(`/listing/${booking.listing_id}`)}
                className="line-clamp-1 font-display text-base font-semibold text-foreground hover:text-primary"
              >
                {booking.listingTitle}
              </Link>
              <p className="text-xs text-muted-foreground">
                {[booking.listingNeighborhood, booking.listingCity].filter(Boolean).join(", ")}
              </p>
            </div>
            <Badge variant={statusVariant(booking.status)}>{statusLabels[booking.status]}</Badge>
          </div>

          <div className="grid grid-cols-1 gap-2 rounded-xl bg-muted/50 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <span className="tnum inline-flex items-center gap-1.5 text-ink-700">
              <CalendarDays className="size-4 text-primary" aria-hidden />
              {formatDate(booking.start_date)} → {formatDate(booking.end_date)}
            </span>
            <span className="tnum font-display font-bold text-foreground sm:text-right">
              {formatMoney(booking.total, booking.currency)}
            </span>
            <span className="font-mono text-[11px] tracking-wide text-muted-foreground sm:col-span-2">
              {t("booking.code", { code: booking.code })}
            </span>
          </div>

          {booking.guest_message ? (
            <p className="line-clamp-2 text-sm italic text-muted-foreground">“{booking.guest_message}”</p>
          ) : null}

          {booking.status === "pending" ? (
            <p className="text-xs text-muted-foreground">{t("booking.statusPendingNotice")}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="mr-auto inline-flex min-w-0 items-center gap-2 text-sm text-ink-700">
              <UserAvatar name={booking.hostName} className="size-7" />
              <span className="truncate">{booking.hostName}</span>
            </span>

            {booking.hostPhone ? (
              <Button asChild variant="soft" size="sm">
                <a href={`tel:${booking.hostPhone}`}>
                  <Phone aria-hidden />
                  <span className="tnum">{formatPhone(booking.hostPhone)}</span>
                </a>
              </Button>
            ) : null}

            <Button asChild variant="outline" size="sm">
              <Link href={href("/messages")}>
                <MessageSquare aria-hidden />
                {t("booking.contactOwner")}
              </Link>
            </Button>

            <BookingActions bookingId={booking.id} status={booking.status} />

            {booking.status === "completed" && !booking.hasReview ? (
              <ReviewForm listingId={booking.listing_id} bookingId={booking.id} />
            ) : null}
            {booking.status === "completed" && booking.hasReview ? (
              <span className="text-xs text-muted-foreground">{t("booking.reviewed")}</span>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container max-w-4xl space-y-8 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("booking.myRentals")}
      </h1>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Compass className="size-7" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">{t("booking.empty")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("booking.emptyBody")}</p>
          <Button asChild className="mt-6 rounded-full">
            <Link href={href("/search")}>{t("booking.emptyCta")}</Link>
          </Button>
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {t("booking.upcoming")}{" "}
                <span className="tnum text-sm font-normal text-muted-foreground">({upcoming.length})</span>
              </h2>
              {upcoming.map(renderBooking)}
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-display text-lg font-semibold text-foreground">
                {t("booking.past")}{" "}
                <span className="tnum text-sm font-normal text-muted-foreground">({past.length})</span>
              </h2>
              {past.map(renderBooking)}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
