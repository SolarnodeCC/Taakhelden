import React from 'react';

export function StreakBadge({ days }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'var(--kid-coral-soft)',
      color: '#a13a1f', borderRadius: 'var(--radius-full)', padding: '0.375rem 0.875rem',
      fontFamily: 'var(--font-rounded)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)',
    }}>
      <span>🔥</span>{days} dagen op rij
    </div>
  );
}
