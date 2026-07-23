function InsightsScreen() {
  const { Card, ProgressBar } = window.TaakHeldenDesignSystem_73e756;
  return (
    <section style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: 0 }}>Inzichten</h1>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>Als hulp voor het gesprek — nooit als controlemiddel.</p>
      <Card style={{ marginTop: 16 }}>
        <ProgressBar value={82} max={100} label="Sam — taken afgerond deze week (82%)" />
        <div style={{ height: 12 }} />
        <ProgressBar value={95} max={100} label="Noor — taken afgerond deze week (95%)" />
      </Card>
    </section>
  );
}
window.InsightsScreen = InsightsScreen;
