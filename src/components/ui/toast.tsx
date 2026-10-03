"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts sit at the top on phones on purpose: the bottom of the screen belongs
 * to the mobile tab bar, and a toast that covers "Book" or "Message host" is
 * worse than no toast at all.
 *
 * Every class name here comes from the project tokens rather than sonner's
 * defaults, and nothing has a fixed height — Amharic wraps taller than English
 * and a clipped confirmation would be unreadable.
 */
function Toaster() {
  return (
    <Sonner
      position="top-center"
      offset={16}
      gap={10}
      visibleToasts={3}
      toastOptions={{
        duration: 4500,
        classNames: {
          toast:
            "group flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lift",
          title: "text-sm font-medium leading-snug text-foreground",
          description: "pretty mt-0.5 text-sm leading-relaxed text-muted-foreground",
          actionButton:
            "min-h-9 shrink-0 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground",
          cancelButton:
            "min-h-9 shrink-0 rounded-lg bg-muted px-3 text-sm font-medium text-ink-700",
          closeButton:
            "rounded-full border border-border bg-card text-ink-500 hover:text-foreground",
          icon: "mt-0.5 shrink-0",
          success: "[&_[data-icon]]:text-primary",
          error: "[&_[data-icon]]:text-destructive",
          warning: "[&_[data-icon]]:text-accent-foreground",
          info: "[&_[data-icon]]:text-ink-600",
        },
      }}
    />
  );
}

export { Toaster, toast };
