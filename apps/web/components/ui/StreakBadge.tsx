// Ported from `Design System/components/kids/StreakBadge.jsx`.

export function StreakBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-kid-coral-soft px-3.5 py-1.5 font-rounded text-base font-semibold text-[#a13a1f]">
      <span>🔥</span>
      {days} dagen op rij
    </span>
  );
}
