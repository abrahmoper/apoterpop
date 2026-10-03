"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { setListingStatusAction } from "@/actions/listings";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { ListingStatus } from "@/lib/types";

/** Publish / pause / resume, matching the listing's current state. */
export function ListingStatusButton({
  listingId,
  status,
}: {
  listingId: string;
  status: ListingStatus;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();

  if (status === "removed") return null;

  const next: { target: ListingStatus; label: string } | null =
    status === "published"
      ? { target: "paused", label: t("host.pause") }
      : status === "paused"
        ? { target: "published", label: t("host.resume") }
        : { target: "published", label: t("host.publish") };

  const run = () => {
    startTransition(async () => {
      const res = await setListingStatusAction(listingId, next.target);
      if (res.ok) {
        toast.success(t("common.save"));
      } else {
        toast.error(t(res.error ?? "error.generic"));
      }
    });
  };

  return (
    <Button
      size="sm"
      variant={next.target === "published" ? "default" : "secondary"}
      onClick={run}
      loading={isPending}
    >
      {next.label}
    </Button>
  );
}
