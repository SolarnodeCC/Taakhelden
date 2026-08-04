import type { Config } from "tailwindcss";

// Theme maps onto the CSS variables declared in app/globals.css (the token
// source of truth, mirrored in `Design System/tokens/`), so both Tailwind
// utilities and any future iOS layer read the same values.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: {
          // Hairlines/dividers (1.23:1 on white) — decorative only.
          DEFAULT: "var(--color-border)",
          // Control boundaries (>=3:1 on bg and surface) — inputs, secondary buttons.
          interactive: "var(--color-border-interactive)",
        },
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          fg: "var(--color-on-accent)",
          // Foreground for accent-tinted fills; `decorative` is non-text only.
          "on-tint": "var(--color-accent-on-tint)",
          decorative: "var(--color-accent-decorative)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          bg: "var(--color-danger-bg)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          text: "var(--color-success-text)",
          bg: "var(--color-success-bg)",
        },
        // Kid + teen palettes — shipping brand v1 (see docs/brand/wispel-brand-v1.md).
        kid: {
          coral: "var(--kid-coral)",
          "coral-soft": "var(--kid-coral-soft)",
          turquoise: "var(--kid-turquoise)",
          "turquoise-soft": "var(--kid-turquoise-soft)",
          yellow: "var(--kid-yellow)",
          "yellow-soft": "var(--kid-yellow-soft)",
          cream: "var(--kid-cream)",
          text: "var(--kid-text)",
          "coral-text": "var(--kid-coral-text)",
          "yellow-text": "var(--kid-yellow-text)",
        },
        teen: {
          navy: "var(--teen-navy)",
          "navy-surface": "var(--teen-navy-surface)",
          mint: "var(--teen-mint)",
          text: "var(--teen-text)",
          muted: "var(--teen-muted)",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        display: "var(--font-display)",
        rounded: "var(--font-rounded)",
      },
      // Every step ships a paired line-height. A bare string here would emit
      // `font-size` only and silently drop Tailwind's defaults, leaving all body
      // copy at the UA's `normal` (~1.2) — too tight for Dutch prose. Body steps
      // get ~1.5; display steps tighten as they grow.
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "var(--leading-normal)" }],
        sm: ["var(--text-sm)", { lineHeight: "var(--leading-normal)" }],
        base: ["var(--text-base)", { lineHeight: "1.6" }],
        lg: ["var(--text-lg)", { lineHeight: "1.45" }],
        xl: ["var(--text-xl)", { lineHeight: "1.35" }],
        "2xl": ["var(--text-2xl)", { lineHeight: "1.25" }],
        "3xl": ["var(--text-3xl)", { lineHeight: "var(--leading-tight)" }],
        "4xl": ["var(--text-4xl)", { lineHeight: "var(--leading-tight)" }],
      },
      fontWeight: {
        normal: "var(--weight-regular)",
        medium: "var(--weight-medium)",
        semibold: "var(--weight-semibold)",
        bold: "var(--weight-bold)",
      },
      lineHeight: {
        tight: "var(--leading-tight)",
        normal: "var(--leading-normal)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        5: "var(--space-5)",
        6: "var(--space-6)",
        8: "var(--space-8)",
        10: "var(--space-10)",
        12: "var(--space-12)",
        16: "var(--space-16)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        kid: "var(--shadow-kid)",
      },
      transitionTimingFunction: {
        DEFAULT: "ease",
      },
      // Mount animation for the mobile nav drawer. It toggles `display`, which
      // no transition can animate, so the slide-in has to be a keyframe.
      keyframes: {
        "drawer-in": {
          from: { transform: "translateX(-100%)" },
          to: { transform: "translateX(0)" },
        },
      },
      animation: {
        "drawer-in": "drawer-in 200ms ease",
      },
    },
  },
  plugins: [],
};

export default config;
