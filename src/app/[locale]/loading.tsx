import { Skeleton } from "@/components/ui/card";

/**
 * Shown instantly while a page streams in, so navigation never feels frozen.
 * The shape mirrors the listing grid that most pages render.
 */
export default function Loading() {
  return (
    <div className="container space-y-8 py-8 sm:py-12" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      <div className="space-y-3">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      <Skeleton className="h-16 w-full rounded-2xl" />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
          >
            <Skeleton className="aspect-[4/3] w-full rounded-none" />
            <div className="space-y-3 p-4 sm:p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-6 w-28" />
                <Skeleton className="h-8 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
