import { forwardRef, type HTMLAttributes } from "react";

// Ported from `Design System/components/core/Card.jsx`. Dashboard register:
// quiet surfaces, hairline borders, near-flat shadows.
//
// Variants exist because the dashboard genuinely has three container jobs, and
// before they were named every screen re-declared its own class string:
//   panel   — a standalone block on the page background (settings, invite code)
//   row     — an item inside a list (tasks, rewards, children, approvals)
//   tinted  — a callout that must read as different (onboarding, danger zone)
// Reach for one of these instead of hand-rolling `rounded-lg border …`.

// `panel` and `row` deliberately share a surface and differ only in padding —
// that was already the de-facto rule at 15 of the 17 sites this replaced. The
// old white + shadow default was the odd one out and has been retired.

type Variant = "panel" | "row" | "tinted-accent" | "tinted-danger";

const VARIANTS: Record<Variant, string> = {
  panel: "border border-border bg-surface",
  row: "border border-border bg-surface",
  "tinted-accent": "border border-accent/30 bg-accent/5",
  "tinted-danger": "border border-danger/40 bg-danger/5",
};

const PADDING: Record<Variant, string> = {
  panel: "p-5",
  row: "p-4",
  "tinted-accent": "px-4 py-3",
  "tinted-danger": "p-4",
};

interface CardProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  padded?: boolean;
  /** `li` inside a list, `section`/`form` when the card owns a heading. */
  as?: "div" | "li" | "section" | "form";
}

// forwardRef so callers that need to scroll a card into view (the invite code
// during onboarding) can reach the node without dropping back to raw markup.
export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  { variant = "panel", padded = true, as: Tag = "div", className = "", children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref as never}
      className={[
        "rounded-lg",
        VARIANTS[variant],
        padded ? PADDING[variant] : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </Tag>
  );
});
