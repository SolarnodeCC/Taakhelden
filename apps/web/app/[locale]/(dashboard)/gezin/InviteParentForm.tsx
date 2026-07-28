"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { InviteParentBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { InviteParentResult } from "../../../../lib/api/types";
import { Alert, Button, Field, Input } from "../../../../components/ui";

const KNOWN_ERRORS: ErrorCode[] = [
  ErrorCodes.EMAIL_IN_USE,
  ErrorCodes.VALIDATION_FAILED,
  ErrorCodes.FORBIDDEN,
];

interface InviteSuccess {
  inviteToken: string;
  emailLocal: string;
}

export default function InviteParentForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const t = useTranslations("gezin.inviteParent");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<"approve_only" | "full">("approve_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCopied(false);

    const parsed = InviteParentBody.safeParse({ email, permissions });
    if (!parsed.success) {
      setError(t("errors.VALIDATION_FAILED"));
      return;
    }

    setBusy(true);
    try {
      const raw = await apiClient.post("/api/v1/families/me/parents", parsed.data);
      const result = InviteParentResult.parse(raw);
      // Never log email or token (architectuurregel 5).
      setSuccess({
        inviteToken: result.inviteToken,
        emailLocal: result.email.split("@")[0] ?? "",
      });
      setEmail("");
      setPermissions("approve_only");
      await onInvited();
    } catch (err) {
      const code = err instanceof ApiClientError ? err.code : null;
      const key = code && KNOWN_ERRORS.includes(code) ? code : "generic";
      setError(t(`errors.${key}`));
    } finally {
      setBusy(false);
    }
  }

  function inviteUrl(token: string): string {
    if (typeof window === "undefined") return `/${locale}/uitnodiging?token=${token}`;
    return `${window.location.origin}/${locale}/uitnodiging?token=${token}`;
  }

  async function copyLink() {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(inviteUrl(success.inviteToken));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold text-text">{t("title")}</h3>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3">
        <Field label={t("email")}>
          <Input
            type="email"
            name="inviteEmail"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-text">{t("permissionsLabel")}</legend>
          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="radio"
              name="permissions"
              value="approve_only"
              checked={permissions === "approve_only"}
              onChange={() => setPermissions("approve_only")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t("permissions.approve_only")}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted">
                {t("permissions.approve_onlyHint")}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="radio"
              name="permissions"
              value="full"
              checked={permissions === "full"}
              onChange={() => setPermissions("full")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">{t("permissions.full")}</span>
              <span className="mt-0.5 block text-xs font-normal text-muted">
                {t("permissions.fullHint")}
              </span>
            </span>
          </label>
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}

        <div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? t("submitting") : t("submit")}
          </Button>
        </div>
      </form>

      {success && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-3 py-3">
          <Alert tone="success">{t("success", { name: success.emailLocal })}</Alert>
          <p className="mt-3 text-sm text-muted">{t("shareHint")}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="block min-w-0 flex-1 truncate rounded-sm border border-border bg-bg px-2 py-1.5 text-xs text-text">
              {inviteUrl(success.inviteToken)}
            </code>
            <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
