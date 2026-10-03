import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_PATH = process.env.LOCAL_DB_PATH || path.resolve(process.cwd(), "data/kiray.sqlite");
const MIGRATION_PATH = path.resolve(process.cwd(), "migrations/0001_init.sql");

// PBKDF2 password hashing matching src/lib/auth.ts
async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    key,
    256
  );
  const toBase64 = (b) => Buffer.from(b).toString("base64");
  return ["pbkdf2", 100000, toBase64(salt), toBase64(new Uint8Array(bits))].join("$");
}

async function main() {
  console.log(`[setup] Initializing SQLite database at: ${DB_PATH}`);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);

  // 1. Run migrations if tables don't exist
  const hasUsers = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
  if (!hasUsers) {
    const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
    db.exec(sql);
    console.log("[setup] Applied migrations/0001_init.sql successfully.");
  }

  // Check if already seeded
  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get();
  if (userCount && userCount.c > 0) {
    console.log(`[setup] Database already contains ${userCount.c} users. Skipping initial seed.`);
    return;
  }

  console.log("[setup] Seeding initial data for Kiray...");

  const defaultPasswordHash = await hashPassword("password123");
  const adminPasswordHash = await hashPassword("admin123");

  // 2. Seed Users
  const insertUser = db.prepare(`
    INSERT INTO users (id, full_name, email, phone, password_hash, is_host, is_admin, phone_verified, email_verified, city, bio)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `);

  insertUser.run(
    "user_host_1",
    "Abebe Kebede",
    "abebe@kiray.et",
    "+251911223344",
    defaultPasswordHash,
    1,
    0,
    "Addis Ababa",
    "Superhost with 5+ years experience hosting international travelers in Bole."
  );

  insertUser.run(
    "user_host_2",
    "Bethlehem Tilahun",
    "bethlehem@kiray.et",
    "+251922334455",
    defaultPasswordHash,
    1,
    0,
    "Addis Ababa",
    "Architect and interior designer offering fully furnished stays across Addis."
  );

  insertUser.run(
    "user_guest_1",
    "Dawit Tsige",
    "dawit@kiray.et",
    "+251933445566",
    defaultPasswordHash,
    0,
    0,
    "Addis Ababa",
    "Software consultant and frequent explorer of Ethiopian cities."
  );

  insertUser.run(
    "user_admin_1",
    "Kiray Admin",
    "admin@kiray.et",
    "+251900000000",
    adminPasswordHash,
    1,
    1,
    "Addis Ababa",
    "Kiray system administrator and platform moderator."
  );

  // 3. Seed Listings
  const insertListing = db.prepare(`
    INSERT INTO listings (
      id, host_id, title_en, title_am, summary_en, summary_am, description_en, description_am,
      property_type, rental_type, price, deposit_months, currency, bedrooms, beds, bathrooms,
      max_guests, area_sqm, furnished, amenities, house_rules_en, house_rules_am,
      city, subcity, neighborhood, address_line, lat, lng, min_stay_months, min_nights,
      instant_book, status, verified, rating_avg, rating_count, view_count
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
  `);

  const insertPhoto = db.prepare(`
    INSERT INTO listing_photos (id, listing_id, key, alt_en, alt_am, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const listings = [
    {
      id: "lst_bole_atlas_lux",
      host_id: "user_host_1",
      title_en: "Modern 2-Bedroom Apartment in Bole Atlas",
      title_am: "ዘመናዊ ባለ 2 መኝታ አፓርትመንት በቦሌ አትላስ",
      summary_en: "Bright, spacious apartment with backup generator and high-speed Wi-Fi in prime Bole.",
      summary_am: "በዋናው ቦሌ አትላስ የሚገኝ ሰፊ፣ ጀነሬተር እና ፈጣን ዋይፋይ ያለው ምርጥ አፓርትመንት።",
      description_en: "Located in the heart of Bole Atlas, minutes from restaurants, cafés, and supermarkets. Featuring 2 modern bedrooms with en-suite baths, 24/7 building security, water reservoir tank, high-capacity backup generator, and dedicated underground parking. Ideal for professionals and expats.",
      description_am: "በቦሌ አትላስ እምብርት የሚገኝ፣ ለሬስቶራንቶች፣ ካፌዎች እና ሱፐርማርኬቶች ቅርብ። ሁለት ምቹ መኝታ ቤቶች፣ የ24 ሰዓት ጥበቃ፣ የውሃ ታንከር እና አስተማማኝ ጀነሬተር አለው።",
      property_type: "apartment",
      rental_type: "monthly",
      price: 45000,
      deposit_months: 1,
      currency: "ETB",
      bedrooms: 2,
      beds: 2,
      bathrooms: 2,
      max_guests: 4,
      area_sqm: 125,
      furnished: "furnished",
      amenities: JSON.stringify(["wifi", "parking", "generator", "water_tank", "security", "kitchen", "balcony", "elevator", "tv", "laundry"]),
      house_rules_en: "No smoking inside. Quiet hours after 10 PM. Please take care of appliances.",
      house_rules_am: "በቤት ውስጥ ማጨስ አይፈቀድም። ከምሽቱ 4 ሰዓት በኋላ ጸጥታ ይጠበቃል።",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Atlas",
      address_line: "Near Atlas Hotel, Behind Edna Mall corridor",
      lat: 9.0068,
      lng: 38.7845,
      min_stay_months: 1,
      min_nights: 1,
      instant_book: 1,
      status: "published",
      verified: 1,
      rating_avg: 4.9,
      rating_count: 14,
      view_count: 312,
      photos: [
        "ph:bole_atlas_living",
        "ph:bole_atlas_master",
        "ph:bole_atlas_kitchen",
        "ph:bole_atlas_balcony",
        "ph:bole_atlas_bath",
      ],
    },
    {
      id: "lst_old_airport_villa",
      host_id: "user_host_2",
      title_en: "Elegant Executive Villa with Garden in Old Airport",
      title_am: "ውብ ቪላ ከአትክልት ስፍራ ጋር በድሮው አውሮፕላን ማረፊያ",
      summary_en: "Diplomatic-grade 4-bedroom villa with expansive garden, security guard post, and borehole water.",
      summary_am: "ለዲፕሎማቶች ተስማሚ የሆነ ባለ 4 መኝታ ቪላ፣ ትልቅ አትክልት ስፍራ፣ የጥበቃ ቤት እና የራሱ ውሃ ያለው።",
      description_en: "Luxurious residential home in the tranquil diplomatic zone of Old Airport. Features large landscaped garden, separate maid quarters, modern fitted kitchen, heavy-duty diesel generator, private borehole well, and comprehensive perimeter security.",
      description_am: "በሰላማዊው የድሮው አውሮፕላን ማረፊያ መንደር የሚገኝ ምርጥ ቪላ። ትልቅ ግቢ፣ የአገልጋይ ክፍሎች፣ ዘመናዊ ኩሽና፣ ጀነሬተር እና የራሱ ቦርሆል ውሃ አለው።",
      property_type: "villa",
      rental_type: "monthly",
      price: 130000,
      deposit_months: 2,
      currency: "ETB",
      bedrooms: 4,
      beds: 5,
      bathrooms: 4,
      max_guests: 8,
      area_sqm: 380,
      furnished: "furnished",
      amenities: JSON.stringify(["wifi", "parking", "generator", "water_tank", "borehole", "security", "garden", "kitchen", "laundry", "pets_allowed"]),
      house_rules_en: "Pets allowed with prior approval. Diplomatic and corporate leases welcomed.",
      house_rules_am: "የቤት እንስሳት በቅድመ ፈቃድ ይፈቀዳሉ።",
      city: "Addis Ababa",
      subcity: "Kirkos",
      neighborhood: "Old Airport",
      address_line: "Near ICS (International Community School)",
      lat: 8.9892,
      lng: 38.7368,
      min_stay_months: 3,
      min_nights: 1,
      instant_book: 0,
      status: "published",
      verified: 1,
      rating_avg: 4.95,
      rating_count: 8,
      view_count: 480,
      photos: [
        "ph:old_airport_exterior",
        "ph:old_airport_garden",
        "ph:old_airport_living",
        "ph:old_airport_dining",
        "ph:old_airport_bedroom",
      ],
    },
    {
      id: "lst_kazanchis_studio",
      host_id: "user_host_1",
      title_en: "Cozy Executive Studio near Kazanchis UNECA",
      title_am: "ምቹ ስቱዲዮ በካዛንቺስ የተባበሩት መንግስታት አቅራቢያ",
      summary_en: "Compact, stylish serviced studio within walking distance to ECA and Radisson Blu.",
      summary_am: "ለተባበሩት መንግስታት (UNECA) ቅርብ የሆነ ዘመናዊና ምቹ ስቱዲዮ።",
      description_en: "Perfect for business travellers and researchers visiting the United Nations Economic Commission for Africa. Fast fiber Wi-Fi, elevator access, smart TV, kitchen amenities, and 24/7 security in a quiet compound.",
      description_am: "ለስራ ተጓዦች እና ተመራማሪዎች ተስማሚ። ፈጣን ዋይፋይ፣ ሊፍት፣ ስማርት ቲቪ እና ሙሉ የኩሽና እቃዎች አሉት።",
      property_type: "studio",
      rental_type: "nightly",
      price: 2800,
      deposit_months: 0,
      currency: "ETB",
      bedrooms: 1,
      beds: 1,
      bathrooms: 1,
      max_guests: 2,
      area_sqm: 45,
      furnished: "furnished",
      amenities: JSON.stringify(["wifi", "elevator", "generator", "water_tank", "security", "kitchen", "tv", "air_conditioning"]),
      house_rules_en: "Strictly non-smoking. Check-in 2:00 PM, Check-out 11:00 AM.",
      house_rules_am: "ማጨስ አይፈቀድም። መግቢያ ከቀኑ 8 ሰዓት፣ መውጫ ጠዋት 5 ሰዓት።",
      city: "Addis Ababa",
      subcity: "Kirkos",
      neighborhood: "Kazanchis",
      address_line: "Menelik II Avenue, near UNECA Gate",
      lat: 9.0185,
      lng: 38.7675,
      min_stay_months: 1,
      min_nights: 1,
      instant_book: 1,
      status: "published",
      verified: 1,
      rating_avg: 4.85,
      rating_count: 22,
      view_count: 620,
      photos: [
        "ph:kazanchis_studio_main",
        "ph:kazanchis_studio_bed",
        "ph:kazanchis_studio_kitchen",
        "ph:kazanchis_studio_bath",
        "ph:kazanchis_studio_desk",
      ],
    },
    {
      id: "lst_sarbet_guesthouse",
      host_id: "user_host_2",
      title_en: "Charming 2-Bedroom Guest House in Sarbet",
      title_am: "ማራኪ ባለ 2 መኝታ የእንግዳ ማረፊያ በሳርቤት",
      summary_en: "Peaceful guesthouse with terrace and view of the AU headquarters area.",
      summary_am: "ለአፍሪካ ህብረት አቅራቢያ የሚገኝ ሰላማዊ የእንግዳ ማረፊያ ቴራስ ያለው።",
      description_en: "Tucked inside a secure gated neighbourhood in Sarbet, near King George VI street and African Union. Sunny terrace, comfortable bedrooms, friendly staff, and backup power.",
      description_am: "በሳርቤት በታጠረ መንደር ውስጥ የሚገኝ፣ ፀሐያማ ቴራስ፣ ምቹ መኝታ ክፍሎች እና ጀነሬተር ያለው።",
      property_type: "guesthouse",
      rental_type: "nightly",
      price: 3600,
      deposit_months: 0,
      currency: "ETB",
      bedrooms: 2,
      beds: 2,
      bathrooms: 2,
      max_guests: 4,
      area_sqm: 90,
      furnished: "furnished",
      amenities: JSON.stringify(["wifi", "parking", "water_tank", "generator", "balcony", "kitchen", "tv", "garden"]),
      house_rules_en: "Respect neighbours. No loud parties.",
      house_rules_am: "ጎረቤቶችን ማክበር እና ጫጫታ አለመፍጠር።",
      city: "Addis Ababa",
      subcity: "Kirkos",
      neighborhood: "Sarbet",
      address_line: "Near Canadian Embassy & AU",
      lat: 8.9984,
      lng: 38.7391,
      min_stay_months: 1,
      min_nights: 2,
      instant_book: 1,
      status: "published",
      verified: 1,
      rating_avg: 4.8,
      rating_count: 19,
      view_count: 510,
      photos: [
        "ph:sarbet_guest_front",
        "ph:sarbet_guest_terrace",
        "ph:sarbet_guest_bed",
        "ph:sarbet_guest_living",
        "ph:sarbet_guest_coffee",
      ],
    },
    {
      id: "lst_cmc_penthouse",
      host_id: "user_host_1",
      title_en: "Spacious 3-Bedroom Penthouse in CMC",
      title_am: "ሰፊ ባለ 3 መኝታ ፔንትሃውስ በሲኤምሲ",
      summary_en: "High-floor apartment with panoramic city views, modern finishes, and dual balconies.",
      summary_am: "የከተማዋን ውብ ገጽታ የሚያሳይ፣ ዘመናዊ አጨራረስ እና ሁለት ባልኮኒዎች ያሉት።",
      description_en: "Situated in CMC near Tsehay Real Estate, this top-floor penthouse offers natural lighting, 3 comfortable bedrooms, large open living area, and excellent road connectivity with the light rail nearby.",
      description_am: "በሲኤምሲ ፀሐይ ሪል እስቴት አቅራቢያ፣ ሰፊ ሳሎን፣ 3 መኝታ ቤቶች፣ ሊፍት እና የመኪና ማቆሚያ ያለው።",
      property_type: "apartment",
      rental_type: "monthly",
      price: 68000,
      deposit_months: 1,
      currency: "ETB",
      bedrooms: 3,
      beds: 4,
      bathrooms: 2.5,
      max_guests: 6,
      area_sqm: 190,
      furnished: "semi",
      amenities: JSON.stringify(["wifi", "parking", "generator", "water_tank", "elevator", "security", "balcony", "kitchen"]),
      house_rules_en: "Long-term tenants preferred (minimum 3 months).",
      house_rules_am: "ረዘም ላለ ጊዜ ለሚከራዩ ቅድሚያ ይሰጣል።",
      city: "Addis Ababa",
      subcity: "Yeka",
      neighborhood: "CMC",
      address_line: "CMC Road, near Michael Church",
      lat: 9.0234,
      lng: 38.8351,
      min_stay_months: 3,
      min_nights: 1,
      instant_book: 0,
      status: "published",
      verified: 1,
      rating_avg: 4.75,
      rating_count: 6,
      view_count: 290,
      photos: [
        "ph:cmc_living_view",
        "ph:cmc_balcony",
        "ph:cmc_kitchen",
        "ph:cmc_master",
        "ph:cmc_room2",
      ],
    },
    {
      id: "lst_hawassa_lakeview",
      host_id: "user_host_2",
      title_en: "Serene Lake View Villa in Hawassa",
      title_am: "የሀይቅ እይታ ያለው ሰላማዊ ቪላ በሀዋሳ",
      summary_en: "Breathtaking views of Lake Hawassa with lush tropical gardens and private chef option.",
      summary_am: "የሀዋሳ ሀይቅን ቁልጭ አድርጎ የሚያሳይ፣ ለዕረፍት እና ለመዝናናት ተመራጭ ቪላ።",
      description_en: "Experience the calming breezes of Lake Hawassa. Features 3 bedrooms, large covered veranda overlooking the lake, fruit garden, security, and close proximity to Haile Resort and fish market.",
      description_am: "የሀዋሳ ሀይቅ ንፋስ እየተቀበሉ የሚያርፉበት ምርጥ ቪላ። 3 መኝታ ክፍሎች፣ ትልቅ በረንዳ እና አትክልት ያለው።",
      property_type: "villa",
      rental_type: "nightly",
      price: 4800,
      deposit_months: 0,
      currency: "ETB",
      bedrooms: 3,
      beds: 4,
      bathrooms: 3,
      max_guests: 6,
      area_sqm: 220,
      furnished: "furnished",
      amenities: JSON.stringify(["wifi", "parking", "water_tank", "generator", "garden", "balcony", "kitchen", "tv", "pets_allowed"]),
      house_rules_en: "Relax, enjoy nature, and keep the grounds clean.",
      house_rules_am: "የተፈጥሮ ውበቱን ይደሰቱ፣ ንፅህናውን ይጠብቁ።",
      city: "Hawassa",
      subcity: "Tabor",
      neighborhood: "Lake Side",
      address_line: "Near Haile Grand Resort",
      lat: 7.0543,
      lng: 38.4682,
      min_stay_months: 1,
      min_nights: 1,
      instant_book: 1,
      status: "published",
      verified: 1,
      rating_avg: 4.96,
      rating_count: 31,
      view_count: 840,
      photos: [
        "ph:hawassa_lake_terrace",
        "ph:hawassa_garden",
        "ph:hawassa_living",
        "ph:hawassa_bedroom",
        "ph:hawassa_sunset",
      ],
    },
  ];

  for (const l of listings) {
    insertListing.run(
      l.id,
      l.host_id,
      l.title_en,
      l.title_am,
      l.summary_en,
      l.summary_am,
      l.description_en,
      l.description_am,
      l.property_type,
      l.rental_type,
      l.price,
      l.deposit_months,
      l.currency,
      l.bedrooms,
      l.beds,
      l.bathrooms,
      l.max_guests,
      l.area_sqm,
      l.furnished,
      l.amenities,
      l.house_rules_en,
      l.house_rules_am,
      l.city,
      l.subcity,
      l.neighborhood,
      l.address_line,
      l.lat,
      l.lng,
      l.min_stay_months,
      l.min_nights,
      l.instant_book,
      l.status,
      l.verified,
      l.rating_avg,
      l.rating_count,
      l.view_count
    );

    l.photos.forEach((key, idx) => {
      insertPhoto.run(`p_${l.id}_${idx}`, l.id, key, `${l.title_en} photo ${idx + 1}`, `${l.title_am} ፎቶ ${idx + 1}`, idx);
    });
  }

  // 4. Seed Providers (Neighbourhood ring services)
  const insertProvider = db.prepare(`
    INSERT INTO providers (
      id, owner_id, name_en, name_am, category, description_en, description_am,
      phone, website, address_line, city, subcity, neighborhood, lat, lng,
      opens_at, closes_at, open_days, price_level, delivery, emergency_24_7,
      verified, status, rating_avg, rating_count, photo_key
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);

  const providers = [
    {
      id: "prov_shoa_supermarket",
      name_en: "Shoa Supermarket (Bole)",
      name_am: "ሸዋ ሱፐርማርኬት (ቦሌ)",
      category: "supermarket",
      description_en: "Addis' premier supermarket with fresh groceries, dairy, imported goods, and bakery.",
      description_am: "ትኩስ ምግቦች፣ የውጪ እቃዎች እና ዳቦ መጋገሪያ ያለው ታዋቂ ሱፐርማርኬት።",
      phone: "+251116620000",
      website: "https://shoasupermarket.et",
      address_line: "Bole Road, Near Friendship Building",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Atlas",
      lat: 9.0041,
      lng: 38.7832,
      opens_at: "08:00",
      closes_at: "21:30",
      open_days: "[0,1,2,3,4,5,6]",
      price_level: 2,
      delivery: 1,
      emergency_24_7: 0,
      verified: 1,
      status: "published",
      rating_avg: 4.6,
      rating_count: 58,
      photo_key: "ph:shoa_market",
    },
    {
      id: "prov_lion_pharmacy",
      name_en: "Lion Pharmacy 24/7",
      name_am: "አንበሳ ፋርማሲ (የ24 ሰዓት)",
      category: "pharmacy",
      description_en: "Round-the-clock pharmacy stocking prescription medications, baby formula, and medical supplies.",
      description_am: "የ24 ሰዓት የመድኃኒት አገልግሎት እና የህክምና እቃዎች አቅራቢ።",
      phone: "+251116612345",
      website: null,
      address_line: "Cameroon Street, Next to Morning Star Mall",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Medhanialem",
      lat: 9.0012,
      lng: 38.7871,
      opens_at: "00:00",
      closes_at: "23:59",
      open_days: "[0,1,2,3,4,5,6]",
      price_level: 2,
      delivery: 1,
      emergency_24_7: 1,
      verified: 1,
      status: "published",
      rating_avg: 4.8,
      rating_count: 42,
      photo_key: "ph:lion_pharmacy",
    },
    {
      id: "prov_nordic_medical",
      name_en: "Nordic Medical Centre",
      name_am: "ኖርዲክ ሜዲካል ሴንተር",
      category: "clinic",
      description_en: "International quality emergency and outpatient clinic with 24/7 ambulance and lab services.",
      description_am: "አለም አቀፍ ደረጃውን የጠበቀ የአስቸኳይ ጊዜ እና የተኝቶ ህክምና ክሊኒክ።",
      phone: "+251929105653",
      website: "https://nordicmedicalcentre.com",
      address_line: "Behind Boston Day Spa, Bole",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Atlas",
      lat: 9.0082,
      lng: 38.7819,
      opens_at: "00:00",
      closes_at: "23:59",
      open_days: "[0,1,2,3,4,5,6]",
      price_level: 3,
      delivery: 0,
      emergency_24_7: 1,
      verified: 1,
      status: "published",
      rating_avg: 4.9,
      rating_count: 67,
      photo_key: "ph:nordic_clinic",
    },
    {
      id: "prov_tomoca_coffee",
      name_en: "Tomoca Coffee (Atlas)",
      name_am: "ቶሞካ ቡና (አትላስ)",
      category: "cafe",
      description_en: "Ethiopia's legendary coffee roaster serving classic macchiatos and whole bean coffee since 1953.",
      description_am: "ከ1953 ዓ.ም ጀምሮ የታወቀው እውነተኛው የኢትዮጵያ ቡና እና ማኪያቶ።",
      phone: "+251111112233",
      website: "https://tomocacoffee.com",
      address_line: "Cape Verde St, Bole Atlas",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Atlas",
      lat: 9.0071,
      lng: 38.7852,
      opens_at: "07:00",
      closes_at: "21:00",
      open_days: "[0,1,2,3,4,5,6]",
      price_level: 1,
      delivery: 0,
      emergency_24_7: 0,
      verified: 1,
      status: "published",
      rating_avg: 4.95,
      rating_count: 180,
      photo_key: "ph:tomoca_coffee",
    },
    {
      id: "prov_cbe_bank",
      name_en: "Commercial Bank of Ethiopia & ATM",
      name_am: "የኢትዮጵያ ንግድ ባንክ እና ኤቲኤም",
      category: "bank",
      description_en: "Full banking services, foreign currency exchange, and 24-hour ATM.",
      description_am: "የባንክ አገልግሎት፣ የውጪ ምንዛሪ እና የ24 ሰዓት ኤቲኤም።",
      phone: "+251115515004",
      website: "https://combanketh.et",
      address_line: "Atlas Traffic Light, Bole",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Atlas",
      lat: 9.0061,
      lng: 38.7839,
      opens_at: "08:00",
      closes_at: "17:00",
      open_days: "[1,2,3,4,5,6]",
      price_level: 1,
      delivery: 0,
      emergency_24_7: 0,
      verified: 1,
      status: "published",
      rating_avg: 4.4,
      rating_count: 35,
      photo_key: "ph:cbe_bank",
    },
    {
      id: "prov_kategna_restaurant",
      name_en: "Kategna Traditional Restaurant",
      name_am: "ካቴኛ ባህላዊ ሬስቶራንት",
      category: "restaurant",
      description_en: "Renowned authentic Ethiopian cuisine featuring kitfo, tibs, and vegetarian fasting platters (Beyaynetu).",
      description_am: "ጣፋጭ የኢትዮጵያ ባህላዊ ምግቦች፣ ክትፎ፣ ጥብስ እና የፆም በያይነቱ።",
      phone: "+251116616161",
      website: null,
      address_line: "Near Medhanialem Church, Bole",
      city: "Addis Ababa",
      subcity: "Bole",
      neighborhood: "Medhanialem",
      lat: 9.0028,
      lng: 38.7885,
      opens_at: "11:00",
      closes_at: "23:00",
      open_days: "[0,1,2,3,4,5,6]",
      price_level: 2,
      delivery: 1,
      emergency_24_7: 0,
      verified: 1,
      status: "published",
      rating_avg: 4.85,
      rating_count: 120,
      photo_key: "ph:kategna_rest",
    },
  ];

  for (const p of providers) {
    insertProvider.run(
      p.id,
      "user_host_1",
      p.name_en,
      p.name_am,
      p.category,
      p.description_en,
      p.description_am,
      p.phone,
      p.website,
      p.address_line,
      p.city,
      p.subcity,
      p.neighborhood,
      p.lat,
      p.lng,
      p.opens_at,
      p.closes_at,
      p.open_days,
      p.price_level,
      p.delivery,
      p.emergency_24_7,
      p.verified,
      p.status,
      p.rating_avg,
      p.rating_count,
      p.photo_key
    );
  }

  // 5. Seed Reviews
  const insertReview = db.prepare(`
    INSERT INTO reviews (
      id, listing_id, author_id, booking_id, rating,
      cleanliness, accuracy, location_score, value_score, communication,
      comment, host_reply
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertReview.run(
    "rev_1",
    "lst_bole_atlas_lux",
    "user_guest_1",
    null,
    5,
    5,
    5,
    5,
    4,
    5,
    "Wonderful stay! The generator kicked in seamlessly during power cuts, and the Wi-Fi was fast enough for my video conferences. Abebe is a very attentive host.",
    "Thank you Dawit! It was a pleasure hosting you. Welcome back anytime."
  );

  // 6. Seed Favorites
  db.prepare("INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)").run(
    "user_guest_1",
    "lst_bole_atlas_lux"
  );
  db.prepare("INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (?, ?)").run(
    "user_guest_1",
    "lst_hawassa_lakeview"
  );

  // 7. Seed Sample Booking
  const insertBooking = db.prepare(`
    INSERT INTO bookings (
      id, code, listing_id, guest_id, host_id, start_date, end_date, rental_type,
      units, guests, unit_price, subtotal, service_fee, deposit, total, currency,
      status, guest_message
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?
    )
  `);

  insertBooking.run(
    "bk_sample_1",
    "KRY-7X9P",
    "lst_bole_atlas_lux",
    "user_guest_1",
    "user_host_1",
    "2026-10-01",
    "2026-11-01",
    "monthly",
    1,
    2,
    45000,
    45000,
    2250,
    45000,
    92250,
    "ETB",
    "confirmed",
    "Hello Abebe, looking forward to staying at your Bole apartment for our project work."
  );

  // 8. Seed Conversation
  const insertConv = db.prepare(`
    INSERT INTO conversations (
      id, listing_id, booking_id, guest_id, host_id, last_message, last_message_at, guest_unread, host_unread
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 0, 0)
  `);
  insertConv.run(
    "conv_sample_1",
    "lst_bole_atlas_lux",
    "bk_sample_1",
    "user_guest_1",
    "user_host_1",
    "Thank you, see you on Oct 1st!"
  );

  const insertMsg = db.prepare(`
    INSERT INTO messages (id, conversation_id, sender_id, body)
    VALUES (?, ?, ?, ?)
  `);
  insertMsg.run("msg_1", "conv_sample_1", "user_guest_1", "Hello Abebe! Is the apartment ready for early check-in on the 1st?");
  insertMsg.run("msg_2", "conv_sample_1", "user_host_1", "Hello Dawit, yes absolutely! We have prepped everything. See you on Oct 1st!");

  console.log("[setup] Successfully seeded users, listings, photos, providers, reviews, bookings, and messages!");
}

main().catch((err) => {
  console.error("[setup] Error setting up database:", err);
  process.exit(1);
});
