import type { HTMLAttributes } from "react";

// Ported from `Design System/components/core/Card.jsx`. Dashboard register:
// white surface, 1px border, large-ish radius, near-flat shadow.

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  padded = true,
  className = "",
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-border bg-bg shadow-sm",
        padded ? "p-5" : "",
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
