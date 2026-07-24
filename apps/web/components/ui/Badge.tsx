import type { ReactNode } from "react";

// Ported from `Design System/components/core/Badge.jsx`.

type Tone = "neutral" | "accent" | "success" | "danger";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  accent: "bg-kid-turquoise-soft text-accent-hover",
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5",
        "text-xs font-semibold",
        TONES[tone],
      ].join(" ")}
    >
      {children}
    </span>
  );
}
