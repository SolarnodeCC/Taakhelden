import type { ReactNode, CSSProperties } from 'react';

/**
 * Card — neutral bordered surface for dashboard content blocks (insights,
 * approval rows, settings groups). Flat, low-shadow, business-calm.
 * @startingPoint section="Core" subtitle="Bordered content surface" viewport="700x160"
 */
export interface CardProps {
  children: ReactNode;
  padded?: boolean;
  style?: CSSProperties;
}
export function Card(props: CardProps): JSX.Element;
