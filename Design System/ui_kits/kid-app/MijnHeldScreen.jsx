function MijnHeldScreen() {
  const { AvatarBadge, Badge } = window.TaakHeldenDesignSystem_73e756;
  const badges = ['Eerste week vol!', '10 foto\'s gemaakt', 'Huiswerkkampioen'];
  return (
    <div style={{ background: 'var(--kid-cream)', minHeight: '100%', padding: '16px 16px 90px', fontFamily: 'var(--font-rounded)', textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--kid-text)', marginBottom: 16 }}>Mijn Held</div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
        <AvatarBadge emoji="🦊" level={4} size={96} />
      </div>
      <div style={{ color: 'var(--kid-turquoise)', fontWeight: 'var(--weight-semibold)', marginBottom: 20 }}>Level 4 — TaakHeld</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        {badges.map((b) => <Badge key={b} tone="accent">🏅 {b}</Badge>)}
      </div>
    </div>
  );
}
window.MijnHeldScreen = MijnHeldScreen;
