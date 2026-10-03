import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  ChevronRight,
  Compass,
  Heart,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Star,
} from "lucide-react";

import { signOutAction } from "@/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge, Card, CardContent, CardHeader, CardTitle, Separator } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";
import { authoredReviews } from "@/lib/db/reviews";
import { getI18n } from "@/lib/i18n/server";
import { photoUrl } from "@/lib/photos";
import { formatDate, formatPhone } from "@/lib/utils";
import type { Locale } from "@/lib/types";

/**
 * The signed-in user's profile, and on phones the "account" hub: the tab bar
 * links here, so everything not in the tab bar (rentals, hosting, language,
 * sign out) is reachable from this page.
 */
export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const user = await getSessionUser();
  if (!user) redirect(href(`/signin?next=${encodeURIComponent(href("/profile"))}`));

  const reviews = await authoredReviews(user.id).catch(() => []);
  const signOut = signOutAction.bind(null, locale);

  const quickLinks = [
    { path: "/trips", label: t("nav.trips"), icon: Compass },
    { path: "/favorites", label: t("nav.favorites"), icon: Heart },
    { path: "/messages", label: t("nav.messages"), icon: Mail },
    {
      path: "/host",
      label: user.isHost ? t("nav.hostDashboard") : t("nav.becomeHost"),
      icon: user.isHost ? LayoutDashboard : Sparkles,
    },
  ];

  return (
    <div className="container max-w-3xl space-y-6 py-8 sm:py-12">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("profile.title")}
      </h1>

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-eucalyptus-500 via-eucalyptus-400 to-tibeb-300" aria-hidden />
        <CardContent className="-mt-10 flex flex-col items-start gap-4 p-5 pt-0 sm:flex-row sm:items-end sm:p-6 sm:pt-0">
          <UserAvatar
            name={user.fullName}
            src={user.avatarKey ? photoUrl(user.avatarKey) : null}
            className="size-20 border-4 border-card text-xl shadow-card"
          />
          <div className="min-w-0 pb-1">
            <p className="truncate font-display text-xl font-semibold text-foreground">{user.fullName}</p>
            <p className="text-sm text-muted-foreground">
              {t("profile.memberSince", { date: formatDate(user.createdAt) })}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {user.isHost ? <Badge variant="verified">{t("mode.host")}</Badge> : null}
              {user.isAdmin ? <Badge variant="accent">{t("nav.admin")}</Badge> : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <nav aria-label={t("nav.account")} className="divide-y divide-border">
          {quickLinks.map((link) => (
            <Link
              key={link.path}
              href={href(link.path)}
              className="flex min-h-14 items-center gap-3 px-5 py-3 text-[15px] font-medium text-ink-800 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/60"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary-soft text-primary">
                <link.icon className="size-4" aria-hidden />
              </span>
              <span className="flex-1">{link.label}</span>
              <ChevronRight className="size-4 text-ink-400" aria-hidden />
            </Link>
          ))}
        </nav>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {user.phone ? (
            <p className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Phone className="size-4" aria-hidden />
                {t("auth.phone")}
              </span>
              <span className="tnum font-medium text-foreground">{formatPhone(user.phone)}</span>
            </p>
          ) : null}
          {user.email ? (
            <p className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Mail className="size-4" aria-hidden />
                {t("auth.email")}
              </span>
              <span className="truncate font-medium text-foreground">{user.email}</span>
            </p>
          ) : null}
          {user.city ? (
            <p className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {t("auth.city")}
              </span>
              <span className="font-medium text-foreground">{user.city}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {user.bio ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("profile.about")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-ink-700">{user.bio}</p>
          </CardContent>
        </Card>
      ) : null}

      {reviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("listing.reviews")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reviews.map((review, index) => (
              <div key={review.id}>
                <div className="flex items-center gap-2">
                  <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                  <span className="text-sm font-semibold">{review.rating}/5</span>
                  <span className="text-xs text-muted-foreground">{formatDate(review.created_at)}</span>
                </div>
                {review.comment ? (
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{review.comment}</p>
                ) : null}
                {index < reviews.length - 1 ? <Separator className="mt-4" /> : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <LanguageSwitcher variant="list" />
          </Suspense>
        </CardContent>
      </Card>

      <form action={signOut}>
        <Button type="submit" variant="outline" size="lg" className="w-full rounded-full text-destructive hover:text-destructive">
          <LogOut aria-hidden />
          {t("nav.signOut")}
        </Button>
      </form>
    </div>
  );
}
