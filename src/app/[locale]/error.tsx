"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/client";

/**
 * Catches render errors below the layout, so the header, footer and tab bar
 * stay put and the visitor gets a way forward instead of a blank screen.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, href } = useI18n();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-berbere-50 text-berbere">
        <AlertTriangle className="size-8" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        {t("error.generic")}
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {t("error.genericBody")}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="rounded-full">
          <RotateCcw aria-hidden />
          {t("common.retry")}
        </Button>
        <Button asChild variant="outline" className="rounded-full">
          <Link href={href("/")}>
            <Home aria-hidden />
            {t("error.goHome")}
          </Link>
        </Button>
      </div>
      {error.digest ? (
        <p className="mt-6 font-mono text-[11px] text-ink-400">{error.digest}</p>
      ) : null}
    </div>
  );
}
