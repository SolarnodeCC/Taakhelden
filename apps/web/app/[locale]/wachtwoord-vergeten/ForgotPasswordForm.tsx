"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ForgotPasswordBody } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { Field, Input, Alert, Button } from "../../../components/ui";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = ForgotPasswordBody.safeParse({ email });
    if (!parsed.success) {
      setError(t("errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post("/api/auth/forgot-password", parsed.data);
      setSubmitted(true);
    } catch (err) {
      const isRateLimited =
        err instanceof ApiClientError && err.status === 429;
      setError(isRateLimited ? t("errors.RATE_LIMITED") : t("errors.generic"));
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <Alert tone="success">
        {t("successMessage")}
      </Alert>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" disabled={busy} className="mt-1">
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
