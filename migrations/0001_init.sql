-- ---------------------------------------------------------------------------
-- Kiray — initial schema
--
-- Everything user-visible is stored twice where it needs translating: *_en and
-- *_am. Amharic columns are nullable and the app falls back to English, so a
-- host can publish in one language and add the other later.
--
-- Coordinates live as plain reals with a composite index. Search does a
-- bounding-box prefilter in SQL (index-friendly) and the exact haversine
-- ordering happens in the worker.
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  full_name       TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT UNIQUE,
  password_hash   TEXT NOT NULL,
  avatar_key      TEXT,
  bio             TEXT,
  locale          TEXT NOT NULL DEFAULT 'en',
  is_host         INTEGER NOT NULL DEFAULT 0,
  is_admin        INTEGER NOT NULL DEFAULT 0,
  phone_verified  INTEGER NOT NULL DEFAULT 0,
  email_verified  INTEGER NOT NULL DEFAULT 0,
  city            TEXT,
  response_rate   INTEGER NOT NULL DEFAULT 100,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_phone ON users (phone);

-- The cookie holds a random token; only its SHA-256 is stored here.
CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sessions_user ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);

-- ---------------------------------------------------------------------------
-- Rentals
-- ---------------------------------------------------------------------------

CREATE TABLE listings (
  id                TEXT PRIMARY KEY,
  host_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  title_en          TEXT NOT NULL,
  title_am          TEXT,
  summary_en        TEXT,
  summary_am        TEXT,
  description_en    TEXT,
  description_am    TEXT,

  property_type     TEXT NOT NULL DEFAULT 'apartment',
  rental_type       TEXT NOT NULL DEFAULT 'monthly',   -- monthly | nightly
  price             REAL NOT NULL,                     -- per month or per night
  deposit_months    INTEGER NOT NULL DEFAULT 1,
  currency          TEXT NOT NULL DEFAULT 'ETB',

  bedrooms          INTEGER NOT NULL DEFAULT 1,
  beds              INTEGER NOT NULL DEFAULT 1,
  bathrooms         REAL NOT NULL DEFAULT 1,
  max_guests        INTEGER NOT NULL DEFAULT 2,
  area_sqm          INTEGER,
  furnished         TEXT NOT NULL DEFAULT 'unfurnished', -- furnished | semi | unfurnished
  amenities         TEXT NOT NULL DEFAULT '[]',          -- JSON array of amenity keys
  house_rules_en    TEXT,
  house_rules_am    TEXT,

  city              TEXT NOT NULL DEFAULT 'Addis Ababa',
  subcity           TEXT,
  neighborhood      TEXT,
  address_line      TEXT,
  lat               REAL NOT NULL,
  lng               REAL NOT NULL,

  min_stay_months   INTEGER NOT NULL DEFAULT 1,
  min_nights        INTEGER NOT NULL DEFAULT 1,
  available_from    TEXT,
  instant_book      INTEGER NOT NULL DEFAULT 0,

  status            TEXT NOT NULL DEFAULT 'draft',      -- draft | published | paused | removed
  verified          INTEGER NOT NULL DEFAULT 0,
  rating_avg        REAL NOT NULL DEFAULT 0,
  rating_count      INTEGER NOT NULL DEFAULT 0,
  view_count        INTEGER NOT NULL DEFAULT 0,

  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT
);

CREATE INDEX idx_listings_geo ON listings (lat, lng);
CREATE INDEX idx_listings_status ON listings (status);
CREATE INDEX idx_listings_host ON listings (host_id);
CREATE INDEX idx_listings_price ON listings (price);
CREATE INDEX idx_listings_city ON listings (city, subcity);
CREATE INDEX idx_listings_type ON listings (property_type, rental_type);

