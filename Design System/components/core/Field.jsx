import React from 'react';

export function Field({ label, error, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--color-text)' }}>
      {label}
      {children}
      {error && <span role="alert" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-danger)', fontWeight: 'var(--weight-regular)' }}>{error}</span>}
    </label>
  );
}

export function Input({ type = 'text', placeholder, value, onChange, error, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type={type} placeholder={placeholder} value={value} onChange={onChange}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{
        borderRadius: 'var(--radius-sm)', border: `1px solid ${error ? 'var(--color-danger)' : focus ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: 'var(--color-bg)', padding: '0.5rem 0.75rem', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)', outline: 'none', transition: 'border-color var(--transition-fast)',
      }}
      {...rest}
    />
  );
}
