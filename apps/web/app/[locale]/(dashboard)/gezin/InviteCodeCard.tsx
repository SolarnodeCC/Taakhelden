"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button } from "../../../../components/ui";

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
  const [copied, setCopied] = useState(false);

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
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; code remains visible for manual copy.
    }
  }

  return (
    <section
      ref={onCodeMount}
      className="rounded-lg border border-border bg-surface p-5"
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
              {copied ? t("invite.copied") : t("invite.copy")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={regenerating}
              onClick={() => {
                if (window.confirm(t("invite.regenerateConfirm"))) {
                  onRegenerate();
                }
              }}
            >
              {regenerating ? t("invite.regenerating") : t("invite.regenerate")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
