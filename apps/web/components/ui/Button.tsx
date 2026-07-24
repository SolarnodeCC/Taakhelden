import type { ButtonHTMLAttributes, ReactNode } from "react";

// Ported from `Design System/components/core/Button.jsx` into the app's
// Tailwind-token convention. Hover/disabled states are handled by CSS utilities
// (no client state), so this stays a server component.

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg border border-accent hover:bg-accent-hover",
  secondary:
    "bg-bg text-text border border-border hover:bg-surface",
  ghost: "bg-transparent text-text border border-transparent hover:bg-surface",
  danger: "bg-danger text-white border border-danger hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 rounded font-semibold",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
