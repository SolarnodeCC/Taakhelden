import type { Config } from "tailwindcss";

// Theme maps onto the CSS variables declared in app/globals.css (the token
// source of truth), so both Tailwind utilities and any future iOS layer read
// the same values.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
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
        danger: "var(--color-danger)",
        success: "var(--color-success)",
      },
      borderRadius: {
        DEFAULT: "var(--radius)",
      },
      fontFamily: {
        sans: "var(--font-sans)",
      },
    },
  },
  plugins: [],
};

export default config;