-- `key` is either `r2:<object>` for uploaded photos or `ph:<seed>` for the
-- generated placeholders the seed data uses.
CREATE TABLE listing_photos (
  id          TEXT PRIMARY KEY,
  listing_id  TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  alt_en      TEXT,
  alt_am      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_listing_photos ON listing_photos (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- Neighbourhood services — the shops, maintenance, hotels and lounges that
-- make a location liveable. Ranked by distance from a listing or the map view.
-- ---------------------------------------------------------------------------

CREATE TABLE providers (
  id              TEXT PRIMARY KEY,
  owner_id        TEXT REFERENCES users (id) ON DELETE SET NULL,

  name_en         TEXT NOT NULL,
  name_am         TEXT,
  category        TEXT NOT NULL,
  description_en  TEXT,
  description_am  TEXT,

  phone           TEXT,
  phone_alt       TEXT,
  website         TEXT,

  address_line    TEXT,
  city            TEXT NOT NULL DEFAULT 'Addis Ababa',
  subcity         TEXT,
  neighborhood    TEXT,
  lat             REAL NOT NULL,
  lng             REAL NOT NULL,

  opens_at        TEXT,                                  -- '08:00'
  closes_at       TEXT,                                  -- '21:00'
  open_days       TEXT NOT NULL DEFAULT '[0,1,2,3,4,5,6]',
  price_level     INTEGER,                               -- 1..3
  delivery        INTEGER NOT NULL DEFAULT 0,
  emergency_24_7  INTEGER NOT NULL DEFAULT 0,

  photo_key       TEXT,
  verified        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'published',     -- draft | published | paused | removed
  rating_avg      REAL NOT NULL DEFAULT 0,
  rating_count    INTEGER NOT NULL DEFAULT 0,

  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

CREATE INDEX idx_providers_geo ON providers (lat, lng);
CREATE INDEX idx_providers_category ON providers (category);
CREATE INDEX idx_providers_status ON providers (status);
CREATE INDEX idx_providers_owner ON providers (owner_id);

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

CREATE TABLE bookings (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,                    -- 'KRY-4F8Q', shown to people
  listing_id    TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  guest_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  host_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,

  start_date    TEXT NOT NULL,
  end_date      TEXT NOT NULL,
  rental_type   TEXT NOT NULL,
  units         INTEGER NOT NULL,                        -- months or nights
  guests        INTEGER NOT NULL DEFAULT 1,

  unit_price    REAL NOT NULL,
  subtotal      REAL NOT NULL,
  service_fee   REAL NOT NULL DEFAULT 0,
  deposit       REAL NOT NULL DEFAULT 0,
  total         REAL NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ETB',

  status        TEXT NOT NULL DEFAULT 'pending',  -- pending|confirmed|declined|cancelled|completed
  guest_message TEXT,
  host_note     TEXT,

  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT,
  responded_at  TEXT
);

CREATE INDEX idx_bookings_guest ON bookings (guest_id, created_at);
CREATE INDEX idx_bookings_host ON bookings (host_id, created_at);
CREATE INDEX idx_bookings_listing ON bookings (listing_id, start_date);
CREATE INDEX idx_bookings_status ON bookings (status);

CREATE TABLE favorites (
  user_id     TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  listing_id  TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, listing_id)
);

CREATE INDEX idx_favorites_listing ON favorites (listing_id);

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

CREATE TABLE reviews (
  id             TEXT PRIMARY KEY,
  listing_id     TEXT NOT NULL REFERENCES listings (id) ON DELETE CASCADE,
  author_id      TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  booking_id     TEXT REFERENCES bookings (id) ON DELETE SET NULL,
  rating         INTEGER NOT NULL,
  cleanliness    INTEGER,
  accuracy       INTEGER,
  location_score INTEGER,
  value_score    INTEGER,
  communication  INTEGER,
  comment        TEXT,
  host_reply     TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_reviews_listing ON reviews (listing_id, created_at);
CREATE INDEX idx_reviews_author ON reviews (author_id);
CREATE UNIQUE INDEX idx_reviews_per_booking ON reviews (booking_id) WHERE booking_id IS NOT NULL;

CREATE TABLE provider_reviews (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers (id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating      INTEGER NOT NULL,
  comment     TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_provider_reviews ON provider_reviews (provider_id, created_at);

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

CREATE TABLE conversations (
  id              TEXT PRIMARY KEY,
  listing_id      TEXT REFERENCES listings (id) ON DELETE SET NULL,
  booking_id      TEXT REFERENCES bookings (id) ON DELETE SET NULL,
  guest_id        TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  host_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TEXT,
  guest_unread    INTEGER NOT NULL DEFAULT 0,
  host_unread     INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_conversations_thread ON conversations (guest_id, host_id, listing_id);
CREATE INDEX idx_conversations_guest ON conversations (guest_id, last_message_at);
CREATE INDEX idx_conversations_host ON conversations (host_id, last_message_at);

CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------

CREATE TABLE notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title_en   TEXT NOT NULL,
  title_am   TEXT,
  body_en    TEXT,
  body_am    TEXT,
  href       TEXT,
  read       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_notifications_user ON notifications (user_id, read, created_at);
