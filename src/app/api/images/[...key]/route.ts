import { tryGetPhotos } from "@/lib/cf";
import { placeholderSvg } from "@/lib/photos";

/**
 * Streams an uploaded photo out of R2.
 *
 * Keys look like `listing/<owner>/<stamp>.<ext>` — the storage layout lives in
 * `newObjectName`, never in the URL. A missing object falls back to the
 * placeholder art rather than a bare 404, so a race between "photo deleted"
 * and "card still cached" never renders a broken image.
 */
const EXTENSION_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  svg: "image/svg+xml",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  // Next may hand the key back split across segments (if %2F was decoded
  // before matching) or as one encoded segment — both reassemble the same.
  const objectKey = segments.map((part) => decodeURIComponent(part)).join("/");

  const bucket = await tryGetPhotos();
  if (bucket) {
    try {
      const object = await bucket.get(objectKey);
      if (object) {
        const type =
          object.httpMetadata?.contentType ?? EXTENSION_TYPE(objectKey) ?? "application/octet-stream";
        return new Response(object.body, {
          headers: {
            "content-type": type,
            "cache-control": "public, max-age=31536000, immutable",
            etag: object.etag,
          },
        });
      }
    } catch {
      // Fall through to the placeholder; a storage hiccup must not 500 a page.
    }
  }

  const seed = objectKey || "kiray";
  return new Response(placeholderSvg(seed), {
    status: 404,
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

function EXTENSION_TYPE(key: string): string | null {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}
