function TasksScreen() {
  const { Card, Badge, Button } = window.TaakHeldenDesignSystem_73e756;
  const tasks = [
    { icon: '🧹', title: 'Kamer opruimen', freq: 'Dagelijks', points: 10 },
    { icon: '📚', title: 'Huiswerkplanning', freq: 'Weekdagen', points: 15 },
    { icon: '🍽️', title: 'Tafel afruimen', freq: 'Dagelijks', points: 5 },
  ];
  return (
    <section style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: 0 }}>Taken</h1>
        <Button size="sm" variant="primary">+ Nieuwe taak</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {tasks.map((t) => (
          <Card key={t.title} padded={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 20 }}>{t.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-text)' }}>{t.title}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{t.freq}</div>
              </div>
              <Badge tone="accent">+{t.points} pt</Badge>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
window.TasksScreen = TasksScreen;
