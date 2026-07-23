function AppShell({ active, onNavigate, children }) {
  const { SidebarNav } = window.TaakHeldenDesignSystem_73e756;
  const items = [
    { key: 'vandaag', label: 'Vandaag' },
    { key: 'goedkeuren', label: 'Goedkeuren' },
    { key: 'taken', label: 'Taken' },
    { key: 'winkel', label: 'Winkel' },
    { key: 'inzichten', label: 'Inzichten' },
  ];
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'var(--font-sans)' }}>
      <aside style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
        <div style={{ padding: '20px 20px', fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-accent)' }}>TaakHelden</div>
        <SidebarNav items={items} activeKey={active} onNavigate={onNavigate} />
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, borderBottom: '1px solid var(--color-border)', padding: '16px 24px' }}>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>Familie Bakker</p>
            <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Hoi Merel</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', fontSize: 'var(--text-xs)' }}><option>NL</option><option>EN</option></select>
            <button style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 12px', fontSize: 'var(--text-sm)', background: 'var(--color-bg)', cursor: 'pointer' }}>Uitloggen</button>
          </div>
        </header>
        <main style={{ flex: 1, padding: '32px 24px' }}>{children}</main>
      </div>
    </div>
  );
}
window.AppShell = AppShell;
