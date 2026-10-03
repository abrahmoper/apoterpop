"use client";

import { useState, useTransition } from "react";
import { ExternalLink, LocateFixed } from "lucide-react";
import { toast } from "sonner";

import { saveListingAction } from "@/actions/listings";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, NativeSelect, Textarea } from "@/components/ui/form";
import { CITIES, ADDIS_SUBCITIES } from "@/lib/geo";
import { useI18n } from "@/lib/i18n/client";
import { AMENITIES, PROPERTY_TYPES } from "@/lib/taxonomy";
import type { ListingRow, Locale, RentalType } from "@/lib/types";
import { cn, safeJSON } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * The editor form. Posts plain FormData to `saveListingAction`; the server
 * re-checks ownership and drops anything outside the editable column list.
 *
 * Fields that only apply to one rental type are hidden with CSS rather than
 * unmounted, so switching type and back never wipes a stored value.
 */
export function ListingEditorForm({
  listing,
  locale,
}: {
  listing: ListingRow;
  locale: Locale;
}) {
  const { t } = useI18n();
  const [isPending, startTransition] = useTransition();
  const selectedAmenities = new Set(safeJSON<string[]>(listing.amenities, []));

  const [rentalType, setRentalType] = useState<RentalType>(listing.rental_type);
  const [city, setCity] = useState(listing.city);
  const [lat, setLat] = useState(String(listing.lat ?? ""));
  const [lng, setLng] = useState(String(listing.lng ?? ""));
  const [locating, setLocating] = useState(false);

  const monthly = rentalType === "monthly";
  const isAddis = city === "Addis Ababa";
  const am = (label: string) => `${label} · ${t("wizard.inAmharic")}`;

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error(t("search.locationDenied"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        toast.error(t("search.locationDenied"));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const mapHref =
    lat && lng
      ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(lat)}&mlon=${encodeURIComponent(lng)}#map=17/${encodeURIComponent(lat)}/${encodeURIComponent(lng)}`
      : null;

  return (
    <form action={(form) => startTransition(() => saveListingAction(form))} className="space-y-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listing.id} />

      <Section title={t("wizard.step.basics")} description={t("wizard.basicsBody")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("wizard.titleLabel")} htmlFor="titleEn" required>
            <Input
              id="titleEn"
              name="titleEn"
              defaultValue={listing.title_en}
              placeholder={t("wizard.titlePlaceholder")}
              maxLength={120}
              required
            />
          </Field>
          <Field label={t("wizard.titleAmLabel")} htmlFor="titleAm" hint={t("wizard.titleAmHint")}>
            <Input id="titleAm" name="titleAm" lang="am" maxLength={120} defaultValue={listing.title_am ?? ""} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("search.propertyType")} htmlFor="propertyType">
            <NativeSelect id="propertyType" name="propertyType" defaultValue={listing.property_type}>
              {PROPERTY_TYPES.map((pt) => (
                <option key={pt.key} value={pt.key}>
                  {locale === "am" ? pt.am : pt.en}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("search.rentalType")} htmlFor="rentalType">
            <NativeSelect
              id="rentalType"
              name="rentalType"
              value={rentalType}
              onChange={(e) => setRentalType(e.target.value === "nightly" ? "nightly" : "monthly")}
            >
              <option value="monthly">{t("search.monthlyRentals")}</option>
              <option value="nightly">{t("search.nightlyStays")}</option>
            </NativeSelect>
          </Field>
          <Field label={t("search.furnishing")} htmlFor="furnished">
            <NativeSelect id="furnished" name="furnished" defaultValue={listing.furnished}>
              <option value="furnished">{t("search.furnished")}</option>
              <option value="semi">{t("wizard.semiFurnished")}</option>
              <option value="unfurnished">{t("search.unfurnished")}</option>
            </NativeSelect>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("wizard.summaryLabel")} htmlFor="summaryEn">
            <Input id="summaryEn" name="summaryEn" maxLength={160} defaultValue={listing.summary_en ?? ""} />
          </Field>
          <Field label={am(t("wizard.summaryLabel"))} htmlFor="summaryAm">
            <Input id="summaryAm" name="summaryAm" lang="am" maxLength={160} defaultValue={listing.summary_am ?? ""} />
          </Field>
        </div>

        <Field label={t("wizard.descriptionLabel")} htmlFor="descriptionEn">
          <Textarea
            id="descriptionEn"
            name="descriptionEn"
            rows={6}
            defaultValue={listing.description_en ?? ""}
            placeholder={t("wizard.descriptionPlaceholder")}
          />
        </Field>
        <Field label={am(t("wizard.descriptionLabel"))} htmlFor="descriptionAm">
          <Textarea
            id="descriptionAm"
            name="descriptionAm"
            lang="am"
            rows={6}
            defaultValue={listing.description_am ?? ""}
          />
        </Field>
      </Section>

      <Section title={t("wizard.step.rooms")} description={t("wizard.roomsBody")}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Field label={t("wizard.bedrooms")} htmlFor="bedrooms">
            <Input id="bedrooms" name="bedrooms" type="number" inputMode="numeric" min={0} defaultValue={listing.bedrooms} />
          </Field>
          <Field label={t("wizard.beds")} htmlFor="beds">
            <Input id="beds" name="beds" type="number" inputMode="numeric" min={0} defaultValue={listing.beds} />
          </Field>
          <Field label={t("wizard.bathrooms")} htmlFor="bathrooms">
            <Input
              id="bathrooms"
              name="bathrooms"
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              defaultValue={listing.bathrooms}
            />
          </Field>
          <Field label={t("wizard.maxGuests")} htmlFor="maxGuests">
            <Input id="maxGuests" name="maxGuests" type="number" inputMode="numeric" min={1} defaultValue={listing.max_guests} />
          </Field>
          <Field label={t("wizard.areaSqm")} htmlFor="areaSqm">
            <Input id="areaSqm" name="areaSqm" type="number" inputMode="numeric" min={0} defaultValue={listing.area_sqm ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title={t("wizard.step.place")} description={t("wizard.placeBody")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("wizard.cityLabel")} htmlFor="city">
            <NativeSelect id="city" name="city" value={city} onChange={(e) => setCity(e.target.value)}>
              {CITIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {locale === "am" ? c.am : c.en}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {/* Disabled fields are not posted, so a non-Addis city clears the sub-city. */}
          <Field label={t("wizard.subcityLabel")} htmlFor="subcity" className={isAddis ? undefined : "hidden sm:block sm:opacity-50"}>
            <NativeSelect id="subcity" name="subcity" defaultValue={listing.subcity ?? ""} disabled={!isAddis}>
              <option value="">{t("common.any")}</option>
              {ADDIS_SUBCITIES.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("wizard.areaLabel")} htmlFor="neighborhood">
            <Input id="neighborhood" name="neighborhood" defaultValue={listing.neighborhood ?? ""} />
          </Field>
        </div>

        <Field label={t("wizard.addressLabel")} htmlFor="addressLine" hint={t("wizard.addressHint")}>
          <Input id="addressLine" name="addressLine" defaultValue={listing.address_line ?? ""} />
        </Field>

        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("wizard.latitude")} htmlFor="lat">
              <Input
                id="lat"
                name="lat"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="tnum"
                required
              />
            </Field>
            <Field label={t("wizard.longitude")} htmlFor="lng">
              <Input
                id="lng"
                name="lng"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="tnum"
                required
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" variant="soft" size="sm" onClick={useMyLocation} loading={locating}>
              {locating ? null : <LocateFixed aria-hidden />}
              {locating ? t("search.locating") : t("wizard.useMyLocation")}
            </Button>
            {mapHref ? (
              <Button asChild type="button" variant="ghost" size="sm">
                <a href={mapHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden />
                  {t("common.viewOnMap")}
                </a>
              </Button>
            ) : null}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{t("wizard.locationHint")}</p>
        </div>
      </Section>

      <Section title={t("wizard.step.amenities")} description={t("wizard.amenitiesBody")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITIES.map((amenity) => (
            <label
              key={amenity.key}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-ink-700 transition-colors hover:bg-muted has-[:checked]:border-primary has-[:checked]:bg-primary-soft has-[:checked]:text-primary"
            >
              <input
                type="checkbox"
                name="amenities"
                value={amenity.key}
                defaultChecked={selectedAmenities.has(amenity.key)}
                className="size-4 shrink-0 accent-[#1D6F52]"
              />
              {locale === "am" ? amenity.am : amenity.en}
            </label>
          ))}
        </div>
      </Section>

      <Section title={t("wizard.step.price")} description={t("wizard.priceBody")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            label={monthly ? t("wizard.monthlyPrice") : t("wizard.nightlyPrice")}
            htmlFor="price"
            required
          >
            <div className="relative">
              <Input
                id="price"
                name="price"
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={listing.price || ""}
                className="tnum pr-14"
                required
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                ETB
              </span>
            </div>
          </Field>

          <Field label={t("wizard.depositMonths")} htmlFor="depositMonths" className={monthly ? undefined : "hidden"}>
            <Input
              id="depositMonths"
              name="depositMonths"
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={listing.deposit_months}
            />
          </Field>

          <Field label={t("wizard.minStayMonths")} htmlFor="minStayMonths" className={monthly ? undefined : "hidden"}>
            <Input
              id="minStayMonths"
              name="minStayMonths"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={listing.min_stay_months}
            />
          </Field>

          <Field label={t("wizard.minNights")} htmlFor="minNights" className={monthly ? "hidden" : undefined}>
            <Input
              id="minNights"
              name="minNights"
              type="number"
              inputMode="numeric"
              min={1}
              defaultValue={listing.min_nights}
            />
          </Field>

          <Field label={t("wizard.availableFrom")} htmlFor="availableFrom">
            <Input id="availableFrom" name="availableFrom" type="date" defaultValue={listing.available_from ?? ""} />
          </Field>
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-ink-800 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft">
          <Checkbox name="instantBook" value="1" defaultChecked={listing.instant_book === 1} />
          {t("wizard.instantBook")}
        </label>
      </Section>

      <Section title={t("wizard.rulesLabel")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("wizard.rulesLabel")} htmlFor="houseRulesEn">
            <Textarea
              id="houseRulesEn"
              name="houseRulesEn"
              rows={3}
              defaultValue={listing.house_rules_en ?? ""}
              placeholder={t("wizard.rulesPlaceholder")}
            />
          </Field>
          <Field label={am(t("wizard.rulesLabel"))} htmlFor="houseRulesAm">
            <Textarea id="houseRulesAm" name="houseRulesAm" lang="am" rows={3} defaultValue={listing.house_rules_am ?? ""} />
          </Field>
        </div>
      </Section>

      {/* Sticky so the save button is always reachable on a long form; sits
          above the mobile tab bar, flush to the bottom on desktop. */}
      <div
        className={cn(
          "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-5 flex items-center justify-end gap-3 border-t border-border bg-card/95 px-5 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 md:bottom-0",
        )}
      >
        <Button type="submit" size="lg" loading={isPending} className="w-full rounded-full sm:w-auto">
          {t("common.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
