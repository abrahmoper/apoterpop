"use server";

/**
 * Host listing actions.
 *
 * The editor posts plain FormData and every write goes through `updateListing`,
 * which drops any column a host is not allowed to set. Photos go straight into
 * R2 from the action, after the same ownership check as every other write.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireHost } from "@/lib/auth";
import { getPhotos } from "@/lib/cf";
import {
  addPhoto,
  createListingDraft,
  getOwnedListing,
  removePhoto,
  setCoverPhoto,
  setListingStatus,
  updateListing,
  type ListingPatch,
} from "@/lib/db/listings";
import { coerceLocale, localeHref } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/messages";
import { MAX_PHOTO_BYTES, isPlaceholderKey, newObjectName } from "@/lib/photos";
import type { ListingStatus } from "@/lib/types";
import { AMENITY_MAP } from "@/lib/taxonomy";
import { boolField, field } from "@/lib/utils";

/** Opens a fresh draft and drops the host into the editor. */
export async function createListingAction(form: FormData): Promise<void> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireHost(locale, field(form, "returnTo") || undefined);
  const id = await createListingDraft(user.id, field(form, "title") || "Untitled listing");
  revalidatePath("/[locale]/host", "page");
  redirect(localeHref(locale, `/host/listing/${id}`));
}

/** Persists the editor form; junk numbers fall back to sane defaults. */
export async function saveListingAction(form: FormData): Promise<void> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireHost(locale, "/host");

  const id = field(form, "listingId");
  const amenities = form
    .getAll("amenities")
    .filter((value): value is string => typeof value === "string" && value in AMENITY_MAP);

  const patch: ListingPatch = {
    title_en: field(form, "titleEn"),
    title_am: field(form, "titleAm") || null,
    summary_en: field(form, "summaryEn") || null,
    summary_am: field(form, "summaryAm") || null,
    description_en: field(form, "descriptionEn") || null,
    description_am: field(form, "descriptionAm") || null,
    house_rules_en: field(form, "houseRulesEn") || null,
    house_rules_am: field(form, "houseRulesAm") || null,
    property_type: field(form, "propertyType") || "apartment",
    rental_type: field(form, "rentalType") === "nightly" ? "nightly" : "monthly",
    price: Number(field(form, "price")) || 0,
    deposit_months: Math.max(0, Number(field(form, "depositMonths")) || 0),
    bedrooms: Math.max(0, Number(field(form, "bedrooms")) || 1),
    beds: Math.max(0, Number(field(form, "beds")) || 1),
    bathrooms: Math.max(0, Number(field(form, "bathrooms")) || 1),
    max_guests: Math.max(1, Number(field(form, "maxGuests")) || 2),
    area_sqm: Number(field(form, "areaSqm")) || null,
    furnished: ["furnished", "semi", "unfurnished"].includes(field(form, "furnished"))
      ? field(form, "furnished")
      : "unfurnished",
    amenities: JSON.stringify(amenities),
    city: field(form, "city") || "Addis Ababa",
    subcity: field(form, "subcity") || null,
    neighborhood: field(form, "neighborhood") || null,
    address_line: field(form, "addressLine") || null,
    lat: Number(field(form, "lat")) || 9.0108,
    lng: Number(field(form, "lng")) || 38.7613,
    min_stay_months: Math.max(1, Number(field(form, "minStayMonths")) || 1),
    min_nights: Math.max(1, Number(field(form, "minNights")) || 1),
    available_from: field(form, "availableFrom") || null,
    instant_book: boolField(form, "instantBook") ? 1 : 0,
  };

  await updateListing(id, user.id, patch);
  revalidatePath("/[locale]/host", "page");
  redirect(`${localeHref(locale, `/host/listing/${id}`)}?saved=1`);
}

/** Publish, pause or unpublish. */
export async function setListingStatusAction(
  listingId: string,
  status: ListingStatus,
): Promise<{ ok: boolean; error?: MessageKey }> {
  const user = await requireHost("en", "/host");
  const updated = await setListingStatus(listingId, user.id, status);
  if (!updated) return { ok: false, error: "error.notAllowed" };

  revalidatePath("/[locale]/host", "page");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Uploads one photo into R2 and appends it to the gallery. */
export async function addListingPhotoAction(form: FormData): Promise<void> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireHost(locale, "/host");

  const listingId = field(form, "listingId");
  const file = form.get("photo");
  if (!listingId || !(file instanceof File) || file.size === 0) {
    redirect(`${localeHref(locale, `/host/listing/${listingId}`)}?photo=missing`);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    redirect(`${localeHref(locale, `/host/listing/${listingId}`)}?photo=too_big`);
  }

  // Ownership gate: without this, any host could attach photos to any listing.
  const owned = await getOwnedListing(listingId, user.id);
  if (!owned) {
    redirect(`${localeHref(locale, "/host")}?error=not_allowed`);
  }

  const bucket = await getPhotos();
  const name = newObjectName("listing", user.id, file.name || "photo.jpg");
  await bucket.put(name, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || "image/jpeg" },
  });

  await addPhoto(listingId, `r2:${name}`, null, null);
  revalidatePath("/[locale]/host/listing/[id]", "page");
}

/** Removes a gallery photo row and its object. */
export async function removeListingPhotoAction(form: FormData): Promise<void> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireHost(locale, "/host");

  const listingId = field(form, "listingId");
  const photoId = field(form, "photoId");
  const key = field(form, "key");

  // Same ownership gate as the upload path.
  const owned = await getOwnedListing(listingId, user.id);
  if (!owned) return;

  await removePhoto(photoId, listingId);
  if (key.startsWith("r2:")) {
    try {
      const bucket = await getPhotos();
      await bucket.delete(key.slice(3));
    } catch {
      // The row is gone; a stranded object is a cleanup job, not an error.
    }
  }
  revalidatePath("/[locale]/host/listing/[id]", "page");
}

/** Promotes a photo to cover; placeholder seeds are rejected up front. */
export async function setCoverPhotoAction(form: FormData): Promise<void> {
  const locale = coerceLocale(field(form, "locale"));
  const user = await requireHost(locale, "/host");
  if (isPlaceholderKey(field(form, "key"))) return;

  const listingId = field(form, "listingId");
  const owned = await getOwnedListing(listingId, user.id);
  if (!owned) return;

  await setCoverPhoto(listingId, field(form, "photoId"));
  revalidatePath("/[locale]/host/listing/[id]", "page");
}


