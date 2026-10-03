/**
 * The site footer.
 *
 * Server component on purpose — it is the same on every page and carries no
 * interaction beyond links. The language switcher inside it is the one client
 * island (it reads the current path to preserve query strings).
 */
import Link from "next/link";
import { Building2 } from "lucide-react";

import { LanguageSwitcher } from "@/components/language-switcher";
import { makeT } from "@/lib/i18n/messages";
import { localeHref } from "@/lib/i18n/config";
import type { Locale } from "@/lib/types";

export function SiteFooter({ locale }: { locale: Locale }) {
  const t = makeT(locale);

  const columns = [
    {
      title: t("nav.explore"),
      links: [
        { label: t("nav.explore"), path: "/search" },
        { label: t("nav.services"), path: "/services" },
        { label: t("nav.favorites"), path: "/favorites" },
      ],
    },
    {
      title: t("nav.account"),
      links: [
        { label: t("nav.trips"), path: "/trips" },
        { label: t("nav.messages"), path: "/messages" },
        { label: t("nav.profile"), path: "/profile" },
        { label: t("nav.hostDashboard"), path: "/host" },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="container flex flex-col gap-10 py-12 md:flex-row md:justify-between">
        <div className="max-w-sm space-y-4">
          <Link
            href={localeHref(locale, "/")}
            className="flex items-center gap-2 font-display text-lg font-semibold"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden />
            </span>
            {t("app.name")}
          </Link>
          <p className="text-sm leading-relaxed text-muted-foreground">{t("app.tagline")}</p>
          <LanguageSwitcher variant="list" className="max-w-56" />
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-12">
          {columns.map((column) => (
            <div key={column.title} className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
              <ul className="space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={localeHref(locale, link.path)}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="container flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-ink-400">
          <span>© {new Date().getFullYear()} {t("app.name")}</span>
          <span>{t("home.cities")}</span>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
