function ShopScreen() {
  const { Card, Button, Badge } = window.TaakHeldenDesignSystem_73e756;
  const rewards = [
    { icon: '🎬', title: 'Film uitkiezen', price: 150 },
    { icon: '⏰', title: '30 min extra schermtijd', price: 100 },
    { icon: '🏊', title: 'Uitje naar het zwembad', price: 500 },
  ];
  return (
    <section style={{ maxWidth: 640, fontFamily: 'var(--font-sans)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)', margin: 0 }}>Winkel</h1>
        <Button size="sm" variant="primary">+ Nieuwe beloning</Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {rewards.map((r) => (
          <Card key={r.title} padded={false}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <span style={{ fontSize: 20 }}>{r.icon}</span>
              <div style={{ flex: 1, fontWeight: 'var(--weight-medium)', color: 'var(--color-text)' }}>{r.title}</div>
              <Badge tone="neutral">{r.price} pt</Badge>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
window.ShopScreen = ShopScreen;
