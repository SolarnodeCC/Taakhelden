import { WispelMark } from "./WispelMark";

type WispelWordmarkProps = {
  className?: string;
  markClassName?: string;
  /** Visually hide the text (mark-only) while keeping an accessible name. */
  markOnly?: boolean;
};

/** Mark + “Wispel” word — parent-calm register; color via `currentColor` / text utilities. */
export function WispelWordmark({
  className = "inline-flex items-center gap-2 text-accent",
  markClassName = "h-7 w-7 shrink-0",
  markOnly = false,
}: WispelWordmarkProps) {
  return (
    <span className={className}>
      <WispelMark className={markClassName} />
      {markOnly ? <span className="sr-only">Wispel</span> : <span>Wispel</span>}
    </span>
  );
}
