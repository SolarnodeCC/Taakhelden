"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { useRouter } from "../../../i18n/navigation";

// Server-round-trip errors we surface with tailored copy; anything else (incl.
// 5xx/network with no code) falls back to the generic message. Bad input is
// caught client-side below before we ever call the server.
const KNOWN_ERRORS: ErrorCode[] = [
  ErrorCodes.INVALID_CREDENTIALS,
  ErrorCodes.RATE_LIMITED,
];

export default function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = LoginBody.safeParse({ email, password });
    if (!parsed.success) {
      setError(t("errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post("/api/auth/login", parsed.data);
      router.push("/");
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      const key = code && KNOWN_ERRORS.includes(code) ? code : "generic";
      setError(t(`errors.${key}`));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" }}>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {t("email")}
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: "0.5rem" }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
        {t("password")}
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: "0.5rem" }}
        />
      </label>

      {error && (
        <p role="alert" style={{ color: "#b00020", margin: 0 }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} style={{ padding: "0.6rem", marginTop: "0.5rem" }}>
        {busy ? t("submitting") : t("submit")}
      </button>
    </form>
  );
}
