function TeenModeScreen() {
  const { TaskCard, PointsBadge, StreakBadge, AvatarBadge } = window.TaakHeldenDesignSystem_73e756;
  const tasks = [
    { id: 1, icon: '🍳', title: 'Koken helpen', points: 20, done: false },
    { id: 2, icon: '🧺', title: 'Was draaien', points: 15, done: true },
    { id: 3, icon: '📖', title: 'Huiswerkagenda bijwerken', points: 10, done: false },
  ];
  return (
    <div style={{ background: 'var(--teen-navy)', minHeight: '100%', padding: '16px 16px 90px', fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <AvatarBadge emoji="🧑🏻" level={8} size={56} tone="teen" />
        <div style={{ flex: 1 }} />
        <span style={{ background: 'var(--teen-navy-surface)', color: 'var(--teen-mint)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>380 punten</span>
        <span style={{ background: 'var(--teen-navy-surface)', color: 'var(--teen-muted)', borderRadius: 999, padding: '4px 12px', fontSize: 13, fontWeight: 600 }}>12 dagen op rij</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--teen-text)', marginBottom: 12 }}>Mijn Dag</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: t.done ? 'var(--teen-navy-surface)' : 'var(--teen-navy-surface)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 20, opacity: 0.8 }}>{t.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: 'var(--teen-text)', fontWeight: 600, fontSize: 15, textDecoration: t.done ? 'line-through' : 'none' }}>{t.title}</div>
              <div style={{ color: 'var(--teen-mint)', fontSize: 13, fontWeight: 600 }}>+{t.points} punten</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: t.done ? 'none' : '2px solid var(--teen-muted)', background: t.done ? 'var(--teen-mint)' : 'transparent', color: t.done ? 'var(--teen-navy)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>✓</div>
          </div>
        ))}
      </div>
    </div>
  );
}
window.TeenModeScreen = TeenModeScreen;
