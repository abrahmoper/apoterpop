/** Row shapes as they come back from D1, plus the view models pages consume. */

export type Locale = "en" | "am";

export type RentalType = "monthly" | "nightly";

export type ListingStatus = "draft" | "published" | "paused" | "removed";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export type Furnished = "furnished" | "semi" | "unfurnished";

export interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  password_hash: string;
  avatar_key: string | null;
  bio: string | null;
  locale: string;
  is_host: number;
  is_admin: number;
  phone_verified: number;
  email_verified: number;
  city: string | null;
  response_rate: number;
  created_at: string;
  updated_at: string | null;
}

/** What the app passes around — never includes the password hash. */
export interface SessionUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarKey: string | null;
  bio: string | null;
  locale: Locale;
  isHost: boolean;
  isAdmin: boolean;
  city: string | null;
  responseRate: number;
  createdAt: string;
}

export interface ListingRow {
  id: string;
  host_id: string;
  title_en: string;
  title_am: string | null;
  summary_en: string | null;
  summary_am: string | null;
  description_en: string | null;
  description_am: string | null;
  property_type: string;
  rental_type: RentalType;
  price: number;
  deposit_months: number;
  currency: string;
  bedrooms: number;
  beds: number;
  bathrooms: number;
  max_guests: number;
  area_sqm: number | null;
  furnished: Furnished;
  amenities: string;
  house_rules_en: string | null;
  house_rules_am: string | null;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  address_line: string | null;
  lat: number;
  lng: number;
  min_stay_months: number;
  min_nights: number;
  available_from: string | null;
  instant_book: number;
  status: ListingStatus;
  verified: number;
  rating_avg: number;
  rating_count: number;
  view_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface ListingPhotoRow {
  id: string;
  listing_id: string;
  key: string;
  alt_en: string | null;
  alt_am: string | null;
  sort_order: number;
}

export interface ProviderRow {
  id: string;
  owner_id: string | null;
  name_en: string;
  name_am: string | null;
  category: string;
  description_en: string | null;
  description_am: string | null;
  phone: string | null;
  phone_alt: string | null;
  website: string | null;
  address_line: string | null;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  opens_at: string | null;
  closes_at: string | null;
  open_days: string;
  price_level: number | null;
  delivery: number;
  emergency_24_7: number;
  photo_key: string | null;
  verified: number;
  status: string;
  rating_avg: number;
  rating_count: number;
  created_at: string;
}

export interface BookingRow {
  id: string;
  code: string;
  listing_id: string;
  guest_id: string;
  host_id: string;
  start_date: string;
  end_date: string;
  rental_type: RentalType;
  units: number;
  guests: number;
  unit_price: number;
  subtotal: number;
  service_fee: number;
  deposit: number;
  total: number;
  currency: string;
  status: BookingStatus;
  guest_message: string | null;
  host_note: string | null;
  created_at: string;
  updated_at: string | null;
  responded_at: string | null;
}

export interface ReviewRow {
  id: string;
  listing_id: string;
  author_id: string;
  booking_id: string | null;
  rating: number;
  cleanliness: number | null;
  accuracy: number | null;
  location_score: number | null;
  value_score: number | null;
  communication: number | null;
  comment: string | null;
  host_reply: string | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  listing_id: string | null;
  booking_id: string | null;
  guest_id: string;
  host_id: string;
  last_message: string | null;
  last_message_at: string | null;
  guest_unread: number;
  host_unread: number;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  kind: string;
  title_en: string;
  title_am: string | null;
  body_en: string | null;
  body_am: string | null;
  href: string | null;
  read: number;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/*  View models                                                                */
/* -------------------------------------------------------------------------- */

/** A listing joined with its photos, host and (optionally) distance. */
export interface ListingCardModel {
  id: string;
  title: string;
  summary: string | null;
  propertyType: string;
  rentalType: RentalType;
  price: number;
  currency: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  areaSqm: number | null;
  furnished: Furnished;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingCount: number;
  verified: boolean;
  instantBook: boolean;
  status: ListingStatus;
  photos: string[];
  hostName: string;
  hostId: string;
  hostAvatarKey: string | null;
  distanceKm?: number;
  isFavorite?: boolean;
  /** Powers the neighbourhood ring on the card. */
  nearby?: NearbyHighlight[];
}

export interface NearbyHighlight {
  category: string;
  name: string;
  distanceKm: number;
}

/** Everything the listing detail page needs, on top of the card fields. */
export interface ListingDetailModel extends ListingCardModel {
  description: string | null;
  houseRules: string | null;
  amenityKeys: string[];
  beds: number;
  depositMonths: number;
  currency: string;
  minStayMonths: number;
  minNights: number;
  availableFrom: string | null;
  /** Only filled in for the host and for guests with a confirmed booking. */
  addressLine: string | null;
  viewCount: number;
  createdAt: string;
  hostBio: string | null;
  hostSince: string;
  hostResponseRate: number;
  /** Revealed once a booking is confirmed. */
  hostPhone: string | null;
  photoAlts: string[];
  ratingBreakdown: {
    cleanliness: number;
    accuracy: number;
    location: number;
    value: number;
    communication: number;
  };
}

export interface ProviderCardModel {
  id: string;
  name: string;
  category: string;
  description: string | null;
  phone: string | null;
  addressLine: string | null;
  city: string;
  subcity: string | null;
  neighborhood: string | null;
  lat: number;
  lng: number;
  opensAt: string | null;
  closesAt: string | null;
  openDays: number[];
  priceLevel: number | null;
  delivery: boolean;
  emergency: boolean;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  photoKey: string | null;
  distanceKm?: number;
}

export interface BookingModel extends BookingRow {
  listingTitle: string;
  listingPhoto: string | null;
  listingCity: string;
  listingNeighborhood: string | null;
  guestName: string;
  guestPhone: string | null;
  guestAvatarKey: string | null;
  hostName: string;
  hostPhone: string | null;
  hostAvatarKey: string | null;
  hasReview?: boolean;
}

export interface ReviewModel extends ReviewRow {
  authorName: string;
  authorAvatarKey: string | null;
}

export interface ConversationModel extends ConversationRow {
  otherName: string;
  otherAvatarKey: string | null;
  otherId: string;
  listingTitle: string | null;
  listingPhoto: string | null;
  unread: number;
  role: "guest" | "host";
}

/** Search filters, parsed from the URL so every result page is shareable. */
export interface SearchFilters {
  q: string;
  city: string;
  subcity: string;
  rentalType: RentalType | "";
  propertyTypes: string[];
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnished: Furnished | "";
  amenities: string[];
  instantBook: boolean;
  verifiedOnly: boolean;
  nearLat: number | null;
  nearLng: number | null;
  radiusKm: number | null;
  bounds: string;
  sort: SearchSort;
  page: number;
}

export type SearchSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating"
  | "newest"
  | "distance";

export interface SearchResult {
  listings: ListingCardModel[];
  total: number;
  page: number;
  pageSize: number;
}
