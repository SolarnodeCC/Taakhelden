"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button, Card, ConfirmDelete } from "../../../../components/ui";

export default function InviteCodeCard({
  inviteCode,
  regenerating,
  onRegenerate,
  onCodeMount,
}: {
  inviteCode: string;
  regenerating: boolean;
  onRegenerate: () => void;
  onCodeMount?: (el: HTMLElement | null) => void;
}) {
  const t = useTranslations("gezin");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => {
    let active = true;
    // QR scanners need high-contrast modules; black on white is intentional
    // (barcode pixels, not UI chrome — design tokens don't apply here).
    QRCode.toDataURL(inviteCode, {
      width: 160,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [inviteCode]);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopyState("ok");
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Insecure context, denied permission, or an older browser. The code stays
      // on screen for manual copying — but say so, rather than appearing to do
      // nothing on the one step that gets a child's device paired.
      setCopyState("fail");
    }
  }

  return (
    <Card
      as="section"
      variant="panel"
      ref={onCodeMount}
      aria-labelledby="invite-code-heading"
    >
      <h2 id="invite-code-heading" className="text-base font-semibold text-text">
        {t("invite.title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("invite.hint")}</p>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {qrDataUrl ? (
          <Image
            src={qrDataUrl}
            alt=""
            width={160}
            height={160}
            unoptimized
            className="rounded border border-border bg-bg"
            aria-hidden
          />
        ) : null}
        <div>
          <p
            className="font-mono text-3xl font-semibold tracking-widest text-text"
            aria-label={t("invite.codeAria", { code: inviteCode })}
          >
            {inviteCode}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={copyCode}>
              {copyState === "ok" ? t("invite.copied") : t("invite.copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={regenerating}
              onClick={() => setConfirmRegen(true)}
            >
              {regenerating ? t("invite.regenerating") : t("invite.regenerate")}
            </Button>
          </div>
          {/* Success is a label swap, which assistive tech never hears — mirror
              both outcomes into a live region. */}
          <p role="status" className="sr-only">
            {copyState === "ok"
              ? t("invite.copied")
              : copyState === "fail"
                ? t("invite.copyManual")
                : ""}
          </p>
          {copyState === "fail" && (
            <p className="mt-2 text-sm text-muted">{t("invite.copyManual")}</p>
          )}
        </div>
      </div>

      {confirmRegen && (
        <div className="mt-4">
          <ConfirmDelete
            question={t("invite.regenerateConfirm")}
            confirmLabel={t("invite.regenerate")}
            busy={regenerating}
            onConfirm={() => {
              setConfirmRegen(false);
              onRegenerate();
            }}
            onCancel={() => setConfirmRegen(false)}
          />
        </div>
      )}
    </Card>
  );
}
