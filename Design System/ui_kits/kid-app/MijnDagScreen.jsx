function Confetti({ burstKey }) {
  if (!burstKey) return null;
  const pieces = Array.from({ length: 14 });
  const colors = ['var(--kid-coral)', 'var(--kid-turquoise)', 'var(--kid-yellow)'];
  return (
    <div key={burstKey} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
      {pieces.map((_, i) => (
        <span key={i} style={{
          position: 'absolute', left: '50%', top: '30%', width: 8, height: 8, background: colors[i % 3],
          borderRadius: i % 2 ? '50%' : 2, animation: `th-confetti-${i % 4} 700ms ease-out forwards`,
        }} />
      ))}
      <style>{`
        @keyframes th-confetti-0{to{transform:translate(-90px,120px) rotate(180deg);opacity:0}}
        @keyframes th-confetti-1{to{transform:translate(70px,140px) rotate(-160deg);opacity:0}}
        @keyframes th-confetti-2{to{transform:translate(-40px,160px) rotate(220deg);opacity:0}}
        @keyframes th-confetti-3{to{transform:translate(100px,90px) rotate(140deg);opacity:0}}
      `}</style>
    </div>
  );
}
function MijnDagScreen() {
  const { TaskCard, PointsBadge, StreakBadge, AvatarBadge } = window.TaakHeldenDesignSystem_73e756;
  const [tasks, setTasks] = React.useState([
    { id: 1, icon: '🧹', title: 'Kamer opruimen', points: 10, done: false },
    { id: 2, icon: '📚', title: 'Frans leren (15 min)', points: 15, done: true },
    { id: 3, icon: '🐕', title: 'Hond eten geven', points: 5, done: false },
  ]);
  const [burst, setBurst] = React.useState(0);
  function toggle(id) {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, done: !t.done } : t));
    const t = tasks.find((x) => x.id === id);
    if (t && !t.done) setBurst((b) => b + 1);
  }
  return (
    <div style={{ background: 'var(--kid-cream)', minHeight: '100%', padding: '16px 16px 90px', fontFamily: 'var(--font-rounded)' }}>
      <Confetti burstKey={burst} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <AvatarBadge emoji="🦊" level={4} size={56} />
        <div style={{ flex: 1 }} />
        <PointsBadge points={380} />
        <StreakBadge days={12} />
      </div>
      <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: 'var(--kid-text)', marginBottom: 12 }}>Mijn Dag</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tasks.map((t) => <TaskCard key={t.id} icon={t.icon} title={t.title} points={t.points} done={t.done} onToggle={() => toggle(t.id)} />)}
      </div>
    </div>
  );
}
window.MijnDagScreen = MijnDagScreen;
