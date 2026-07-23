/**
 * ProgressBar — savings-goal / weekly-target progress ("nog 120 punten tot de
 * bioscoop!"). `tone="kid"` uses coral fill for kid-mode surfaces.
 * @startingPoint section="Feedback" subtitle="Savings goal / weekly progress" viewport="700x100"
 */
export interface ProgressBarProps {
  value?: number;
  max?: number;
  tone?: 'accent' | 'kid';
  label?: string;
}
export function ProgressBar(props: ProgressBarProps): JSX.Element;
