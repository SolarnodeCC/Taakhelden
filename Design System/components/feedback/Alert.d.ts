import type { ReactNode } from 'react';

/**
 * Alert — inline form/page feedback message (error or success), matching the
 * login form's `role="alert"` red text but with a soft background chip.
 * @startingPoint section="Feedback" subtitle="Inline error/success message" viewport="700x100"
 */
export interface AlertProps {
  tone?: 'danger' | 'success';
  children: ReactNode;
}
export function Alert(props: AlertProps): JSX.Element;
