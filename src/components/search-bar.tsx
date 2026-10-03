"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Building, Calendar, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";
import { CITIES, ADDIS_SUBCITIES } from "@/lib/geo";
import { PROPERTY_TYPES } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

const fieldShell =
  "group flex flex-col gap-1 rounded-2xl bg-muted/50 px-3.5 py-2.5 transition-colors focus-within:bg-muted focus-within:ring-2 focus-within:ring-ring/40 hover:bg-muted";
const labelClass = "flex items-center gap-1.5 text-xs font-semibold text-ink-700";
const selectClass =
  "w-full cursor-pointer appearance-none bg-transparent text-base font-medium text-foreground focus:outline-none sm:text-sm";

export function SearchBar({
  initialCity = "",
  initialSubcity = "",
  initialRentalType = "",
  initialPropertyType = "",
  variant = "hero",
}: {
  initialCity?: string;
  initialSubcity?: string;
  initialRentalType?: string;
  initialPropertyType?: string;
  variant?: "hero" | "compact";
}) {
  const { t, href, locale } = useI18n();
  const router = useRouter();
  const uid = useId();

  const [city, setCity] = useState(initialCity || "Addis Ababa");
  const [subcity, setSubcity] = useState(initialSubcity);
  const [rentalType, setRentalType] = useState(initialRentalType);
  const [propertyType, setPropertyType] = useState(initialPropertyType);

  const isAddis = city === "Addis Ababa";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (subcity && isAddis) params.set("subcity", subcity);
    if (rentalType) params.set("rentalType", rentalType);
    if (propertyType) params.set("propertyType", propertyType);
    const query = params.toString();
    router.push(href(query ? `/search?${query}` : "/search"));
  };

  if (variant === "compact") {
    return (
      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2" role="search">
        <div className="relative flex-1">
          <MapPin
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("search.locationPlaceholder")}
            aria-label={t("search.city")}
            className="h-11 w-full rounded-full border border-border bg-card pl-10 pr-4 text-base focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
          />
        </div>
        <Button type="submit" className="shrink-0 rounded-full" aria-label={t("common.search")}>
          <Search aria-hidden />
          <span className="hidden sm:inline">{t("common.search")}</span>
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="w-full max-w-4xl rounded-3xl border border-border/80 bg-card/95 p-3 text-left shadow-lift backdrop-blur-md sm:p-4"
    >
      <div className={cn("grid grid-cols-1 gap-2.5 sm:grid-cols-2", isAddis ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <div className={fieldShell}>
          <label htmlFor={`${uid}-city`} className={labelClass}>
            <MapPin className="size-3.5 text-primary" aria-hidden />
            {t("search.city")}
          </label>
          <select
            id={`${uid}-city`}
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              if (e.target.value !== "Addis Ababa") setSubcity("");
            }}
            className={selectClass}
          >
            {CITIES.map((c) => (
              <option key={c.key} value={c.key}>
                {locale === "am" ? c.am : c.en}
              </option>
            ))}
          </select>
        </div>

        {/* Sub-cities only exist for Addis; hiding beats a disabled box. */}
        {isAddis ? (
          <div className={fieldShell}>
            <label htmlFor={`${uid}-subcity`} className={labelClass}>
              <MapPin className="size-3.5 text-ink-400" aria-hidden />
              {t("search.subcity")}
            </label>
            <select
              id={`${uid}-subcity`}
              value={subcity}
              onChange={(e) => setSubcity(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("common.any")}</option>
              {ADDIS_SUBCITIES.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className={fieldShell}>
          <label htmlFor={`${uid}-rental`} className={labelClass}>
            <Calendar className="size-3.5 text-primary" aria-hidden />
            {t("search.rentalType")}
          </label>
          <select
            id={`${uid}-rental`}
            value={rentalType}
            onChange={(e) => setRentalType(e.target.value)}
            className={selectClass}
          >
            <option value="">{t("search.anyRentalType")}</option>
            <option value="monthly">{t("search.monthlyRentals")}</option>
            <option value="nightly">{t("search.nightlyStays")}</option>
          </select>
        </div>

        <div className={fieldShell}>
          <label htmlFor={`${uid}-type`} className={labelClass}>
            <Building className="size-3.5 text-ink-400" aria-hidden />
            {t("search.propertyType")}
          </label>
          <select
            id={`${uid}-type`}
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className={selectClass}
          >
            <option value="">{t("common.any")}</option>
            {PROPERTY_TYPES.map((pt) => (
              <option key={pt.key} value={pt.key}>
                {locale === "am" ? pt.am : pt.en}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="submit" size="lg" className="w-full shadow-md sm:w-auto">
          <Search aria-hidden />
          {t("search.searchButton")}
        </Button>
      </div>
    </form>
  );
}

export default SearchBar;
