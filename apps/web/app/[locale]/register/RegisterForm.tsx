"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { RegisterBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { Link, useRouter } from "../../../i18n/navigation";
import { Field, Input, Alert, Button } from "../../../components/ui";
import Turnstile from "../../../components/Turnstile";

const KNOWN_ERRORS: ErrorCode[] = [
  ErrorCodes.EMAIL_IN_USE,
  ErrorCodes.RATE_LIMITED,
  ErrorCodes.VALIDATION_FAILED,
];

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function RegisterForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onToken = useCallback((token: string) => setTurnstileToken(token), []);
  const onTurnstileError = useCallback(() => {
    setTurnstileToken("");
    setError(t("register.turnstileError"));
  }, [t]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const token = TURNSTILE_SITE_KEY ? turnstileToken : turnstileToken || "dev-bypass";
    if (TURNSTILE_SITE_KEY && !token) {
      setError(t("register.turnstileError"));
      return;
    }

    const parsed = RegisterBody.safeParse({
      email,
      password,
      familyName,
      displayName,
      turnstileToken: token,
    });
    if (!parsed.success) {
      setError(t("register.errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post("/api/auth/register", parsed.data);
      router.push("/gezin?onboarding=1");
      router.refresh();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      const key = code && KNOWN_ERRORS.includes(code) ? code : "generic";
      setError(t(`register.errors.${key}`));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <Field label={t("register.displayName")}>
        <Input
          name="displayName"
          autoComplete="name"
          required
          maxLength={30}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>
      <Field label={t("register.familyName")}>
        <Input
          name="familyName"
          autoComplete="organization"
          required
          maxLength={50}
          value={familyName}
          onChange={(e) => setFamilyName(e.target.value)}
        />
      </Field>
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
          autoComplete="new-password"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="mt-1 text-xs font-normal text-muted">{t("register.passwordHint")}</span>
      </Field>

      <Turnstile onToken={onToken} onError={onTurnstileError} />

      {error && <Alert tone="danger">{error}</Alert>}

      <Button
        type="submit"
        disabled={busy || (Boolean(TURNSTILE_SITE_KEY) && !turnstileToken)}
        className="mt-1"
      >
        {busy ? t("register.submitting") : t("register.submit")}
      </Button>

      <p className="text-center text-sm text-muted">
        {t("register.hasAccount")}{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          {t("register.loginLink")}
        </Link>
      </p>
    </form>
  );
}
