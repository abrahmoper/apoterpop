import Link from "next/link";
import { Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

/**
 * The 404 inside the locale segment, so it can speak the visitor's language
 * and link back home in the same locale.
 */
export default async function NotFound({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const { t, href } = await getI18n(params);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="grid size-16 place-items-center rounded-2xl bg-muted text-muted-foreground mb-5">
        <Home className="size-8" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        {t("error.notFound")}
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("error.notFoundBody")}</p>
      <Button asChild className="mt-6 rounded-full">
        <Link href={href("/")}>{t("error.goHome")}</Link>
      </Button>
    </div>
  );
}
