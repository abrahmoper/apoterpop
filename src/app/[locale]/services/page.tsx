import Link from "next/link";
import { ChevronLeft, ChevronRight, Wrench } from "lucide-react";

import { ProviderCard } from "@/components/provider-card";
import { Button } from "@/components/ui/button";
import { searchProviders, isOpenNow } from "@/lib/db/providers";
import { getI18n } from "@/lib/i18n/server";
import {
  parseProviderFilters,
  providerFiltersToQuery,
  type RawSearchParams,
} from "@/lib/search";
import { SERVICE_CATEGORIES } from "@/lib/taxonomy";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

const chip =
  "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors";

/**
 * The services directory. Filters live in the URL like the homes search, so a
 * filtered view is a shareable link.
 */
export default async function ServicesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { t, href, locale } = await getI18n(params);
  const filters = parseProviderFilters(await searchParams);

  const result = await searchProviders(filters, locale).catch(() => ({
    providers: [],
    total: 0,
    page: 1,
    pageSize: 30,
  }));

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const link = (next: Parameters<typeof providerFiltersToQuery>[0]) =>
    href(`/services${providerFiltersToQuery(next)}`);

  const toggles = [
    { key: "openNow", label: t("services.openNow"), on: filters.openNow },
    { key: "delivery", label: t("services.delivery"), on: filters.delivery },
    { key: "emergency", label: t("services.emergency"), on: filters.emergency },
    { key: "verifiedOnly", label: t("common.verified"), on: filters.verifiedOnly },
  ] as const;

  return (
    <div className="container space-y-6 py-8 sm:space-y-8 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("services.title")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {t("services.body")}
        </p>
      </div>

      {/* Categories: one swipeable rail on phones, wrapping on larger screens. */}
      <nav
        aria-label={t("services.category")}
        className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <Link
          href={link({ ...filters, category: "", page: 1 })}
          aria-current={!filters.category ? "page" : undefined}
          className={cn(
            chip,
            !filters.category
              ? "border-ink-900 bg-ink-900 text-paper"
              : "border-border bg-card text-ink-700 hover:border-ink-300",
          )}
        >
          {t("services.allCategories")}
        </Link>
        {SERVICE_CATEGORIES.map((category) => {
          const active = filters.category === category.key;
          return (
            <Link
              key={category.key}
              href={link({ ...filters, category: category.key, page: 1 })}
              aria-current={active ? "page" : undefined}
              className={cn(
                chip,
                active
                  ? "border-ink-900 bg-ink-900 text-paper"
                  : "border-border bg-card text-ink-700 hover:border-ink-300",
              )}
            >
              {locale === "am" ? category.am : category.en}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {toggles.map((toggle) => (
            <Link
              key={toggle.key}
              href={link({ ...filters, [toggle.key]: !toggle.on, page: 1 })}
              aria-pressed={toggle.on}
              role="button"
              className={cn(
                chip,
                toggle.on
                  ? "border-primary/30 bg-primary-soft text-primary"
                  : "border-border bg-card text-ink-600 hover:border-ink-300",
              )}
            >
              {toggle.label}
            </Link>
          ))}
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {t("services.count", { count: result.total })}
        </p>
      </div>

      {result.providers.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {result.providers.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} isOpen={isOpenNow(provider)} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
          <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Wrench className="size-7" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-foreground">{t("services.empty")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("services.emptyBody")}</p>
          <Button asChild variant="outline" className="mt-6 rounded-full">
            <Link href={href("/services")}>{t("search.clearAll")}</Link>
          </Button>
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label={t("search.page", { page: filters.page, total: totalPages })}
          className="flex items-center justify-center gap-3 border-t border-border pt-6"
        >
          {filters.page > 1 ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={link({ ...filters, page: filters.page - 1 })}>
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
          {filters.page < totalPages ? (
            <Button asChild variant="outline" size="sm" className="rounded-full">
              <Link href={link({ ...filters, page: filters.page + 1 })}>
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
