"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  addListingPhotoAction,
  removeListingPhotoAction,
  setCoverPhotoAction,
} from "@/actions/listings";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useI18n } from "@/lib/i18n/client";
import { MAX_PHOTO_BYTES, isPlaceholderKey, photoUrl } from "@/lib/photos";
import type { Locale } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Photo {
  id: string;
  key: string;
  alt: string | null;
}

const MAX_PHOTOS = 20;

/**
 * Gallery editor: upload, remove, promote to cover. The first photo is the
 * cover, which is how the DB treats sort_order, so the UI just mirrors it.
 *
 * Action buttons are always visible on touch screens; they only fade in on
 * hover where a hover actually exists.
 */
export function PhotoManager({
  listingId,
  locale,
  photos,
}: {
  listingId: string;
  locale: Locale;
  photos: Photo[];
}) {
  const { t } = useI18n();
  const fileInput = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [toDelete, setToDelete] = useState<Photo | null>(null);
  const [dragging, setDragging] = useState(false);

  const busy = isPending || progress !== null;
  const sizeLabel = `${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB`;

  const baseForm = (extra: Record<string, string | File>) => {
    const form = new FormData();
    form.set("locale", locale);
    form.set("listingId", listingId);
    for (const [key, value] of Object.entries(extra)) form.set(key, value);
    return form;
  };

  const resetInput = () => {
    if (fileInput.current) fileInput.current.value = "";
  };

  const onFiles = (list: FileList | null) => {
    if (!list || list.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.error(t("error.tooManyPhotos", { max: MAX_PHOTOS }));
      resetInput();
      return;
    }

    const images = Array.from(list).filter((file) => file.type.startsWith("image/"));
    const fitting = images.filter((file) => file.size <= MAX_PHOTO_BYTES);
    if (fitting.length < images.length) toast.error(t("error.fileTooBig", { size: sizeLabel }));
    if (fitting.length > room) toast.error(t("error.tooManyPhotos", { max: MAX_PHOTOS }));

    const queue = fitting.slice(0, room);
    if (queue.length === 0) {
      resetInput();
      return;
    }

    setProgress({ done: 0, total: queue.length });
    startTransition(async () => {
      try {
        // One at a time: keeps each request small on a mobile connection and
        // lets the progress label mean something.
        for (let i = 0; i < queue.length; i += 1) {
          await addListingPhotoAction(baseForm({ photo: queue[i] }));
          setProgress({ done: i + 1, total: queue.length });
        }
      } catch {
        toast.error(t("error.uploadFailed"));
      } finally {
        setProgress(null);
        resetInput();
      }
    });
  };

  const confirmRemove = async () => {
    if (!toDelete) return;
    const photo = toDelete;
    await new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          await removeListingPhotoAction(baseForm({ photoId: photo.id, key: photo.key }));
        } catch {
          toast.error(t("error.generic"));
        } finally {
          resolve();
        }
      });
    });
  };

  const makeCover = (photo: Photo) => {
    startTransition(async () => {
      try {
        await setCoverPhotoAction(baseForm({ photoId: photo.id, key: photo.key }));
      } catch {
        toast.error(t("error.generic"));
      }
    });
  };

  const actionButton =
    "grid size-9 place-items-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <figure
            key={photo.id}
            className={cn(
              "group relative overflow-hidden rounded-xl border bg-muted",
              index === 0 ? "border-primary ring-2 ring-primary/20" : "border-border",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl(photo.key)}
              alt={photo.alt ?? ""}
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            {index === 0 ? (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                <Star className="size-3 fill-current" aria-hidden />
                {t("wizard.coverPhoto")}
              </span>
            ) : null}
            <figcaption className="absolute inset-x-0 bottom-0 flex justify-end gap-1.5 bg-gradient-to-t from-black/60 to-transparent p-2 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
              {index !== 0 && !isPlaceholderKey(photo.key) ? (
                <button
                  type="button"
                  onClick={() => makeCover(photo)}
                  disabled={busy}
                  aria-label={t("wizard.makeCover")}
                  title={t("wizard.makeCover")}
                  className={cn(actionButton, "text-ink-700")}
                >
                  <Star className="size-4" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setToDelete(photo)}
                disabled={busy}
                aria-label={t("common.delete")}
                title={t("common.delete")}
                className={cn(actionButton, "text-destructive")}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </figcaption>
          </figure>
        ))}

        {photos.length < MAX_PHOTOS ? (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) onFiles(e.dataTransfer.files);
            }}
            disabled={busy}
            className={cn(
              "grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed p-3 text-center text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary disabled:cursor-wait",
              dragging ? "border-primary bg-primary-soft/60 text-primary" : "border-border",
            )}
          >
            <span className="flex flex-col items-center gap-1.5 text-xs font-medium">
              {progress ? (
                <>
                  <Loader2 className="size-6 animate-spin" aria-hidden />
                  {t("wizard.uploadingCount", { done: progress.done, total: progress.total })}
                </>
              ) : (
                <>
                  <ImagePlus className="size-6" aria-hidden />
                  <span className="text-sm">{t("wizard.addPhotos")}</span>
                  <span className="hidden font-normal text-ink-400 sm:block">{t("wizard.dropPhotos")}</span>
                </>
              )}
            </span>
          </button>
        ) : null}
      </div>

      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => onFiles(e.target.files)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tnum" aria-live="polite">
          {t("wizard.photoCount", { count: photos.length, max: MAX_PHOTOS })}
        </span>
        <span>{t("error.fileTooBig", { size: sizeLabel })}</span>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => {
          if (!open) setToDelete(null);
        }}
        title={t("wizard.deletePhotoConfirm")}
        description={t("wizard.deletePhotoBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmRemove}
        destructive
      />
    </div>
  );
}
