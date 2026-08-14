/**
 * Sign in with Apple — de koppelbeslissing (`decideAppleAccount`).
 *
 * De JWKS-verificatie zelf vergt Apples endpoint (zie `apple.test.ts` voor de
 * afwijzingskant). De beveiligingsbeslissing eromheen is bewust een pure
 * functie, zodat die hier uitputtend getest kan worden: mag dit Apple-account
 * aan een bestaand wachtwoord-account gekoppeld worden?
 *
 * Zonder de `email_verified`-eis was het aanmaken van een Apple ID op andermans
 * e-mailadres genoeg om diens gezin over te nemen zonder ooit het wachtwoord te
 * kennen.
 */
import { describe, it, expect } from "vitest";
import { decideAppleAccount } from "../src/services/apple";

const email = "ouder@apple.test.local";

describe("decideAppleAccount", () => {
  it("weigert koppelen aan een bestaand account op een onbevestigd adres", () => {
    expect(decideAppleAccount({ email, emailVerified: false }, true)).toEqual({ kind: "refuse" });
  });

  it("koppelt aan een bestaand account op een door Apple bevestigd adres", () => {
    expect(decideAppleAccount({ email, emailVerified: true }, true)).toEqual({ kind: "link" });
  });

  it("legt een onbevestigd adres niet vast op een nieuw account", () => {
    // Anders bezet een niet-bewezen adres de UNIQUE-index voor wie het wél kan bewijzen.
    expect(decideAppleAccount({ email, emailVerified: false }, false)).toEqual({
      kind: "create",
      email: null,
    });
  });

  it("legt een bevestigd adres wel vast op een nieuw account", () => {
    expect(decideAppleAccount({ email, emailVerified: true }, false)).toEqual({
      kind: "create",
      email,
    });
  });

  it("maakt zonder adres (private relay/herlogin) gewoon een account aan", () => {
    expect(decideAppleAccount({ email: null, emailVerified: false }, false)).toEqual({
      kind: "create",
      email: null,
    });
  });

  it("koppelt nooit wanneer er geen adres in het token zit", () => {
    // `hasAccountWithEmail` kan hier niet waar zijn, maar de functie mag ook dan
    // niet naar `link` afglijden.
    expect(decideAppleAccount({ email: null, emailVerified: true }, true)).toEqual({
      kind: "create",
      email: null,
    });
  });
});
