"use client";

import { useActionState } from "react";

import { signUpAction, type AuthState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/form";
import { PasswordInput, PhoneInput } from "@/components/ui/auth-inputs";
import { Alert, AlertDescription } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/types";

export function SignUpForm({ locale, next }: { locale: Locale; next: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signUpAction, {});
  const values = state.values ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />

      {state.error ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{t(state.error)}</AlertDescription>
        </Alert>
      ) : null}

      <Field label={t("auth.fullName")} htmlFor="fullName" required>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={values.fullName ?? ""}
        />
      </Field>

      <Field label={t("auth.phone")} htmlFor="phone" required hint={t("auth.phoneHint")}>
        <PhoneInput
          id="phone"
          name="phone"
          autoComplete="tel-national"
          required
          placeholder={t("auth.phonePlaceholder")}
          defaultValue={values.phone ?? ""}
        />
      </Field>

      <Field label={t("auth.password")} htmlFor="password" required hint={t("auth.passwordHint")}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
        />
      </Field>

      <Field label={t("auth.confirmPassword")} htmlFor="confirmPassword" required>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          showLabel={t("auth.showPassword")}
          hideLabel={t("auth.hidePassword")}
        />
      </Field>

      <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-sm text-ink-700">
        {/* key remounts the checkbox so it reflects the echoed value after an error */}
        <Checkbox
          key={values.isHost ? "host" : "guest"}
          name="isHost"
          value="1"
          defaultChecked={!!values.isHost}
          className="mt-0.5"
        />
        <span>
          <span className="block font-medium">{t("auth.wantToHost")}</span>
          <span className="block text-xs text-muted-foreground">{t("auth.wantToHostHint")}</span>
        </span>
      </label>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {t("auth.submitSignUp")}
      </Button>
    </form>
  );
}
