import React from 'react';

const sizes = { sm: { padding: '0.375rem 0.75rem', fontSize: 'var(--text-sm)' }, md: { padding: '0.5rem 1rem', fontSize: 'var(--text-sm)' }, lg: { padding: '0.75rem 1.5rem', fontSize: 'var(--text-base)' } };

function variantStyle(variant) {
  switch (variant) {
    case 'secondary': return { background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)' };
    case 'ghost': return { background: 'transparent', color: 'var(--color-text)', border: '1px solid transparent' };
    case 'danger': return { background: 'var(--color-danger)', color: '#fff', border: '1px solid var(--color-danger)' };
    default: return { background: 'var(--color-accent)', color: 'var(--color-on-accent)', border: '1px solid var(--color-accent)' };
  }
}

export function Button({ variant = 'primary', size = 'md', disabled = false, icon = null, children, onClick, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const base = variantStyle(variant);
  const hoverBg = variant === 'primary' ? 'var(--color-accent-hover)' : variant === 'secondary' ? 'var(--color-surface)' : variant === 'ghost' ? 'var(--color-surface)' : base.background;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center',
        fontFamily: 'var(--font-sans)', fontWeight: 'var(--weight-semibold)', borderRadius: 'var(--radius)',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background var(--transition-fast), opacity var(--transition-fast)',
        opacity: disabled ? 0.6 : 1, ...sizes[size], ...base,
        background: hover && !disabled ? hoverBg : base.background, ...style,
      }}
      {...rest}
    >
      {icon}{children}
    </button>
  );
}
