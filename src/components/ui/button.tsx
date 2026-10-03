"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Buttons carry eucalyptus green for anything that commits, tibeb gold for the
 * one accent action per screen, and berbere red only for destructive moments.
 *
 * Heights are `min-h-*` rather than `h-*` on purpose: Ethiopic glyphs are taller
 * than Latin ones, and a fixed height clips Amharic labels.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,box-shadow,transform] disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-eucalyptus-600",
        secondary: "bg-secondary text-secondary-foreground hover:bg-eucalyptus-100",
        soft: "bg-primary-soft text-primary hover:bg-eucalyptus-100",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-ink-700 hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        accent: "bg-accent text-accent-foreground shadow-sm hover:bg-tibeb-500",
        destructive: "bg-destructive text-destructive-foreground hover:bg-berbere-500",
        dark: "bg-ink-900 text-paper hover:bg-ink-800",
      },
      size: {
        sm: "min-h-9 px-3.5 py-1.5 text-[13px] [&_svg]:size-4",
        default: "min-h-11 px-5 py-2 text-sm [&_svg]:size-4",
        lg: "min-h-12 px-6 py-2.5 text-base [&_svg]:size-5",
        xl: "min-h-14 px-8 py-3 text-base [&_svg]:size-5",
        icon: "h-11 w-11 [&_svg]:size-5",
        iconSm: "h-9 w-9 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

const spinnerSizes = { sm: "size-4", default: "size-5", lg: "size-7" } as const;

function Spinner({
  className,
  size = "default",
  label,
}: {
  className?: string;
  size?: keyof typeof spinnerSizes;
  label?: string;
}) {
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-2", className)}>
      <Loader2 className={cn("animate-spin text-muted-foreground", spinnerSizes[size])} aria-hidden />
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : null}
      <span className="sr-only">{label ?? "Loading"}</span>
    </span>
  );
}

export { Button, buttonVariants, Spinner };
