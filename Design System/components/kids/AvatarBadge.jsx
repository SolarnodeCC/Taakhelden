import React from 'react';

const tones = {
  kid: { bg: 'var(--kid-turquoise-soft)', ring: 'var(--kid-turquoise)', badge: 'var(--kid-coral)' },
  teen: { bg: 'var(--teen-navy-surface)', ring: 'var(--teen-mint)', badge: 'var(--teen-mint)' },
};

export function AvatarBadge({ emoji = '🦊', level, size = 64, tone = 'kid' }) {
  const c = tones[tone] || tones.kid;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div style={{
        width: size, height: size, borderRadius: 'var(--radius-full)', background: c.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.5,
        border: `2px solid ${c.ring}`,
      }}>{emoji}</div>
      {level != null && (
        <div style={{
          position: 'absolute', bottom: -4, right: -4, background: c.badge, color: tone === 'teen' ? 'var(--teen-navy)' : '#fff',
          borderRadius: 'var(--radius-full)', width: '1.5rem', height: '1.5rem', fontSize: 'var(--text-xs)',
          fontWeight: 'var(--weight-bold)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #fff', fontFamily: tone === 'teen' ? 'var(--font-sans)' : 'var(--font-rounded)',
        }}>{level}</div>
      )}
    </div>
  );
}
