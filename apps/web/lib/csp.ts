/**
 * Content-Security-Policy met een per-request nonce.
 *
 * De CSP stond statisch in `next.config.mjs` met `script-src 'unsafe-inline'`.
 * Juist die directive is wat CSP tot een XSS-mitigatie maakt in plaats van een
 * formaliteit: mét `'unsafe-inline'` draait een geïnjecteerd `<script>` gewoon.
 * Een nonce kan niet statisch zijn, dus de header hoort in middleware.
 *
 * Next injecteert zelf inline bootstrap-scripts (de RSC-payload). Next leest de
 * nonce uit de `content-security-policy`-request-header die we hieronder
 * meegeven en zet die op zijn eigen scripts; `'strict-dynamic'` laat die
 * scripts vervolgens hun eigen chunks laden.
 *
 * Pure function, geen Next-imports: zo blijft hij testbaar zonder de
 * `next/server` / `next-intl` runtime te laden (zie `middleware.test.ts`).
 * `script-src` mag nooit een third-party AI-widget toestaan (WS-AI-WEBPOLICY,
 * ADR-0006 R6) — dat is precies wat die test bewaakt.
 */
export function buildCsp(nonce: string): string {
  // Alleen de API-origin toestaan i.p.v. `https:` / `wss:` breed. Ontbreekt de
  // var (lokale `next dev`), houd dan de ruimere waarde aan — liever iets minder
  // strak dan foto's en realtime breken.
  const apiBase = process.env["API_BASE_URL"];
  let apiHttp = "https:";
  let apiWs = "wss:";
  if (apiBase) {
    try {
      const { origin, host } = new URL(apiBase);
      apiHttp = origin;
      apiWs = `wss://${host}`;
    } catch {
      // Onbruikbare waarde — houd de ruimere fallback aan.
    }
  }

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://challenges.cloudflare.com`,
    // Tailwind en Next zetten style-attributen; die hashen is hier nog niet
    // haalbaar. Inline CSS is een aanzienlijk kleiner risico dan inline JS.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${apiHttp}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiHttp} ${apiWs}`,
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
