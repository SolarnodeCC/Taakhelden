"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AccountDeleteBody } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { pollExportJob } from "../../../../lib/privacy/exportPoll";
import { useRouter } from "../../../../i18n/navigation";
import { Alert, Button, Card, Field, Input } from "../../../../components/ui";

export default function PrivacySection() {
  const t = useTranslations("instellingen.privacy");
  const router = useRouter();

  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function startExport() {
    setExportBusy(true);
    setExportError(null);
    setDownloadUrl(null);
    try {
      const started = await apiClient.post<{ exportId: string; status: string }>(
        "/api/v1/account/export",
      );
      const job = await pollExportJob(started.exportId);
      if (job.status === "ready" && job.downloadUrl) {
        setDownloadUrl(job.downloadUrl);
      } else {
        setExportError(t("exportFailed"));
      }
    } catch {
      setExportError(t("exportFailed"));
    } finally {
      setExportBusy(false);
    }
  }

  async function deleteFamily(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    if (!confirmDelete) {
      setDeleteError(t("confirmRequired"));
      return;
    }

    const body = { password };
    const parsed = AccountDeleteBody.safeParse(body);
    if (!parsed.success) {
      setDeleteError(t("passwordRequired"));
      return;
    }

    setDeleteBusy(true);
    try {
      const result = await apiClient.delete<{ deletedAt: string; purgeAfter: string }>(
        "/api/v1/account",
        parsed.data,
      );
      await apiClient.post("/api/auth/logout");
      const purge = encodeURIComponent(result.purgeAfter);
      router.push(`/login?deleted=1&purgeAfter=${purge}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "INVALID_CREDENTIALS") {
        setDeleteError(t("wrongPassword"));
      } else if (err instanceof ApiClientError && err.status === 403) {
        setDeleteError(t("errorForbidden"));
      } else {
        setDeleteError(t("deleteFailed"));
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section aria-labelledby="privacy-heading" className="flex flex-col gap-8">
      <div>
        <h2 id="privacy-heading" className="text-base font-semibold text-text">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("hint")}</p>

        <Card variant="row" className="mt-4">
          <h3 className="text-sm font-semibold text-text">{t("exportTitle")}</h3>
          <p className="mt-1 text-sm text-muted">{t("exportHint")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" disabled={exportBusy} onClick={() => void startExport()}>
              {exportBusy ? t("exportWorking") : t("exportStart")}
            </Button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                className="text-sm font-medium text-accent hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("exportDownload")}
              </a>
            )}
          </div>
          {exportError && (
            <div className="mt-3">
              <Alert tone="danger">{exportError}</Alert>
            </div>
          )}
          {downloadUrl && (
            <p className="mt-2 text-xs text-muted">{t("exportLinkExpiry")}</p>
          )}
        </Card>
      </div>

      <Card variant="tinted-danger">
        <h3 className="text-sm font-semibold text-text">{t("deleteTitle")}</h3>
        <p className="mt-1 text-sm text-muted">{t("deleteHint")}</p>

        <form onSubmit={deleteFamily} className="mt-4 flex flex-col gap-4">
          <label className="flex items-start gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="mt-1"
            />
            <span>{t("deleteConfirm")}</span>
          </label>

          <Field label={t("password")}>
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>

          {deleteError && <Alert tone="danger">{deleteError}</Alert>}

          <div>
            <Button type="submit" variant="danger" disabled={deleteBusy}>
              {deleteBusy ? t("deleteWorking") : t("deleteSubmit")}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
