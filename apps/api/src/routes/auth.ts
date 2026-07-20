import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator"; // TODO: dep toevoegen bij npm install
import { RegisterBody, LoginBody, FamilyCodeBody, ChildSessionBody } from "@taakhelden/shared";
import type { AppBindings } from "../types";

const auth = new Hono<AppBindings>();

// TODO(iteratie 1): implementaties — zie docs/taakhelden-api-specificatie.md §3.1
auth.post("/register", zValidator("json", RegisterBody), async (c) => {
  // 1. Turnstile verifiëren  2. e-mail uniek?  3. family + parent in één D1-batch
  // 4. token pair teruggeven
  return c.json({ todo: "register" }, 501);
});

auth.post("/login", zValidator("json", LoginBody), async (c) => c.json({ todo: "login" }, 501));
auth.post("/apple", async (c) => c.json({ todo: "sign in with apple" }, 501));
auth.post("/refresh", async (c) => c.json({ todo: "refresh + rotatie" }, 501));

auth.post("/family-code", zValidator("json", FamilyCodeBody), async (c) =>
  c.json({ todo: "kindprofielen bij gezinscode" }, 501),
);
auth.post("/child-session", zValidator("json", ChildSessionBody), async (c) =>
  c.json({ todo: "pincode-check (argon2) + kind-JWT 24u + lock na 5 fouten" }, 501),
);

export default auth;
