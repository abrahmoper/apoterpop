"use client";

/**
 * Language switcher.
 *
 * Switching language is a navigation, not a state change: /am/search is a real
 * URL that can be shared and bookmarked. The middleware writes the cookie on
 * arrival, so the choice sticks for the next visit without any client storage.
 *
 * Query strings are preserved, which matters on search pages — changing
 * language must not silently drop someone's filters.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_LABELS, switchLocalePath } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/client";

export function LanguageSwitcher({
  className,
  variant = "segmented",
}: {
  className?: string;
  variant?: "segmented" | "list";
}) {
  const active = useLocale();
  const pathname = usePathname() || "/";
  const params = useSearchParams();
  const query = params?.toString();

  const hrefFor = (locale: (typeof LOCALES)[number]) => {
    const path = switchLocalePath(pathname, locale);
    return query ? `${path}?${query}` : path;
  };

  if (variant === "list") {
    return (
      <div className={cn("flex flex-col", className)}>
        {LOCALES.map((locale) => (
          <Link
            key={locale}
            href={hrefFor(locale)}
            lang={locale}
            aria-current={locale === active ? "true" : undefined}
            className={cn(
              "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors",
              locale === active
                ? "bg-eucalyptus-50 font-medium text-eucalyptus-800"
                : "text-ink-600 hover:bg-mist/60",
            )}
          >
            <span>{LOCALE_LABELS[locale].native}</span>
            <span className="text-xs text-ink-400">{LOCALE_LABELS[locale].english}</span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-ink-200/70 bg-white/90 p-0.5",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={hrefFor(locale)}
          lang={locale}
          aria-current={locale === active ? "true" : undefined}
          title={LOCALE_LABELS[locale].english}
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium leading-none transition-colors",
            locale === active
              ? "bg-ink-900 text-paper shadow-sm"
              : "text-ink-500 hover:text-ink-900",
          )}
        >
          {LOCALE_LABELS[locale].flagText}
        </Link>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
