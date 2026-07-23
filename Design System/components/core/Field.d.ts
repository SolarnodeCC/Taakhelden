import type { ReactNode, ChangeEventHandler } from 'react';

/**
 * Field — labeled form field wrapper with inline error text; wraps Input or
 * any control. Matches the login form's label/input/error stack exactly.
 * @startingPoint section="Core" subtitle="Labeled input with error state" viewport="700x180"
 */
export interface FieldProps {
  label: ReactNode;
  error?: string;
  children: ReactNode;
}
export function Field(props: FieldProps): JSX.Element;

/** Input — bordered text input, teal focus ring, red border on error. */
export interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  error?: boolean;
}
export function Input(props: InputProps): JSX.Element;
