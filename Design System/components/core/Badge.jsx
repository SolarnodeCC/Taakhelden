import React from 'react';

const tones = {
  neutral: { background: 'var(--color-surface)', color: 'var(--color-text-muted)' },
  accent: { background: 'var(--kid-turquoise-soft)', color: 'var(--color-accent-hover)' },
  success: { background: 'var(--color-success-bg)', color: 'var(--color-success)' },
  danger: { background: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
};

export function Badge({ tone = 'neutral', children }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.25rem', borderRadius: 'var(--radius-full)',
      padding: '0.125rem 0.625rem', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
      fontFamily: 'var(--font-sans)', ...tones[tone],
    }}>
      {children}
    </span>
  );
}
