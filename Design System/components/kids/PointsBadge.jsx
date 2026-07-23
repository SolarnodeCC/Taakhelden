import React from 'react';

export function PointsBadge({ points }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: 'var(--kid-yellow-soft)',
      color: '#8a5a00', borderRadius: 'var(--radius-full)', padding: '0.375rem 0.875rem',
      fontFamily: 'var(--font-rounded)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-base)',
    }}>
      <span>⭐</span>{points} punten
    </div>
  );
}
