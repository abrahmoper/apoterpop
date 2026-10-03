"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { submitReviewAction, type ReviewFormState } from "@/actions/reviews";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/overlay";
import { useI18n } from "@/lib/i18n/client";

/** A completed stay's review dialog. One review per booking, enforced server-side. */
export function ReviewForm({
  listingId,
  bookingId,
}: {
  listingId: string;
  bookingId: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(
    submitReviewAction,
    {},
  );

  if (state.ok && open) {
    // Close once on success; the revalidation refreshes the "reviewed" flag.
    setOpen(false);
    toast.success(t("review.thanks"));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="soft" size="sm">
          {t("booking.leaveReview")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("review.writeTitle")}</DialogTitle>
          <DialogDescription>{t("review.writeBody")}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="rating" value={rating} />

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-800">
              {t("review.overall")}
            </span>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={`${n}/5`}
                  className="p-1"
                >
                  <Star
                    className={`size-7 transition-colors ${
                      n <= rating ? "fill-amber-400 text-amber-400" : "text-ink-200"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Textarea
            name="comment"
            rows={4}
            placeholder={t("review.comment")}
          />

          {state.error ? (
            <p className="text-xs font-medium text-destructive" role="alert">
              {t(state.error)}
            </p>
          ) : null}

          <Button type="submit" className="w-full" loading={pending}>
            {t("review.submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
