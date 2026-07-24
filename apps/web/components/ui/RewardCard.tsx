import type { ReactNode } from "react";

// Ported from `Design System/components/kids/RewardCard.jsx`. Warm/rounded
// register — used in the parent Shop (Winkel) to preview rewards as kids see them.

export function RewardCard({
  icon,
  title,
  price,
  affordable = true,
}: {
  icon: ReactNode;
  title: ReactNode;
  price: number;
  affordable?: boolean;
}) {
  return (
    <div
      className={[
        "flex flex-col items-center gap-2 rounded-xl border border-border bg-white",
        "p-4 text-center font-rounded shadow-sm",
        affordable ? "" : "opacity-55",
      ].join(" ")}
    >
      <div className="text-3xl">{icon}</div>
      <div className="text-base font-semibold text-kid-text">{title}</div>
      <div className="text-sm font-semibold text-kid-turquoise">
        {price} punten
      </div>
    </div>
  );
}
