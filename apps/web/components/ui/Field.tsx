import type { InputHTMLAttributes, ReactNode } from "react";

// Ported from `Design System/components/core/Field.jsx` (Field + Input).

export function Field({
  label,
  error,
  children,
}: {
  label: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-text">
      {label}
      {children}
      {error && (
        <span role="alert" className="text-xs font-normal text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid = false, className = "", ...rest }: InputProps) {
  return (
    <input
      className={[
        "rounded-sm border bg-bg px-3 py-2 text-sm text-text outline-none",
        "transition-colors focus:border-accent",
        invalid ? "border-danger" : "border-border",
        className,
      ].join(" ")}
      {...rest}
    />
  );
}
