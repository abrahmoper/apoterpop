"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { controlBase } from "@/components/ui/form";
import { cn } from "@/lib/utils";

type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Ethiopian phone number with a fixed +251 prefix. The prefix is decoration:
 * the server accepts 0911..., 911... or +251911... and normalises them all.
 */
const PhoneInput = React.forwardRef<HTMLInputElement, NativeInputProps & { countryCode?: string }>(
  ({ className, countryCode = "+251", ...props }, ref) => (
    <div className="relative">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 my-2 flex items-center border-r border-input pl-3.5 pr-3 text-base font-medium text-ink-600 sm:text-[15px]"
        aria-hidden
      >
        {countryCode}
      </span>
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        className={cn(controlBase, "tnum min-h-11 pl-[4.75rem]", className)}
        {...props}
      />
    </div>
  ),
);
PhoneInput.displayName = "PhoneInput";

/** Password field with a show/hide toggle; labels are passed in already translated. */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  NativeInputProps & { showLabel?: string; hideLabel?: string }
>(({ className, showLabel = "Show password", hideLabel = "Hide password", ...props }, ref) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn(controlBase, "min-h-11 pr-12", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PhoneInput, PasswordInput };
