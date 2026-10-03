import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";

import { ListingCard } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { favoriteListings } from "@/lib/db/listings";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";

/** Saved homes, most recently saved first. */
export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const user = await getSessionUser();
  if (!user) redirect(href("/signin?next=/favorites"));

  const listings = await favoriteListings(user.id, locale).catch(() => []);

  return (
    <div className="container py-8 sm:py-12 space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("fav.title")}
      </h1>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground mb-4">
            <Heart className="size-7" aria-hidden />
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground">{t("fav.empty")}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("fav.emptyBody")}</p>
          <Button asChild className="mt-6 rounded-full">
            <Link href={href("/search")}>{t("nav.explore")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
