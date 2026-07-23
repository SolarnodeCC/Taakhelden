function ApprovalsScreen() {
  const { Card, Badge, Button } = window.TaakHeldenDesignSystem_73e756;
  const [items, setItems] = React.useState([
    { id: 1, child: 'Sam', task: 'Vaatwasser uitruimen', points: 15, photo: true },
    { id: 2, child: 'Noor', task: 'Huiswerk Frans', points: 20, photo: false },
  ]);
  function resolve(id) { setItems((its) => its.filter((i) => i.id !== id)); }
  return (
    <section style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: 0 }}>Goedkeuren</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {items.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Alles is bijgewerkt — niets wacht op goedkeuring.</p>}
        {items.map((i) => (
          <Card key={i.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 'var(--weight-medium)', color: 'var(--color-text)' }}>{i.child} — {i.task}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>+{i.points} punten{i.photo ? ' · foto ingestuurd' : ''}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="sm" variant="secondary" onClick={() => resolve(i.id)}>Opnieuw</Button>
                <Button size="sm" variant="primary" onClick={() => resolve(i.id)}>Goedkeuren</Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
window.ApprovalsScreen = ApprovalsScreen;
