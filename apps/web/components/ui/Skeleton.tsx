// Placeholder blocks that hold the shape of the content still loading, so the
// page does not jump when data lands. `motion-safe:` keeps the pulse off for
// users who asked for reduced motion; the block itself stays visible either way.

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={["motion-safe:animate-pulse rounded bg-border", className].join(" ")}
      aria-hidden
    />
  );
}

/**
 * Row-shaped placeholders sized to the real list items they stand in for.
 * Wrap in an `aria-busy` container so the swap is announced once, rather than
 * letting each skeleton chatter at assistive tech.
 */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
