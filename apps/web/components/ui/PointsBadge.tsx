// Ported from `Design System/components/kids/PointsBadge.jsx`.

export function PointsBadge({ points }: { points: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-kid-yellow-soft px-3.5 py-1.5 font-rounded text-base font-semibold text-kid-yellow-text">
      <span>⭐</span>
      {points} punten
    </span>
  );
}
