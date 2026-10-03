"use client";

import { Plus } from "lucide-react";

import { createListingAction } from "@/actions/listings";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/types";

/** Posts straight to the server action, which redirects into the editor. */
export function CreateListingButton({
  locale,
  returnTo,
  className,
}: {
  locale: Locale;
  returnTo: string;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <form action={createListingAction} className={className}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" className="rounded-full gap-1.5">
        <Plus className="size-4" aria-hidden />
        {t("host.newListing")}
      </Button>
    </form>
  );
}
