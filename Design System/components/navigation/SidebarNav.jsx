import React from 'react';

export function SidebarNav({ items, activeKey, onNavigate }) {
  return (
    <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0 0.5rem', fontFamily: 'var(--font-sans)' }}>
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <a
            key={item.key}
            onClick={() => onNavigate && onNavigate(item.key)}
            style={{
              borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
              cursor: 'pointer', textDecoration: 'none',
              background: active ? 'var(--color-accent)' : 'transparent',
              color: active ? 'var(--color-on-accent)' : 'var(--color-text)',
            }}
          >
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
