"use client";

import { Clock, MapPin, Phone, ShieldCheck, Star, Truck, Zap } from "lucide-react";

import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { photoUrl, providerPlaceholder } from "@/lib/photos";
import { serviceCategoryTerm } from "@/lib/taxonomy";
import { formatDistance, formatPhone } from "@/lib/utils";
import type { ProviderCardModel } from "@/lib/types";

export function ProviderCard({
  provider,
  isOpen,
  className = "",
}: {
  provider: ProviderCardModel;
  /**
   * Computed on the server with the Addis (UTC+3) clock via `isOpenNow`.
   * Recomputing here would use the visitor's timezone and show shops shut
   * when they are open. When omitted, no open/closed label is shown.
   */
  isOpen?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();

  const term = serviceCategoryTerm(provider.category);
  const categoryLabel = term ? (locale === "am" ? term.am : term.en) : provider.category;

  const locationText = [provider.neighborhood, provider.subcity, provider.city]
    .filter(Boolean)
    .join(", ");

  const imageUrl = `${photoUrl(provider.photoKey ?? providerPlaceholder(provider.id))}?w=600&h=400`;

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift ${className}`}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={provider.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant="glass" className="font-semibold text-primary">
            {categoryLabel}
          </Badge>
          {provider.verified ? (
            <Badge variant="glass" className="text-primary" title={t("common.verified")}>
              <ShieldCheck className="size-3.5" aria-hidden />
              <span className="sr-only">{t("common.verified")}</span>
            </Badge>
          ) : null}
        </div>

        {provider.distanceKm !== undefined ? (
          <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {formatDistance(provider.distanceKm)}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-display text-base font-semibold text-foreground transition-colors group-hover:text-primary">
            {provider.name}
          </h3>
          {provider.ratingAvg > 0 ? (
            <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-800">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
              <span>{provider.ratingAvg.toFixed(1)}</span>
            </div>
          ) : null}
        </div>

        {provider.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {provider.description}
          </p>
        ) : null}

        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0 text-ink-400" aria-hidden />
          <span className="truncate">{locationText || provider.addressLine}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {provider.emergency ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <Zap className="size-3" aria-hidden />
              {/* The label already reads "24/7 emergency" */}
              <span>{t("services.emergency")}</span>
            </Badge>
          ) : isOpen !== undefined ? (
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                isOpen ? "text-eucalyptus-700" : "text-muted-foreground"
              }`}
            >
              <span
                className={`size-2 rounded-full ${isOpen ? "bg-eucalyptus-500" : "bg-ink-300"}`}
                aria-hidden
              />
              {isOpen ? t("services.openNow") : t("services.closed")}
              {provider.opensAt && provider.closesAt ? (
                <span className="tnum inline-flex items-center gap-1 font-normal text-muted-foreground">
                  <Clock className="size-3" aria-hidden />
                  {provider.opensAt}–{provider.closesAt}
                </span>
              ) : null}
            </span>
          ) : null}

          {provider.delivery ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Truck className="size-3" aria-hidden />
              <span>{t("services.delivery")}</span>
            </Badge>
          ) : null}
        </div>

        {provider.phone ? (
          <div className="mt-auto pt-4">
            <Button asChild variant="soft" className="w-full">
              <a href={`tel:${provider.phone}`} aria-label={`${t("services.callNow")}: ${provider.name}`}>
                <Phone aria-hidden />
                <span className="tnum">{formatPhone(provider.phone)}</span>
              </a>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProviderCard;
