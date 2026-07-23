import React from 'react';

export function Card({ children, style, padded = true }) {
  return (
    <div style={{
      background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)', padding: padded ? 'var(--space-5)' : 0, ...style,
    }}>
      {children}
    </div>
  );
}
