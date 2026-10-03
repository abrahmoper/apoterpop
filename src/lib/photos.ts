/**
 * Photo keys and URLs.
 *
 * A photo key is one of two things:
 *   r2:<object>  — a real upload, streamed from R2 by /api/images/<object>
 *   ph:<seed>    — a generated placeholder, drawn as SVG by /api/ph/<seed>
 *
 * The placeholder is not a grey box. It is a deterministic architectural
 * gradient built from the seed, so a listing without photos still looks like a
 * deliberate part of the product and every card keeps its own colour.
 */

export const R2_PREFIX = "r2:";
export const PLACEHOLDER_PREFIX = "ph:";
export const MAX_PHOTOS = 20;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export function isPlaceholderKey(key: string | null | undefined): boolean {
  return !!key && key.startsWith(PLACEHOLDER_PREFIX);
}

/** Resolves any stored key to something an <img src> can use. */
export function photoUrl(key: string | null | undefined): string {
  if (!key) return "/api/ph/kiray";
  if (key.startsWith(R2_PREFIX)) {
    return `/api/images/${encodeURIComponent(key.slice(R2_PREFIX.length))}`;
  }
  if (key.startsWith(PLACEHOLDER_PREFIX)) {
    return `/api/ph/${encodeURIComponent(key.slice(PLACEHOLDER_PREFIX.length))}`;
  }
  // Absolute URLs are allowed through so seed data can point anywhere.
  if (key.startsWith("http") || key.startsWith("/")) return key;
  return `/api/ph/${encodeURIComponent(key)}`;
}

export function r2Key(object: string): string {
  return `${R2_PREFIX}${object}`;
}

export function placeholderKey(seed: string): string {
  return `${PLACEHOLDER_PREFIX}${seed}`;
}

/** Stable object name for an upload, namespaced by what it belongs to. */
export function newObjectName(scope: string, ownerId: string, filename: string): string {
  const ext = /\.([a-zA-Z0-9]{2,5})$/.exec(filename)?.[1]?.toLowerCase() ?? "jpg";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${scope}/${ownerId}/${stamp}-${rand}.${ext}`;
}

/* -------------------------------------------------------------------------- */
/*  Placeholder drawing                                                        */
/* -------------------------------------------------------------------------- */

/** Cheap deterministic hash — same seed always gives the same picture. */
function hash(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Muted highland palette: greens, golds, clay and slate. Never neon. */
const PLACEHOLDER_PAIRS: Array<[string, string]> = [
  ["#1D6F52", "#0D3527"],
  ["#4A9576", "#175A43"],
  ["#C8952B", "#855F19"],
  ["#DDB559", "#A87A20"],
  ["#B3402F", "#8F3325"],
  ["#3F5C66", "#22343B"],
  ["#7A7F6B", "#4A4E41"],
  ["#8C6A4F", "#5A4331"],
];

/**
 * An SVG of overlapping rooflines. It reads as a building at card size and as
 * texture at hero size, and it costs nothing to serve.
 */
export function placeholderSvg(seed: string, width = 1200, height = 800): string {
  const h = hash(seed || "kiray");
  const [from, to] = PLACEHOLDER_PAIRS[h % PLACEHOLDER_PAIRS.length];
  const angle = 20 + (h % 5) * 14;
  const shift = (h >> 3) % 40;

  // Three roof silhouettes at different heights, positioned from the hash.
  const roofs = [0, 1, 2]
    .map((i) => {
      const seedI = (h >> (i * 5)) % 100;
      const baseY = height * (0.62 + i * 0.06);
      const peak = baseY - height * (0.16 + (seedI % 12) / 100);
      const x0 = width * (-0.1 + i * 0.32 + (seedI % 7) / 100);
      const x1 = x0 + width * (0.38 + (seedI % 9) / 100);
      const mid = (x0 + x1) / 2;
      const opacity = 0.1 + i * 0.07;
      return `<path d="M${x0.toFixed(0)} ${height} L${x0.toFixed(0)} ${baseY.toFixed(0)} L${mid.toFixed(0)} ${peak.toFixed(0)} L${x1.toFixed(0)} ${baseY.toFixed(0)} L${x1.toFixed(0)} ${height} Z" fill="#FBFAF7" fill-opacity="${opacity.toFixed(2)}"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Placeholder">
<defs>
<linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)">
<stop offset="0%" stop-color="${from}"/>
<stop offset="100%" stop-color="${to}"/>
</linearGradient>
<pattern id="t" width="18" height="18" patternTransform="rotate(135)" patternUnits="userSpaceOnUse">
<rect width="18" height="18" fill="none"/>
<rect width="6" height="18" fill="#FBFAF7" fill-opacity="0.035"/>
</pattern>
</defs>
<rect width="${width}" height="${height}" fill="url(#g)"/>
<rect width="${width}" height="${height}" fill="url(#t)"/>
<circle cx="${(width * (0.7 + shift / 400)).toFixed(0)}" cy="${(height * 0.24).toFixed(0)}" r="${(height * 0.1).toFixed(0)}" fill="#FBFAF7" fill-opacity="0.12"/>
${roofs}
</svg>`;
}

/** Seeded key for a listing that has no uploads, so cards stay distinguishable. */
export function listingPlaceholder(listingId: string, index = 0): string {
  return placeholderKey(`${listingId}-${index}`);
}

export function providerPlaceholder(providerId: string): string {
  return placeholderKey(`svc-${providerId}`);
}

/** Guarantees a gallery always has something to show. */
export function withFallbackPhotos(photos: string[], id: string, minimum = 1): string[] {
  if (photos.length >= minimum) return photos;
  const filled = [...photos];
  while (filled.length < minimum) filled.push(listingPlaceholder(id, filled.length));
  return filled;
}
