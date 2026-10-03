"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { respondBookingAction } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlay";
import { useI18n } from "@/lib/i18n/client";

/** Accept / decline controls for one pending request. */
export function BookingRespondButtons({ bookingId }: { bookingId: string }) {
  const { t, locale } = useI18n();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const respond = (decision: "confirmed" | "declined") => {
    startTransition(async () => {
      const res = await respondBookingAction(bookingId, decision, note || undefined, locale);
      if (res.ok) {
        setDeclineOpen(false);
        toast.success(t("common.save"));
      } else {
        toast.error(t(res.error ?? "error.generic"));
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
      <Button size="sm" onClick={() => respond("confirmed")} loading={isPending}>
        {t("booking.accept")}
      </Button>

      <Dialog open={declineOpen} onOpenChange={setDeclineOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            {t("booking.decline")}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("booking.declineConfirm")}</DialogTitle>
            <DialogDescription>{t("booking.declineBody")}</DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("booking.hostNote")}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeclineOpen(false)}>
              {t("common.back")}
            </Button>
            <Button variant="destructive" onClick={() => respond("declined")} loading={isPending}>
              {t("booking.decline")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
