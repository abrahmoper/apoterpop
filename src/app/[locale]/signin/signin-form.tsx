"use client";

import { useActionState } from "react";

import { signInAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { PasswordInput, PhoneInput } from "@/components/ui/auth-inputs";
import { Alert, AlertDescription } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/types";

export function SignInForm({ locale, next }: { locale: Locale; next: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{t(state.error)}</AlertDescription>
        </Alert>
      ) : null}

      <Field label={t("auth.phone")} htmlFor="phone" required hint={t("auth.phoneHint")}>
        <PhoneInput
          id="phone"
          name="phone"
          autoComplete="username"
          required
          placeholder={t("auth.phonePlaceholder")}
          defaultValue={state.values?.phone ?? ""}
        />
      </Field>

      <Field label={t("auth.password")} htmlFor="password" required>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="current-password"
          maxLength={128}
          required
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.submitSignIn")}
      </Button>
    </form>
  );
}
