import React from 'react';

export function ProgressBar({ value = 0, max = 100, tone = 'accent', label }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const fill = tone === 'kid' ? 'var(--kid-coral)' : 'var(--color-accent)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontFamily: 'var(--font-sans)' }}>
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{label}</span>}
      <div style={{ height: '0.625rem', borderRadius: 'var(--radius-full)', background: 'var(--color-surface)', overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: fill, borderRadius: 'var(--radius-full)', transition: 'width var(--transition-base)' }} />
      </div>
    </div>
  );
}
