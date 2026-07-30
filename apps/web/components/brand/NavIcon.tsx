import type { ReactElement, SVGProps } from "react";

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

type NavIconName =
  | "vandaag"
  | "goedkeuren"
  | "taken"
  | "winkel"
  | "gezin"
  | "instellingen"
  | "inzichten";

const PATHS: Record<NavIconName, ReactElement> = {
  vandaag: (
    <>
      <rect x="3.5" y="4.5" width="13" height="12" rx="2" {...strokeProps} />
      <path d="M3.5 8.5h13M7 2.5v3M13 2.5v3" {...strokeProps} />
    </>
  ),
  goedkeuren: (
    <>
      <circle cx="10" cy="10" r="7" {...strokeProps} />
      <path d="M6.5 10.2 8.8 12.5 13.5 7.5" {...strokeProps} />
    </>
  ),
  taken: (
    <>
      <path d="M4 5.5h12M4 10h12M4 14.5h8" {...strokeProps} />
      <path d="M14.5 13.2 16 14.7 18.5 11.5" {...strokeProps} />
    </>
  ),
  winkel: (
    <>
      <path d="M4.5 7.5h11l-.8 8.2a1.5 1.5 0 0 1-1.5 1.3H6.8a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z" {...strokeProps} />
      <path d="M7.5 7.5V6a2.5 2.5 0 0 1 5 0v1.5" {...strokeProps} />
    </>
  ),
  gezin: (
    <>
      <circle cx="7" cy="7" r="2.25" {...strokeProps} />
      <circle cx="13.5" cy="7.5" r="2" {...strokeProps} />
      <path d="M3.5 16c.4-2.6 2.2-4 3.5-4s3.1 1.4 3.5 4" {...strokeProps} />
      <path d="M11 16c.2-1.8 1.3-3 2.5-3s2.2 1 2.5 2.6" {...strokeProps} />
    </>
  ),
  instellingen: (
    <>
      <circle cx="10" cy="10" r="2.5" {...strokeProps} />
      <path
        d="M10 3.5v1.4M10 15.1v1.4M3.5 10h1.4M15.1 10h1.4M5.4 5.4l1 1M13.6 13.6l1 1M14.6 5.4l-1 1M6.4 13.6l-1 1"
        {...strokeProps}
      />
    </>
  ),
  inzichten: (
    <>
      <path d="M3.5 15.5V4.5M3.5 15.5h13" {...strokeProps} />
      <path d="M6.5 12.5v-3M10 12.5V7M13.5 12.5V5.5" {...strokeProps} />
    </>
  ),
};

type NavIconProps = SVGProps<SVGSVGElement> & {
  name: NavIconName;
};

/** Parent-dashboard chrome icons — stroke, calm, no emoji. */
export function NavIcon({ name, className = "h-4 w-4 shrink-0", ...rest }: NavIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}

export type { NavIconName };
