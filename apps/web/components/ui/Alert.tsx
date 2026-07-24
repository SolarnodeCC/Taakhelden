import type { ReactNode } from "react";

// Ported from `Design System/components/feedback/Alert.jsx`.

type Tone = "danger" | "success";

const TONES: Record<Tone, string> = {
  danger: "bg-danger-bg text-danger",
  success: "bg-success-bg text-success",
};

export function Alert({
  tone = "danger",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <p
      role="alert"
      className={["m-0 rounded-sm px-3.5 py-2.5 text-sm", TONES[tone]].join(" ")}
    >
      {children}
    </p>
  );
}
