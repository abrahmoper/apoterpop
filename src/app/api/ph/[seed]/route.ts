import { placeholderSvg } from "@/lib/photos";

/**
 * Deterministic placeholder art.
 *
 * Every listing without an upload points here — same seed, same picture,
 * forever — so the browser can cache it for a year and a card without photos
 * still looks designed rather than broken.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ seed: string }> },
) {
  const { seed: rawSeed } = await params;
  const seed = decodeURIComponent(rawSeed || "kiray");

  const url = new URL(request.url);
  const width = clampDimension(url.searchParams.get("w"), 1200);
  const height = clampDimension(url.searchParams.get("h"), 800);

  return new Response(placeholderSvg(seed, width, height), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

function clampDimension(raw: string | null, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 16) return fallback;
  return Math.min(4000, Math.round(value));
}
