import React from 'react';

export function TaskCard({ icon, title, points, done = false, onToggle }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem', background: done ? 'var(--kid-turquoise-soft)' : '#fff',
      border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: '0.875rem 1rem',
      fontFamily: 'var(--font-rounded)', boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ fontSize: '1.75rem', lineHeight: 1 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--kid-text)', textDecoration: done ? 'line-through' : 'none' }}>{title}</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--kid-turquoise)', fontWeight: 'var(--weight-semibold)' }}>+{points} punten</div>
      </div>
      <button type="button" onClick={onToggle} aria-pressed={done} style={{
        width: '2.75rem', height: '2.75rem', borderRadius: 'var(--radius-full)', cursor: 'pointer',
        background: done ? 'var(--kid-turquoise)' : '#fff', color: done ? '#fff' : 'var(--kid-turquoise)',
        border: done ? 'none' : '2px dashed var(--kid-turquoise)', opacity: done ? 1 : 0.6,
        fontSize: '1.25rem', fontWeight: 'var(--weight-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>✓</button>
    </div>
  );
}
