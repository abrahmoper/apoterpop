"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Loader2, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, NativeSelect } from "@/components/ui/form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/overlay";
import { useI18n } from "@/lib/i18n/client";
import { CITIES, ADDIS_SUBCITIES } from "@/lib/geo";
import { AMENITIES, PROPERTY_TYPES } from "@/lib/taxonomy";
import { activeFilterCount } from "@/lib/search";
import type { Furnished, RentalType, SearchFilters } from "@/lib/types";
import { cn } from "@/lib/utils";

/** A segmented choice button; aria-pressed makes the selection audible. */
function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "min-h-11 rounded-xl border px-2 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-ink-700 hover:border-ink-300 hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** A removable filter pill with a real, labelled button. */
function Pill({ label, onRemove, removeLabel }: { label: string; onRemove: () => void; removeLabel: string }) {
  return (
    <span className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/20 bg-primary-soft pl-3.5 pr-1 text-sm font-medium text-primary">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${label}`}
        className="grid size-7 place-items-center rounded-full transition-colors hover:bg-primary/10"
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}

export function SearchFiltersBar({ filters }: { filters: SearchFilters }) {
  const { t, href, locale } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const uid = useId();

  const [draftCity, setDraftCity] = useState(filters.city);
  const [draftSubcity, setDraftSubcity] = useState(filters.subcity);
  const [draftRentalType, setDraftRentalType] = useState<RentalType | "">(filters.rentalType);
  const [draftPropertyTypes, setDraftPropertyTypes] = useState<string[]>(filters.propertyTypes);
  const [draftMinPrice, setDraftMinPrice] = useState(filters.minPrice?.toString() ?? "");
  const [draftMaxPrice, setDraftMaxPrice] = useState(filters.maxPrice?.toString() ?? "");
  const [draftBedrooms, setDraftBedrooms] = useState(filters.bedrooms?.toString() ?? "");
  const [draftBathrooms, setDraftBathrooms] = useState(filters.bathrooms?.toString() ?? "");
  const [draftFurnished, setDraftFurnished] = useState<Furnished | "">(filters.furnished);
  const [draftAmenities, setDraftAmenities] = useState<string[]>(filters.amenities);
  const [draftVerified, setDraftVerified] = useState(filters.verifiedOnly);
  const [draftInstant, setDraftInstant] = useState(filters.instantBook);

  const syncDrafts = (f: SearchFilters) => {
    setDraftCity(f.city);
    setDraftSubcity(f.subcity);
    setDraftRentalType(f.rentalType);
    setDraftPropertyTypes(f.propertyTypes);
    setDraftMinPrice(f.minPrice?.toString() ?? "");
    setDraftMaxPrice(f.maxPrice?.toString() ?? "");
    setDraftBedrooms(f.bedrooms?.toString() ?? "");
    setDraftBathrooms(f.bathrooms?.toString() ?? "");
    setDraftFurnished(f.furnished);
    setDraftAmenities(f.amenities);
    setDraftVerified(f.verifiedOnly);
    setDraftInstant(f.instantBook);
  };

  const navigate = (sp: URLSearchParams) => {
    const query = sp.toString();
    startTransition(() => {
      router.push(query ? `${href("/search")}?${query}` : href("/search"));
    });
  };

  const setOrDelete = (sp: URLSearchParams, key: string, value: string) => {
    if (value) sp.set(key, value);
    else sp.delete(key);
  };

  const applyFilters = () => {
    const sp = new URLSearchParams(searchParams.toString());

    // A reversed range is almost always a typo; fix it instead of returning nothing.
    let min = draftMinPrice.replace(/[^\d]/g, "");
    let max = draftMaxPrice.replace(/[^\d]/g, "");
    if (min && max && Number(min) > Number(max)) [min, max] = [max, min];

    setOrDelete(sp, "city", draftCity);
    setOrDelete(sp, "subcity", draftCity === "Addis Ababa" ? draftSubcity : "");
    setOrDelete(sp, "rentalType", draftRentalType);
    setOrDelete(sp, "propertyType", draftPropertyTypes.join(","));
    setOrDelete(sp, "minPrice", min);
    setOrDelete(sp, "maxPrice", max);
    setOrDelete(sp, "bedrooms", draftBedrooms);
    setOrDelete(sp, "bathrooms", draftBathrooms);
    setOrDelete(sp, "furnished", draftFurnished);
    setOrDelete(sp, "amenities", draftAmenities.join(","));
    setOrDelete(sp, "verified", draftVerified ? "1" : "");
    setOrDelete(sp, "instantBook", draftInstant ? "1" : "");
    sp.delete("page");

    setOpen(false);
    navigate(sp);
  };

  const clearFilters = () => {
    syncDrafts({
      ...filters,
      city: "",
      subcity: "",
      rentalType: "",
      propertyTypes: [],
      minPrice: null,
      maxPrice: null,
      bedrooms: null,
      bathrooms: null,
      furnished: "",
      amenities: [],
      verifiedOnly: false,
      instantBook: false,
    });
    setOpen(false);
    navigate(new URLSearchParams());
  };

  const removeParams = (...keys: string[]) => {
    const sp = new URLSearchParams(searchParams.toString());
    keys.forEach((key) => sp.delete(key));
    sp.delete("page");
    navigate(sp);
  };

  const handleSortChange = (newSort: string) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("sort", newSort);
    sp.delete("page");
    navigate(sp);
  };

  const toggleIn = (list: string[], key: string, on: boolean) =>
    on ? Array.from(new Set([...list, key])) : list.filter((k) => k !== key);

  const count = activeFilterCount(filters);
  const city = CITIES.find((c) => c.key === filters.city);
  const cityLabel = city ? (locale === "am" ? city.am : city.en) : filters.city;
  const removeLabel = t("common.remove");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/80 p-3 shadow-sm backdrop-blur-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sheet
          open={open}
          onOpenChange={(isOpen) => {
            setOpen(isOpen);
            if (isOpen) syncDrafts(filters);
          }}
        >
          <SheetTrigger asChild>
            <Button variant="outline" className="rounded-full font-medium">
              <SlidersHorizontal aria-hidden />
              <span>{t("search.filters")}</span>
              {count > 0 ? (
                <span className="tnum grid size-5 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {count}
                </span>
              ) : null}
            </Button>
          </SheetTrigger>

          <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
            <SheetHeader className="border-b border-border p-5 sm:p-6">
              <SheetTitle>{t("search.filters")}</SheetTitle>
              <SheetDescription>{t("search.filtersSummary")}</SheetDescription>
            </SheetHeader>

            <div className="flex-1 space-y-7 overflow-y-auto p-5 sm:p-6">
              <section className="space-y-2">
                <Label htmlFor={`${uid}-city`}>{t("search.city")}</Label>
                <NativeSelect
                  id={`${uid}-city`}
                  value={draftCity}
                  onChange={(e) => {
                    setDraftCity(e.target.value);
                    if (e.target.value !== "Addis Ababa") setDraftSubcity("");
                  }}
                >
                  <option value="">{t("search.anywhere")}</option>
                  {CITIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {locale === "am" ? c.am : c.en}
                    </option>
                  ))}
                </NativeSelect>

                {draftCity === "Addis Ababa" ? (
                  <div className="space-y-2 pt-2">
                    <Label htmlFor={`${uid}-subcity`}>{t("search.subcity")}</Label>
                    <NativeSelect
                      id={`${uid}-subcity`}
                      value={draftSubcity}
                      onChange={(e) => setDraftSubcity(e.target.value)}
                    >
                      <option value="">{t("common.any")}</option>
                      {ADDIS_SUBCITIES.map((sc) => (
                        <option key={sc} value={sc}>
                          {sc}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                ) : null}
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-ink-800">{t("search.rentalType")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Choice active={draftRentalType === ""} onClick={() => setDraftRentalType("")}>
                    {t("common.any")}
                  </Choice>
                  <Choice
                    active={draftRentalType === "monthly"}
                    onClick={() => setDraftRentalType("monthly")}
                  >
                    {t("search.monthlyRentals")}
                  </Choice>
                  <Choice
                    active={draftRentalType === "nightly"}
                    onClick={() => setDraftRentalType("nightly")}
                  >
                    {t("search.nightlyStays")}
                  </Choice>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-ink-800">{t("search.priceRange")} (ETB)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`${uid}-min`} className="text-xs text-muted-foreground">
                      {t("search.minPrice")}
                    </Label>
                    <Input
                      id={`${uid}-min`}
                      inputMode="numeric"
                      placeholder="0"
                      value={draftMinPrice}
                      onChange={(e) => setDraftMinPrice(e.target.value)}
                      className="tnum"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`${uid}-max`} className="text-xs text-muted-foreground">
                      {t("search.maxPrice")}
                    </Label>
                    <Input
                      id={`${uid}-max`}
                      inputMode="numeric"
                      placeholder={t("common.any")}
                      value={draftMaxPrice}
                      onChange={(e) => setDraftMaxPrice(e.target.value)}
                      className="tnum"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-ink-800">{t("search.propertyType")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROPERTY_TYPES.map((pt) => {
                    const checked = draftPropertyTypes.includes(pt.key);
                    return (
                      <label
                        key={pt.key}
                        className={cn(
                          "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary-soft font-medium text-primary"
                            : "border-border bg-card text-ink-700 hover:bg-muted",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            setDraftPropertyTypes(toggleIn(draftPropertyTypes, pt.key, !!c))
                          }
                        />
                        <span>{locale === "am" ? pt.am : pt.en}</span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-beds`}>{t("search.bedrooms")}</Label>
                  <NativeSelect
                    id={`${uid}-beds`}
                    value={draftBedrooms}
                    onChange={(e) => setDraftBedrooms(e.target.value)}
                  >
                    <option value="">{t("common.any")}</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}+
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${uid}-baths`}>{t("search.bathrooms")}</Label>
                  <NativeSelect
                    id={`${uid}-baths`}
                    value={draftBathrooms}
                    onChange={(e) => setDraftBathrooms(e.target.value)}
                  >
                    <option value="">{t("common.any")}</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>
                        {n}+
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-ink-800">{t("search.furnishing")}</p>
                <div className="grid grid-cols-3 gap-2">
                  <Choice active={draftFurnished === ""} onClick={() => setDraftFurnished("")}>
                    {t("common.any")}
                  </Choice>
                  <Choice
                    active={draftFurnished === "furnished"}
                    onClick={() => setDraftFurnished("furnished")}
                  >
                    {t("search.furnished")}
                  </Choice>
                  <Choice
                    active={draftFurnished === "unfurnished"}
                    onClick={() => setDraftFurnished("unfurnished")}
                  >
                    {t("search.unfurnished")}
                  </Choice>
                </div>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-medium text-ink-800">{t("listing.amenities")}</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {AMENITIES.map((am) => (
                    <label
                      key={am.key}
                      className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm text-ink-700 hover:bg-muted/60"
                    >
                      <Checkbox
                        checked={draftAmenities.includes(am.key)}
                        onCheckedChange={(c) =>
                          setDraftAmenities(toggleIn(draftAmenities, am.key, !!c))
                        }
                      />
                      <span>{locale === "am" ? am.am : am.en}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="space-y-1 border-t border-border pt-4">
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-ink-800">
                  <span>{t("search.verifiedOnly")}</span>
                  <Checkbox checked={draftVerified} onCheckedChange={(c) => setDraftVerified(!!c)} />
                </label>
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-ink-800">
                  <span>{t("search.instantBook")}</span>
                  <Checkbox checked={draftInstant} onCheckedChange={(c) => setDraftInstant(!!c)} />
                </label>
              </section>
            </div>

            <SheetFooter className="mt-0 flex-row items-center justify-between gap-3 border-t border-border bg-card p-4 sm:p-5">
              <Button variant="ghost" onClick={clearFilters}>
                {t("search.clearAll")}
              </Button>
              <Button onClick={applyFilters} loading={isPending} className="flex-1 sm:flex-none">
                {t("common.apply")}
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {filters.rentalType ? (
          <Pill
            label={
              filters.rentalType === "monthly" ? t("search.monthlyRentals") : t("search.nightlyStays")
            }
            removeLabel={removeLabel}
            onRemove={() => removeParams("rentalType")}
          />
        ) : null}

        {filters.city ? (
          <Pill label={cityLabel} removeLabel={removeLabel} onRemove={() => removeParams("city", "subcity")} />
        ) : null}

        {filters.subcity ? (
          <Pill label={filters.subcity} removeLabel={removeLabel} onRemove={() => removeParams("subcity")} />
        ) : null}

        {count > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            {t("search.clearAll")}
          </Button>
        ) : null}

        {isPending ? (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("common.loading")} />
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`${uid}-sort`} className="hidden text-sm text-muted-foreground sm:inline">
          {t("search.sortBy")}
        </label>
        <NativeSelect
          id={`${uid}-sort`}
          aria-label={t("search.sortBy")}
          value={filters.sort}
          onChange={(e) => handleSortChange(e.target.value)}
          className="min-h-10 rounded-full py-2 pl-4 font-medium"
        >
          <option value="recommended">{t("search.sortRecommended")}</option>
          <option value="newest">{t("search.sortNewest")}</option>
          <option value="price_asc">{t("search.sortPriceAsc")}</option>
          <option value="price_desc">{t("search.sortPriceDesc")}</option>
          <option value="rating">{t("search.sortRating")}</option>
          {filters.nearLat !== null ? <option value="distance">{t("search.nearMe")}</option> : null}
        </NativeSelect>
      </div>
    </div>
  );
}
