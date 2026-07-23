function LoginScreen({ onLogin }) {
  const { Button, Field, Input, Alert } = window.TaakHeldenDesignSystem_73e756;
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  function submit(e) {
    e.preventDefault();
    if (!email || !password) { setError('Vul een geldig e-mailadres en wachtwoord in.'); return; }
    setError(null);
    onLogin();
  }
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', fontFamily: 'var(--font-sans)' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <main style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--color-accent)', marginBottom: 20 }} />
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-accent)', margin: 0 }}>TaakHelden</h1>
          <p style={{ marginTop: 4, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>Log in om het dashboard van je gezin te bekijken.</p>
          <form onSubmit={submit} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="E-mailadres"><Input type="email" placeholder="jij@gezin.nl" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Wachtwoord"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button variant="primary" style={{ marginTop: 4 }} onClick={submit}>Inloggen</Button>
          </form>
        </main>
      </div>
      <div style={{ flex: 1, background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', maxWidth: 280 }}>
          <div style={{ fontSize: 48 }}>🏆</div>
          <p style={{ margin: 0 }}>Overzicht van taken, punten en goedkeuringen — voor het hele gezin.</p>
        </div>
      </div>
    </div>
  );
}
window.LoginScreen = LoginScreen;
