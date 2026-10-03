import Link from "next/link";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";

import { ListingCard } from "@/components/listing-card";
import { SearchFiltersBar } from "@/components/search-filters";
import { Button } from "@/components/ui/button";
import { searchListings } from "@/lib/db/listings";
import { CITIES } from "@/lib/geo";
import { getI18n } from "@/lib/i18n/server";
import {
  filtersToQuery,
  parseSearchFilters,
  type RawSearchParams,
} from "@/lib/search";
import type { Locale } from "@/lib/types";

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { t, href, locale } = await getI18n(params);
  const filters = parseSearchFilters(await searchParams);

  const result = await searchListings(filters, locale).catch(() => ({
    listings: [],
    total: 0,
    page: 1,
    pageSize: 24,
  }));

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasPrev = filters.page > 1;
  const hasNext = filters.page < totalPages;

  // "Homes in Bole" / "Homes in አዲስ አበባ" rather than a raw database key.
  const city = CITIES.find((c) => c.key === filters.city);
  const cityLabel = city ? (locale === "am" ? city.am : city.en) : filters.city;
  const area = filters.subcity || cityLabel;
  const title = area ? t("search.inArea", { area }) : t("search.title");
  const countLabel =
    result.total === 1 ? t("search.countOne") : t("search.resultCount", { count: result.total });

  return (
    <div className="container space-y-6 py-8 sm:space-y-8 sm:py-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
          {countLabel}
        </p>
      </div>

      <SearchFiltersBar filters={filters} />

      {result.listings.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Home className="size-7" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">
            {t("search.noResults")}
          </h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("search.noResultsBody")}</p>
          <Button asChild variant="outline" className="mt-6 rounded-full">
            <Link href={href("/search")}>{t("search.clearAll")}</Link>
          </Button>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label={t("search.page", { page: filters.page, total: totalPages })}
          className="flex items-center justify-center gap-3 border-t border-border pt-6"
        >
          {hasPrev ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`${href("/search")}${filtersToQuery({ ...filters, page: filters.page - 1 })}`}>
                <ChevronLeft aria-hidden />
                {t("search.previous")}
              </Link>
            </Button>
          ) : (
            <span className="w-24" aria-hidden />
          )}

          <span className="tnum px-2 text-sm font-medium text-muted-foreground">
            {t("search.page", { page: filters.page, total: totalPages })}
          </span>

          {hasNext ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={`${href("/search")}${filtersToQuery({ ...filters, page: filters.page + 1 })}`}>
                {t("search.next")}
                <ChevronRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <span className="w-24" aria-hidden />
          )}
        </nav>
      ) : null}
    </div>
  );
}
