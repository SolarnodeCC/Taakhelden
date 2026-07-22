// Server-only: the browser never calls the Worker directly (BFF proxy).
// Defaults to the local wrangler dev port.
export const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:8787/v1";
