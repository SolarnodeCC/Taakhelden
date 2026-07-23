import type { ReactNode } from 'react';

/**
 * Badge — small status pill (neutral/accent/success/danger) for statuses like
 * "wacht op goedkeuring" or "goedgekeurd".
 * @startingPoint section="Core" subtitle="Status pill, 4 tones" viewport="700x120"
 */
export interface BadgeProps {
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
  children: ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
