import type { Config } from "tailwindcss";

/**
 * Kiray design tokens.
 *
 * The palette is drawn from Ethiopian highland materials rather than the usual
 * marketplace red: eucalyptus green carries every primary action, tibeb gold
 * (the woven border on a habesha kemis) is the accent, and berbere red is kept
 * in reserve for saved-state and destructive moments only.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1.25rem", sm: "1.5rem", lg: "2rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
          soft: "hsl(var(--accent-soft))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Named brand tokens, usable directly: bg-eucalyptus, text-tibeb …
        // `ink` is a full ramp because text hierarchy leans on it everywhere:
        // ink-900 for headings, ink-600 for body, ink-400 for metadata.
        ink: {
          DEFAULT: "#14181A",
          50: "#F6F7F6",
          100: "#ECEEEC",
          200: "#D8DCD9",
          300: "#B9C0BC",
          400: "#8B9490",
          500: "#6B7570",
          600: "#515A56",
          700: "#3C4441",
          800: "#262C2A",
          900: "#14181A",
        },
        paper: "#FBFAF7",
        eucalyptus: {
          DEFAULT: "#1D6F52",
          50: "#EFF6F2",
          100: "#D9EAE1",
          200: "#B2D5C4",
          300: "#7FB99F",
          400: "#4A9576",
          500: "#1D6F52",
          600: "#175A43",
          700: "#124635",
          800: "#0D3527",
          900: "#08211A",
        },
        tibeb: {
          DEFAULT: "#C8952B",
          50: "#FBF5E8",
          100: "#F5E7C6",
          200: "#EACF8D",
          300: "#DDB559",
          400: "#C8952B",
          500: "#A87A20",
          600: "#855F19",
        },
        berbere: {
          DEFAULT: "#B3402F",
          50: "#FBEEEC",
          100: "#F5D5D0",
          200: "#E5A79D",
          300: "#CE6E5F",
          400: "#B3402F",
          500: "#8F3325",
        },
        mist: "#E7E9E5",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      fontSize: {
        "display-xl": ["clamp(2.6rem, 6vw, 4.4rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2rem, 4.2vw, 3rem)", { lineHeight: "1.06", letterSpacing: "-0.025em" }],
        "display-md": ["clamp(1.5rem, 2.6vw, 2rem)", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        eyebrow: ["0.6875rem", { lineHeight: "1", letterSpacing: "0.16em" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 6px)",
        "2xl": "calc(var(--radius) + 14px)",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,24,26,0.04), 0 8px 24px -12px rgba(20,24,26,0.12)",
        lift: "0 2px 4px rgba(20,24,26,0.05), 0 18px 40px -16px rgba(20,24,26,0.22)",
        pin: "0 1px 2px rgba(20,24,26,0.18), 0 4px 12px -2px rgba(20,24,26,0.24)",
        sheet: "0 -8px 40px -12px rgba(20,24,26,0.28)",
      },
      backgroundImage: {
        // The "tibeb thread": a woven hairline used for active nav and section
        // rules. It is the one piece of ornament in the system.
        thread:
          "repeating-linear-gradient(135deg, #1D6F52 0 3px, #C8952B 3px 6px, #B3402F 6px 9px)",
        "thread-soft":
          "repeating-linear-gradient(135deg, rgba(29,111,82,0.5) 0 3px, rgba(200,149,43,0.5) 3px 6px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pin-pop": {
          "0%": { transform: "scale(0.86)" },
          "60%": { transform: "scale(1.06)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 0.4s ease-out both",
        "pin-pop": "pin-pop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
