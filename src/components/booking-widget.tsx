"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

import { requestBookingAction, type BookingFormState } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";
import { quote } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import type { ListingDetailModel } from "@/lib/types";

/**
 * Built from the LOCAL date, not toISOString(), which is UTC and would skip a
 * day for visitors east of Greenwich.
 */
function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function minimumEnd(start: Date, listing: ListingDetailModel): Date {
  const end = new Date(start);
  if (listing.rentalType === "monthly") {
    end.setMonth(end.getMonth() + Math.max(1, listing.minStayMonths || 1));
  } else {
    end.setDate(end.getDate() + Math.max(1, listing.minNights || 1));
  }
  return end;
}

const inputClass =
  "mt-0.5 w-full cursor-pointer bg-transparent text-base font-medium text-foreground focus:outline-none sm:text-sm";
const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function BookingWidget({
  listing,
  userSignedIn,
}: {
  listing: ListingDetailModel;
  userSignedIn: boolean;
}) {
  const { t, href, locale } = useI18n();
  const [isPending, startTransition] = useTransition();
  const uid = useId();

  const today = localDate(new Date());
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [from, setFrom] = useState(() => localDate(tomorrow));
  const [to, setTo] = useState(() => localDate(minimumEnd(tomorrow, listing)));
  const [guests, setGuests] = useState(1);
  const [guestMessage, setGuestMessage] = useState("");
  const [bookingState, setBookingState] = useState<BookingFormState | null>(null);

  /** "This home asks for at least 3 months", with the count actually filled in. */
  const minStayMessage = () =>
    t("error.minStay", {
      count:
        listing.rentalType === "monthly"
          ? t("common.months", { count: Math.max(1, listing.minStayMonths || 1) })
          : t("common.nights", { count: Math.max(1, listing.minNights || 1) }),
    });

  const handleFromChange = (newFrom: string) => {
    setFrom(newFrom);
    if (!newFrom) return;
    const fromDate = new Date(`${newFrom}T00:00:00`);
    if (isNaN(fromDate.getTime())) return;
    if (!to || newFrom >= to) setTo(localDate(minimumEnd(fromDate, listing)));
  };

  // The same math the server runs, from the same module, so the preview and
  // the stored booking can never disagree on a price.
  const preview = quote({
    rentalType: listing.rentalType,
    price: listing.price,
    currency: listing.currency,
    depositMonths: listing.depositMonths,
    minStayMonths: listing.minStayMonths,
    minNights: listing.minNights,
    from,
    to,
  });

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userSignedIn) return;

    if (!from || !to) return void toast.error(t("error.datesRequired"));
    if (from < today) return void toast.error(t("error.datesPast"));
    if (to <= from) return void toast.error(t("error.datesOrder"));
    if (!preview.valid) {
      return void toast.error(
        preview.problem === "min_stay" ? minStayMessage() : t("error.datesOrder"),
      );
    }

    const form = new FormData();
    form.set("locale", locale);
    form.set("listingId", listing.id);
    form.set("from", from);
    form.set("to", to);
    form.set("guests", String(guests));
    form.set("message", guestMessage);
    form.set("returnTo", `/listing/${listing.id}`);

    startTransition(async () => {
      try {
        const res = await requestBookingAction({}, form);
        setBookingState(res);
        if (res.ok) {
          toast.success(
            res.status === "confirmed" ? t("booking.confirmed") : t("booking.requestSent"),
          );
        } else if (res.error) {
          toast.error(res.error === "error.minStay" ? minStayMessage() : t(res.error));
        }
      } catch {
        toast.error(t("error.generic"));
      }
    });
  };

  if (bookingState?.ok) {
    return (
      <div className="space-y-4 rounded-3xl border border-primary/20 bg-primary-soft/40 p-6 text-center shadow-card">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
          <CheckCircle2 className="size-6" aria-hidden />
        </div>
        <h3 className="font-display text-lg font-bold text-foreground">
          {bookingState.status === "confirmed" ? t("booking.confirmed") : t("booking.requestSent")}
        </h3>
        <p className="font-mono text-sm font-semibold tracking-wider text-foreground">
          {t("booking.code", { code: bookingState.code ?? "" })}
        </p>
        {bookingState.status !== "confirmed" ? (
          <p className="text-sm text-muted-foreground">{t("booking.statusPendingNotice")}</p>
        ) : null}
        <div className="pt-2">
          <Button asChild className="w-full rounded-full">
            <Link href={href("/trips")}>{t("nav.trips")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const maxGuests = Math.max(1, listing.maxGuests || 1);
  const signInHref = href(`/signin?next=${encodeURIComponent(href(`/listing/${listing.id}`))}`);

  return (
    <div className="space-y-5 rounded-3xl border border-border bg-card p-5 shadow-lift sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="font-display text-2xl font-bold text-foreground">
            {formatMoney(listing.price, listing.currency)}
          </span>
          <span className="ml-1 text-sm text-muted-foreground">
            {listing.rentalType === "nightly" ? t("common.perNight") : t("common.perMonth")}
          </span>
        </div>
        {listing.instantBook ? (
          <Badge variant="glass" className="flex items-center gap-1 font-medium text-amber-700">
            <Zap className="size-3.5 fill-amber-500 text-amber-500" aria-hidden />
            <span>{t("listing.instantBook")}</span>
          </Badge>
        ) : null}
      </div>

      <form onSubmit={handleBooking} className="space-y-4">
        <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="bg-card p-3">
              <label htmlFor={`${uid}-from`} className={labelClass}>
                {t("booking.checkIn")}
              </label>
              <input
                id={`${uid}-from`}
                type="date"
                required
                min={today}
                value={from}
                onChange={(e) => handleFromChange(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="bg-card p-3">
              <label htmlFor={`${uid}-to`} className={labelClass}>
                {t("booking.checkOut")}
              </label>
              <input
                id={`${uid}-to`}
                type="date"
                required
                min={from || today}
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="bg-card p-3">
            <label htmlFor={`${uid}-guests`} className={labelClass}>
              {t("booking.guests")}
            </label>
            <select
              id={`${uid}-guests`}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className={inputClass}
            >
              {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n} className="bg-card text-foreground">
                  {t("common.guests", { count: n })}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor={`${uid}-message`} className="mb-1 block text-sm font-medium text-ink-700">
            {t("booking.messageHostOptional")}
          </label>
          <textarea
            id={`${uid}-message`}
            rows={2}
            maxLength={2000}
            value={guestMessage}
            onChange={(e) => setGuestMessage(e.target.value)}
            placeholder={t("booking.guestMessagePlaceholder")}
            className="w-full rounded-xl border border-input bg-card p-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm"
          />
        </div>

        <div className="space-y-2 border-t border-border pt-4 text-sm text-ink-600">
          <div className="flex justify-between gap-3">
            <span>
              {formatMoney(listing.price, listing.currency)} ×{" "}
              {listing.rentalType === "monthly"
                ? t("common.months", { count: preview.units })
                : t("common.nights", { count: preview.units })}
            </span>
            <span className="tnum">{formatMoney(preview.subtotal, listing.currency)}</span>
          </div>

          {preview.deposit > 0 ? (
            <div className="flex justify-between gap-3">
              <span>
                {t("booking.deposit")} ({t("listing.depositMonths", { count: listing.depositMonths })})
              </span>
              <span className="tnum">{formatMoney(preview.deposit, listing.currency)}</span>
            </div>
          ) : null}

          <div className="flex justify-between gap-3">
            <span>{t("booking.serviceFee")}</span>
            <span className="tnum">{formatMoney(preview.serviceFee, listing.currency)}</span>
          </div>

          <div className="flex justify-between gap-3 border-t border-border/80 pt-2 font-display text-base font-bold text-foreground">
            <span>{t("booking.total")}</span>
            <span className="tnum">{formatMoney(preview.total, listing.currency)}</span>
          </div>

          {!preview.valid && preview.problem === "min_stay" ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {minStayMessage()}
            </p>
          ) : null}
        </div>

        {userSignedIn ? (
          <Button
            type="submit"
            size="lg"
            className="w-full rounded-full shadow-md"
            loading={isPending}
            disabled={!preview.valid || isPending}
          >
            {listing.instantBook ? t("booking.instantBookNow") : t("booking.requestToBook")}
          </Button>
        ) : (
          <Button asChild size="lg" className="w-full rounded-full shadow-md">
            <Link href={signInHref}>{t("nav.signIn")}</Link>
          </Button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
          <span>{t("booking.noChargeYet")}</span>
        </div>
      </form>
    </div>
  );
}

export default BookingWidget;
