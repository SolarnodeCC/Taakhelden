/**
 * Fundament van de authz-testsuite (CI verplicht):
 * elke route moet cross-family toegang en rol-overschrijding weigeren.
 */
import { describe, it, expect } from "vitest";

describe("authz-fundament", () => {
  it.todo("kind kan geen taken van een ander kind afvinken (403)");
  it.todo("kind kan geen taakdefinities aanmaken (403)");
  it.todo("ouder uit gezin A kan niets van gezin B lezen (404/403)");
  it.todo("approve_only-ouder kan geen instellingen wijzigen (403)");
  it.todo("verlopen JWT geeft 401 met UNAUTHORIZED-code");
});
