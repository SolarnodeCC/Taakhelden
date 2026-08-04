"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InviteParentBody, ErrorCodes, type ErrorCode } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { InviteParentResult, InviteLinkResponse } from "../../../../lib/api/types";
import { Alert, Button, Card, Field, Input } from "../../../../components/ui";

const KNOWN_ERRORS: ErrorCode[] = [
  ErrorCodes.EMAIL_IN_USE,
  ErrorCodes.VALIDATION_FAILED,
  ErrorCodes.FORBIDDEN,
];

interface InviteSuccess {
  /** userId is used to call the link endpoint on demand. */
  userId: string;
  emailLocal: string;
}

export default function InviteParentForm({ onInvited }: { onInvited: () => Promise<void> }) {
  const t = useTranslations("gezin.inviteParent");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<"approve_only" | "full">("approve_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<InviteSuccess | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCopied(false);
    setCopyError(false);

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
        userId: result.userId,
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

  /**
   * Fetch a fresh tokenised URL from the reveal endpoint (Option A — WS-TRUST-API).
   * The token is never stored in this component; it is only written to the clipboard.
   */
  async function copyLink() {
    if (!success || copyBusy) return;
    setCopyBusy(true);
    setCopied(false);
    setCopyError(false);
    try {
      const raw = await apiClient.get(
        `/api/v1/families/me/invites/${success.userId}/link`,
      );
      const link = InviteLinkResponse.parse(raw);
      await navigator.clipboard.writeText(link.copyableUrl);
      setCopied(true);
    } catch {
      setCopyError(true);
    } finally {
      setCopyBusy(false);
    }
  }

  return (
    <Card variant="row" className="mt-3">
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
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={copyLink}
              disabled={copyBusy}
            >
              {copyBusy ? t("copyLinkBusy") : copied ? t("copied") : t("copy")}
            </Button>
          </div>
          {copyError && (
            <p className="mt-2 text-xs text-danger" role="alert">
              {t("errors.copyLinkFailed")}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
