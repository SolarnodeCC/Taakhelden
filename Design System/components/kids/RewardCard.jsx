import React from 'react';

export function RewardCard({ icon, title, price, affordable = true }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', textAlign: 'center',
      background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '1rem',
      fontFamily: 'var(--font-rounded)', boxShadow: 'var(--shadow-sm)', opacity: affordable ? 1 : 0.55,
    }}>
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--kid-text)', fontSize: 'var(--text-base)' }}>{title}</div>
      <div style={{ color: 'var(--kid-turquoise)', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{price} punten</div>
    </div>
  );
}
