"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { toast } from "sonner";

import { startThreadAction } from "@/actions/messages";
import { Button } from "@/components/ui/button";
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

export function MessageHostDialog({
  listingId,
  hostId,
  hostName,
  userSignedIn,
}: {
  listingId: string;
  hostId: string;
  hostName: string;
  userSignedIn: boolean;
}) {
  const { t, href, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const uid = useId();

  if (!userSignedIn) {
    const next = encodeURIComponent(href(`/listing/${listingId}`));
    return (
      <Button asChild variant="outline" className="rounded-full">
        <Link href={href(`/signin?next=${next}`)}>
          <Mail aria-hidden />
          {t("listing.messageHost")}
        </Link>
      </Button>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!body.trim()) {
      toast.error(t("error.messageEmpty"));
      return;
    }

    const form = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        // On success the action redirects into the new thread.
        await startThreadAction(form);
        setOpen(false);
      } catch (err: unknown) {
        const digest = (err as { digest?: string } | null)?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
          setOpen(false);
          throw err;
        }
        toast.error(t("error.generic"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <Mail aria-hidden />
          {t("listing.messageHost")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("listing.messageHost")}</DialogTitle>
          <DialogDescription>{t("messaging.threadWith", { name: hostName })}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="hostId" value={hostId} />
          <input type="hidden" name="listingId" value={listingId} />
          <input type="hidden" name="returnTo" value={`/listing/${listingId}`} />

          <div className="space-y-1.5">
            <label htmlFor={`${uid}-body`} className="block text-sm font-medium text-ink-800">
              {t("messaging.message")}
            </label>
            <textarea
              id={`${uid}-body`}
              required
              name="body"
              rows={5}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("messaging.inputPlaceholder")}
              className="w-full resize-y rounded-xl border border-input bg-card p-3 text-base leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
            />
            <p className="tnum text-right text-xs text-ink-400">{body.length}/2000</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" loading={isPending} disabled={isPending || !body.trim()}>
              {t("messaging.send")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MessageHostDialog;
