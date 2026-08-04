import type { ComponentProps, ReactNode } from "react";
import { Link } from "../../i18n/navigation";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-fg border border-accent hover:bg-accent-hover",
  secondary: "bg-bg text-text border border-border-interactive hover:bg-surface",
  ghost: "bg-transparent text-text border border-transparent hover:bg-surface",
};

const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-3 py-1.5 text-sm",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-base",
};

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
  icon?: ReactNode;
};

/** Link styled like `Button` — shared CTA primitive for marketing/auth. */
export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={[
        "inline-flex items-center justify-center gap-2 rounded font-semibold",
        "transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(" ")}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}
