"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ResetPasswordBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { useRouter } from "../../../i18n/navigation";
import { Field, Input, Alert, Button } from "../../../components/ui";

const KNOWN_ERRORS: ErrorCode[] = [ErrorCodes.VALIDATION_FAILED, ErrorCodes.RATE_LIMITED];

export default function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="danger">{t("missingToken")}</Alert>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/wachtwoord-vergeten")}
        >
          {t("requestNewLink")}
        </Button>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError(t("errors.passwordMismatch"));
      return;
    }

    const parsed = ResetPasswordBody.safeParse({ token, password });
    if (!parsed.success) {
      setError(t("errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post("/api/auth/reset-password", parsed.data);
      router.push("/login?reset=1");
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      const key = code && KNOWN_ERRORS.includes(code) ? code : "generic";
      setError(t(`errors.${key}`));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label={t("password")}>
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Field label={t("confirmPassword")}>
        <Input
          type="password"
          name="confirmPassword"
          autoComplete="new-password"
          required
          minLength={10}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" disabled={busy} className="mt-1">
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
