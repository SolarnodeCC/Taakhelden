function WinkelScreen() {
  const { RewardCard, PointsBadge, ProgressBar } = window.TaakHeldenDesignSystem_73e756;
  const rewards = [
    { icon: '🎬', title: 'Film uitkiezen', price: 150, affordable: true },
    { icon: '⏰', title: 'Extra schermtijd', price: 100, affordable: true },
    { icon: '🏊', title: 'Zwembad', price: 500, affordable: false },
    { icon: '🍕', title: 'Pizza-avond', price: 500, affordable: false },
  ];
  return (
    <div style={{ background: 'var(--kid-cream)', minHeight: '100%', padding: '16px 16px 90px', fontFamily: 'var(--font-rounded)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--kid-text)' }}>Winkel</div>
        <PointsBadge points={380} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <ProgressBar value={380} max={500} tone="kid" label="Nog 120 punten tot het zwembad!" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {rewards.map((r) => <RewardCard key={r.title} {...r} />)}
      </div>
    </div>
  );
}
window.WinkelScreen = WinkelScreen;
