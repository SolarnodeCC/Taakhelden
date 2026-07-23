import type { ReactNode, MouseEventHandler, CSSProperties } from 'react';

/**
 * Button — primary interactive control for the parent dashboard (and any
 * calm, business-facing surface). Solid teal primary, bordered secondary,
 * text-only ghost, and a red danger variant for destructive confirms.
 * @startingPoint section="Core" subtitle="Primary/secondary/ghost/danger buttons" viewport="700x160"
 */
export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  style?: CSSProperties;
}

export function Button(props: ButtonProps): JSX.Element;
