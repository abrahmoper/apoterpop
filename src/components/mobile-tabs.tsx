"use client";

/**
 * The mobile tab bar.
 *
 * Five slots, thumb-reachable: home, explore, saved, messages, profile. The
 * layout pads the page bottom by exactly this height (pb-20) so content never
 * hides underneath. The active tab tracks the current path; the messages tab
 * carries the unread dot.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Heart, Home, Mail, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/client";

export function MobileTabs({
  signedIn,
  isHost,
  unread,
}: {
  signedIn: boolean;
  isHost: boolean;
  unread: number;
}) {
  const { t, href } = useI18n();
  const pathname = usePathname() ?? "";

  const tabs = [
    { path: "/", label: t("nav.home"), icon: Home },
    { path: "/search", label: t("nav.explore"), icon: Compass },
    signedIn ? { path: "/favorites", label: t("nav.favorites"), icon: Heart } : null,
    signedIn
      ? { path: "/messages", label: t("nav.messages"), icon: Mail, badge: unread }
      : null,
    signedIn
      ? { path: "/profile", label: t("nav.profile"), icon: User }
      : { path: "/signin", label: t("nav.signIn"), icon: User },
  ].filter(Boolean) as Array<{ path: string; label: string; icon: typeof Home; badge?: number }>;

  return (
    <nav
      aria-label="Mobile tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-sheet backdrop-blur-md md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {tabs.map((tab) => {
          const target = href(tab.path);
          const active = tab.path === "/" ? pathname === target : pathname.startsWith(target);
          return (
            <Link
              key={tab.path}
              href={target}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-ink-500",
              )}
            >
              <span className="relative">
                <tab.icon className="size-5" aria-hidden />
                {tab.badge && tab.badge > 0 ? (
                  <span className="tnum absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-berbere px-1 text-[10px] font-semibold text-white">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                ) : null}
              </span>
              <span className="max-w-full truncate px-1">{tab.label}</span>
              {active ? (
                <span className="absolute inset-x-6 top-0 h-[2px] rounded-full bg-thread" aria-hidden />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabs;
