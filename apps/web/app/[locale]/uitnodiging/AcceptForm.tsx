"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ParentAcceptBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../lib/api/client";
import { Link, useRouter } from "../../../i18n/navigation";
import { Alert, Button, Field, Input } from "../../../components/ui";

const KNOWN_ERRORS: ErrorCode[] = [ErrorCodes.INVALID_INVITE, ErrorCodes.VALIDATION_FAILED];

export default function AcceptForm() {
  const t = useTranslations("auth.accept");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!token) {
    return (
      <div className="mt-6">
        <Alert tone="danger">{t("missingToken")}</Alert>
        <p className="mt-4 text-center text-sm text-muted">
          <Link href="/login" className="font-medium text-accent hover:underline">
            {t("loginLink")}
          </Link>
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = ParentAcceptBody.safeParse({
      token,
      password,
      displayName: displayName.trim() || undefined,
    });
    if (!parsed.success) {
      setError(t("errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.post("/api/auth/accept-parent", parsed.data);
      router.push("/vandaag");
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
      <Field label={t("displayName")}>
        <Input
          name="displayName"
          autoComplete="nickname"
          maxLength={30}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <span className="mt-1 text-xs font-normal text-muted">{t("displayNameHint")}</span>
      </Field>
      <Field label={t("password")}>
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <span className="mt-1 text-xs font-normal text-muted">{t("passwordHint")}</span>
      </Field>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" disabled={busy} className="mt-1">
        {busy ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
