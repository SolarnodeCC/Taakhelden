/**
 * Sign in with Apple — de JWKS-verificatie zelf vergt Apples endpoint; hier
 * testen we het contract eromheen: validatie en afwijzing van ongeldige tokens.
 */
import { describe, it, expect } from "vitest";
import { api } from "./helpers";

describe("POST /auth/apple", () => {
  it("ongeldig identityToken → 401 INVALID_CREDENTIALS", async () => {
    const res = await api("/auth/apple", { body: { identityToken: "geen-echt-token" } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("ontbrekend identityToken → 400 VALIDATION_FAILED", async () => {
    const res = await api("/auth/apple", { body: {} });
    expect(res.status).toBe(400);
  });
});
