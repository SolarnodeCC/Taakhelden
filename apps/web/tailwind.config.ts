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
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        accent: {
          DEFAULT: "var(--color-accent)",
          hover: "var(--color-accent-hover)",
          fg: "var(--color-on-accent)",
        },
        danger: {
          DEFAULT: "var(--color-danger)",
          bg: "var(--color-danger-bg)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        // Kid + teen palettes — inferred/placeholder (see globals.css).
        kid: {
          coral: "var(--kid-coral)",
          "coral-soft": "var(--kid-coral-soft)",
          turquoise: "var(--kid-turquoise)",
          "turquoise-soft": "var(--kid-turquoise-soft)",
          yellow: "var(--kid-yellow)",
          "yellow-soft": "var(--kid-yellow-soft)",
          cream: "var(--kid-cream)",
          text: "var(--kid-text)",
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
        rounded: "var(--font-rounded)",
      },
      fontSize: {
        xs: "var(--text-xs)",
        sm: "var(--text-sm)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        xl: "var(--text-xl)",
        "2xl": "var(--text-2xl)",
        "3xl": "var(--text-3xl)",
        "4xl": "var(--text-4xl)",
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
    },
  },
  plugins: [],
};

export default config;
