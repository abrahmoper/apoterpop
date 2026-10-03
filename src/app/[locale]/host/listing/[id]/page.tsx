import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronLeft, Eye, Info } from "lucide-react";

import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { getOwnedListing, listingPhotos, publishBlockers } from "@/lib/db/listings";
import { getI18n } from "@/lib/i18n/server";
import { MAX_PHOTO_BYTES } from "@/lib/photos";
import type { ListingStatus, Locale } from "@/lib/types";
import { ListingEditorForm } from "./editor-form";
import { PhotoManager } from "./photo-manager";
import { ListingStatusButton } from "../../listing-status-button";

/**
 * The listing editor. Ownership is enforced twice: once here by the
 * getOwnedListing gate, and again inside every server action this page posts
 * to. A guessed id gets a 404, not someone else's home.
 */
export default async function HostListingEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale; id: string }>;
  searchParams: Promise<{ saved?: string; photo?: string }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const { id } = await params;
  const query = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect(href(`/signin?next=${encodeURIComponent(href(`/host/listing/${id}`))}`));

  const listing = await getOwnedListing(id, user.id);
  if (!listing) notFound();

  const photos = await listingPhotos(id).catch(() => []);
  const blockers = publishBlockers(listing, photos.length);
  const title = (locale === "am" && listing.title_am) || listing.title_en;

  const statusLabels: Record<ListingStatus, string> = {
    draft: t("host.status.draft"),
    published: t("host.status.published"),
    paused: t("host.status.paused"),
    removed: t("host.status.removed"),
  };
  const statusVariant =
    listing.status === "published"
      ? ("verified" as const)
      : listing.status === "paused"
        ? ("accent" as const)
        : listing.status === "removed"
          ? ("destructive" as const)
          : ("muted" as const);

  return (
    <div className="container max-w-4xl space-y-6 py-8 sm:space-y-8 sm:py-12">
      <div className="space-y-3">
        <Link
          href={href("/host")}
          className="inline-flex items-center gap-1 rounded-full py-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {t("nav.hostDashboard")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {listing.status === "draft" ? t("wizard.title") : t("wizard.editTitle")}
            </h1>
            <p className="mt-1 truncate text-sm text-muted-foreground">{title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant}>{statusLabels[listing.status]}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={href(`/listing/${listing.id}`)}>
                <Eye aria-hidden />
                {t("host.previewListing")}
              </Link>
            </Button>
            <ListingStatusButton listingId={listing.id} status={listing.status} />
          </div>
        </div>
      </div>

      {query.saved === "1" ? (
        <p
          className="flex items-center gap-2 rounded-xl border border-eucalyptus-200 bg-primary-soft px-4 py-3 text-sm font-medium text-eucalyptus-800"
          role="status"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {t("wizard.saved")}
        </p>
      ) : null}

      {query.photo === "missing" || query.photo === "too_big" ? (
        <p
          className="flex items-center gap-2 rounded-xl border border-berbere-200 bg-berbere-50 px-4 py-3 text-sm text-berbere-500"
          role="alert"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {query.photo === "too_big"
            ? t("error.fileTooBig", { size: `${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB` })
            : t("error.uploadFailed")}
        </p>
      ) : null}

      {blockers.length > 0 && listing.status === "draft" ? (
        <p className="flex items-start gap-2 rounded-xl border border-tibeb-200 bg-accent-soft px-4 py-3 text-sm text-accent-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("wizard.missing", { fields: blockers.join(", ") })}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("wizard.step.photos")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("wizard.photosBody")}</p>
        </CardHeader>
        <CardContent>
          <PhotoManager
            listingId={listing.id}
            locale={locale}
            photos={photos.map((photo) => ({ id: photo.id, key: photo.key, alt: photo.alt_en }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <ListingEditorForm listing={listing} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
