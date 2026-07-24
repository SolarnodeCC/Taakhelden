import type { ReactNode } from "react";

// Ported from `Design System/components/feedback/ProgressBar.jsx`.

export function ProgressBar({
  value = 0,
  max = 100,
  tone = "accent",
  label,
}: {
  value?: number;
  max?: number;
  tone?: "accent" | "kid";
  label?: ReactNode;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm text-muted">{label}</span>}
      <div className="h-2.5 overflow-hidden rounded-full bg-surface">
        <div
          className={[
            "h-full rounded-full transition-[width] duration-200",
            tone === "kid" ? "bg-kid-coral" : "bg-accent",
          ].join(" ")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
