"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoginBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { useRouter } from "../../../i18n/navigation";
import { Field, Input, Alert, Button } from "../../../components/ui";

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
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field label={t("email")}>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label={t("password")}>
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" disabled={busy} className="mt-1">
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
