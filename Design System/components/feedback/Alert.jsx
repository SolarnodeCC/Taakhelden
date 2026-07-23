import React from 'react';

export function Alert({ tone = 'danger', children }) {
  const map = { danger: { color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }, success: { color: 'var(--color-success)', background: 'var(--color-success-bg)' } };
  const c = map[tone] || map.danger;
  return (
    <p role="alert" style={{ margin: 0, padding: '0.625rem 0.875rem', borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', ...c }}>
      {children}
    </p>
  );
}
