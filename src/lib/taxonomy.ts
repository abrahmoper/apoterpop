/**
 * The closed vocabularies of the product: property types, amenities and
 * service categories.
 *
 * These keys are stored in the database (in `property_type`, the `amenities`
 * JSON column and `category`), so a key is forever once a listing uses it —
 * renaming one here would orphan rows. Adding is always safe.
 *
 * Labels are bilingual so any component can render the right language without
 * touching the i18n dictionary, which does not enumerate these lists.
 */

export interface Term {
  key: string;
  en: string;
  am: string;
}

/* -------------------------------------------------------------------------- */
/*  Property types                                                              */
/* -------------------------------------------------------------------------- */

export const PROPERTY_TYPE_MAP: Record<string, Term> = {
  apartment: { key: "apartment", en: "Apartment", am: "አፓርትመንት" },
  house: { key: "house", en: "House", am: "ቤት" },
  condo: { key: "condo", en: "Condo", am: "ኮንዶሚኒየም" },
  villa: { key: "villa", en: "Villa", am: "ቪላ" },
  studio: { key: "studio", en: "Studio", am: "ስቱዲዮ" },
  guesthouse: { key: "guesthouse", en: "Guest house", am: "የእንግዳ ቤት" },
  room: { key: "room", en: "Single room", am: "አንድ ክፍል" },
};

export const PROPERTY_TYPES: Term[] = Object.values(PROPERTY_TYPE_MAP);

export function propertyTypeTerm(key: string): Term | null {
  return PROPERTY_TYPE_MAP[key] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Amenities                                                                   */
/* -------------------------------------------------------------------------- */

export const AMENITY_MAP: Record<string, Term> = {
  wifi: { key: "wifi", en: "Wi-Fi", am: "ዋይፋይ" },
  parking: { key: "parking", en: "Parking", am: "የመኪና ማቆሚያ" },
  water_tank: { key: "water_tank", en: "Water tank", am: "የውሃ ማጠሪያ" },
  generator: { key: "generator", en: "Backup generator", am: "ጀነሬተር" },
  security: { key: "security", en: "24/7 security", am: "የደህንነት ሰራተኛ" },
  kitchen: { key: "kitchen", en: "Full kitchen", am: "ኩሽና" },
  laundry: { key: "laundry", en: "Laundry machine", am: "ልብስ ማጠቢያ" },
  balcony: { key: "balcony", en: "Balcony", am: "ባልኮኒ" },
  elevator: { key: "elevator", en: "Elevator", am: "ኤሌቫተር" },
  garden: { key: "garden", en: "Garden", am: "አትክልት ስፍራ" },
  tv: { key: "tv", en: "TV", am: "ቲቪ" },
  air_conditioning: { key: "air_conditioning", en: "Air conditioning", am: "ኤየር ኮንዲሽነር" },
  pets_allowed: { key: "pets_allowed", en: "Pets allowed", am: "የቤት እንስሳት ይፈቀዳል" },
  borehole: { key: "borehole", en: "Borehole water", am: "የራሱ ውሃ" },
};

export const AMENITIES: Term[] = Object.values(AMENITY_MAP);

export function amenityTerm(key: string): Term | null {
  return AMENITY_MAP[key] ?? null;
}

/* -------------------------------------------------------------------------- */
/*  Service categories                                                          */
/* -------------------------------------------------------------------------- */

export const SERVICE_CATEGORY_MAP: Record<string, Term> = {
  supermarket: { key: "supermarket", en: "Supermarket", am: "ሱፐርማርኬት" },
  pharmacy: { key: "pharmacy", en: "Pharmacy", am: "ፋርማሲ" },
  clinic: { key: "clinic", en: "Clinic", am: "ክሊኒክ" },
  school: { key: "school", en: "School", am: "ትምህርት ቤት" },
  transport: { key: "transport", en: "Transport", am: "ትራንስፖርት" },
  restaurant: { key: "restaurant", en: "Restaurant", am: "ሬስቶራንት" },
  cafe: { key: "cafe", en: "Café", am: "ቡና ቤት" },
  bank: { key: "bank", en: "Bank & ATM", am: "ባንክ" },
  gym: { key: "gym", en: "Gym", am: "ጅምናዚየም" },
  salon: { key: "salon", en: "Salon & barber", am: "ሰሎን" },
  hardware: { key: "hardware", en: "Hardware", am: "ሃርድዌር" },
  laundry: { key: "laundry", en: "Laundry service", am: "ላንድሪ" },
};

export const SERVICE_CATEGORIES: Term[] = Object.values(SERVICE_CATEGORY_MAP);

/**
 * The five categories the "neighbourhood ring" on every card and listing
 * page is built from — the things you actually check before signing a lease.
 */
export const ESSENTIAL_CATEGORIES: string[] = [
  "supermarket",
  "pharmacy",
  "transport",
  "school",
  "clinic",
];

export function serviceCategoryTerm(key: string): Term | null {
  return SERVICE_CATEGORY_MAP[key] ?? null;
}
