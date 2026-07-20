/**
 * Placeholder — het echte dashboard (Vandaag / Goedkeuren / Taken / Winkel / Inzichten)
 * wordt gebouwd zodra de API-auth staat. De visuele richting krijgt dan een eigen
 * design-pass (tokens, typografie) conform het productvoorstel §4.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: 640 }}>
      <h1>TaakHelden</h1>
      <p>Ouderdashboard — in aanbouw. API: {process.env.NEXT_PUBLIC_API_URL}</p>
    </main>
  );
}
