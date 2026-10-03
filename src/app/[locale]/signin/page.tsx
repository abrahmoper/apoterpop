import Link from "next/link";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import type { Locale } from "@/lib/types";
import { isSafeRedirectPath } from "@/lib/utils";
import { SignInForm } from "./signin-form";

/**
 * Sign-in. Anyone already signed in has no business here, so send them on.
 */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { t, href, locale } = await getI18n(params);
  const { next: rawNext } = await searchParams;
  // Only same-site paths are carried through; "//evil.com" and friends are dropped.
  const next = isSafeRedirectPath(rawNext) ? rawNext : "";

  const user = await getSessionUser();
  if (user) redirect(next || href("/"));

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10 sm:py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {t("auth.signInTitle")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.signInBody")}</p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-card sm:p-8">
          <SignInForm locale={locale} next={next} />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link
            href={href(`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`)}
            className="font-semibold text-primary hover:underline"
          >
            {t("nav.signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
