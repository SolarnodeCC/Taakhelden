function TodaySkeletonRow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0' }}>
      <div style={{ width: 80, height: 14, borderRadius: 4, background: 'var(--color-surface)' }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ width: 56, height: 20, borderRadius: 999, background: 'var(--color-surface)' }} />
        <div style={{ width: 56, height: 20, borderRadius: 999, background: 'var(--color-surface)' }} />
      </div>
    </div>
  );
}
function TodayScreen() {
  const { Card, Badge } = window.TaakHeldenDesignSystem_73e756;
  const kids = [
    { name: 'Sam', open: 2, done: 3, waiting: 1 },
    { name: 'Noor', open: 0, done: 5, waiting: 0 },
  ];
  return (
    <section style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: 0 }}>Vandaag</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {kids.map((k) => (
          <Card key={k.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--color-text)' }}>{k.name}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                {k.open === 0 && k.waiting === 0 ? (
                  <Badge tone="success">Alle taken af! 🎉</Badge>
                ) : (
                  <React.Fragment>
                    <Badge tone="neutral">{k.open} open</Badge>
                    <Badge tone="success">{k.done} af</Badge>
                    {k.waiting > 0 && <Badge tone="accent">{k.waiting} wacht op goedkeuring</Badge>}
                  </React.Fragment>
                )}
              </div>
            </div>
          </Card>
        ))}
        <Card>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>Laden…</div>
          <TodaySkeletonRow />
        </Card>
      </div>
    </section>
  );
}
window.TodayScreen = TodayScreen;
