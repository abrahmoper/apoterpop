"use client";

/**
 * The site header.
 *
 * Client islands only where interaction demands it: the account menu, the
 * mobile drawer and the language switcher. The unread badge on the messages
 * link is fed from the layout, which already knows the count for the mobile
 * tab bar, so it costs one query per page, not two.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  ChevronDown,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";

import { signOutAction } from "@/actions/auth";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n/client";
import { photoUrl } from "@/lib/photos";
import { formatPhone } from "@/lib/utils";
import type { Locale, SessionUser } from "@/lib/types";

const DRAWER_ID = "mobile-nav-drawer";

/** Phone first (it is how people sign in), email as a fallback for old accounts. */
function contactLine(user: SessionUser): string {
  return user.phone ? formatPhone(user.phone) : (user.email ?? "");
}

export function SiteHeader({ user, unread }: { user: SessionUser | null; unread: number }) {
  const { t, href, locale } = useI18n();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer whenever the route changes (back button, links elsewhere).
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Escape closes it, like every other overlay.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const links = [
    { path: "/search", label: t("nav.explore"), icon: Compass },
    { path: "/services", label: t("nav.services"), icon: MapPin },
  ];

  const active = (path: string) => !!pathname?.startsWith(href(path));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="container flex h-[var(--header-h)] items-center gap-3">
        <Link
          href={href("/")}
          className="flex items-center gap-2 rounded-lg font-display text-lg font-semibold tracking-tight text-foreground"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" aria-hidden />
          </span>
          <span className="hidden min-[380px]:inline">{t("app.name")}</span>
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.path}
              href={href(link.path)}
              aria-current={active(link.path) ? "page" : undefined}
              className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                active(link.path)
                  ? "bg-primary-soft text-primary"
                  : "text-ink-600 hover:bg-muted hover:text-foreground"
              }`}
            >
              <link.icon className="size-4" aria-hidden />
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />

          {user ? (
            <AccountMenu user={user} unread={unread} locale={locale} />
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button asChild variant="ghost" size="sm">
                <Link href={href("/signin")}>{t("nav.signIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href={href("/signup")}>{t("nav.signUp")}</Link>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-expanded={drawerOpen}
            aria-controls={DRAWER_ID}
            aria-label={drawerOpen ? t("common.close") : t("common.openMenu")}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            {drawerOpen ? <X aria-hidden /> : <Menu aria-hidden />}
          </Button>
        </div>
      </div>

      {drawerOpen ? (
        <MobileDrawer
          user={user}
          unread={unread}
          locale={locale}
          onClose={() => setDrawerOpen(false)}
        />
      ) : null}
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/*  Account menu                                                                */
/* -------------------------------------------------------------------------- */

function AccountMenu({
  user,
  unread,
  locale,
}: {
  user: SessionUser;
  unread: number;
  locale: Locale;
}) {
  const { t, href } = useI18n();
  const avatarSrc = user.avatarKey ? photoUrl(user.avatarKey) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative flex items-center gap-1.5 rounded-full border border-border bg-card p-1 pr-2.5 shadow-sm transition-shadow hover:shadow-card"
        aria-label={t("nav.account")}
      >
        <UserAvatar name={user.fullName} src={avatarSrc} className="size-8" />
        <span className="hidden max-w-24 truncate text-sm font-medium sm:inline">
          {user.fullName.split(" ")[0]}
        </span>
        <ChevronDown className="size-4 text-ink-400" aria-hidden />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-berbere ring-2 ring-background"
            aria-hidden
          />
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[15rem]">
        <DropdownMenuLabel className="flex items-center gap-2.5">
          <UserAvatar name={user.fullName} src={avatarSrc} className="size-9 text-sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{user.fullName}</span>
            <span className="tnum block truncate text-xs font-normal text-muted-foreground">
              {contactLine(user)}
            </span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={href("/trips")}>
            <Compass aria-hidden />
            {t("nav.trips")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={href("/favorites")}>
            <Heart aria-hidden />
            {t("nav.favorites")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={href("/messages")} className="justify-between">
            <span className="flex items-center gap-2.5">
              <Mail aria-hidden />
              {t("nav.messages")}
            </span>
            {unread > 0 ? (
              <Badge variant="verified" className="tnum">
                {unread}
              </Badge>
            ) : null}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={href("/profile")}>
            <User aria-hidden />
            {t("nav.profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={href("/host")}>
            {user.isHost ? <LayoutDashboard aria-hidden /> : <Sparkles aria-hidden />}
            {user.isHost ? t("nav.hostDashboard") : t("nav.becomeHost")}
          </Link>
        </DropdownMenuItem>
        {/* No /admin page exists yet; add the menu item back when it ships. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOutAction(locale)}>
          <LogOut aria-hidden />
          {t("nav.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/*  Mobile drawer                                                               */
/* -------------------------------------------------------------------------- */

function MobileDrawer({
  user,
  unread,
  locale,
  onClose,
}: {
  user: SessionUser | null;
  unread: number;
  locale: Locale;
  onClose: () => void;
}) {
  const { t, href } = useI18n();

  const links = [
    { path: "/search", label: t("nav.explore") },
    { path: "/services", label: t("nav.services") },
  ];
  if (user) {
    links.push(
      { path: "/trips", label: t("nav.trips") },
      { path: "/favorites", label: t("nav.favorites") },
      { path: "/messages", label: t("nav.messages") },
      // Non-hosts see the invitation, not a dashboard they do not have yet.
      { path: "/host", label: user.isHost ? t("nav.hostDashboard") : t("nav.becomeHost") },
      { path: "/profile", label: t("nav.profile") },
    );
  }

  return (
    <div
      id={DRAWER_ID}
      className="max-h-[calc(100dvh-var(--header-h))] overflow-y-auto border-t border-border bg-card md:hidden"
    >
      <nav aria-label="Mobile" className="container flex flex-col gap-1 py-4">
        {user ? (
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-muted/60 px-3 py-3">
            <UserAvatar
              name={user.fullName}
              src={user.avatarKey ? photoUrl(user.avatarKey) : null}
              className="size-10"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{user.fullName}</p>
              <p className="tnum truncate text-xs text-muted-foreground">{contactLine(user)}</p>
            </div>
          </div>
        ) : null}

        {links.map((link) => (
          <Link
            key={link.path}
            href={href(link.path)}
            onClick={onClose}
            className="flex min-h-12 items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-ink-700 transition-colors hover:bg-muted"
          >
            {link.label}
            {link.path === "/messages" && unread > 0 ? (
              <Badge variant="verified" className="tnum">
                {unread}
              </Badge>
            ) : null}
          </Link>
        ))}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          {user ? (
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                onClose();
                await signOutAction(locale);
              }}
            >
              <LogOut aria-hidden />
              {t("nav.signOut")}
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" className="flex-1">
                <Link href={href("/signin")} onClick={onClose}>
                  {t("nav.signIn")}
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href={href("/signup")} onClick={onClose}>
                  {t("nav.signUp")}
                </Link>
              </Button>
            </>
          )}
          <LanguageSwitcher variant="segmented" />
        </div>

        <p className="mt-3 px-1 text-xs text-ink-400">{t("app.tagline")}</p>
      </nav>
    </div>
  );
}

export default SiteHeader;
