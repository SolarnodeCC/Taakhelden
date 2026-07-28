import { ExportJobView } from "@taakhelden/shared";
import { apiClient } from "../api/client";

const DEFAULT_INTERVAL_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 60;

/** Poll an async AVG export job until ready, failed, or timeout (~2 min). */
export async function pollExportJob(
  exportId: string,
  opts?: { intervalMs?: number; maxAttempts?: number },
): Promise<ExportJobView> {
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const maxAttempts = opts?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const raw = await apiClient.get(`/api/v1/account/export/${exportId}`);
    const job = ExportJobView.parse(raw);
    if (job.status === "ready" || job.status === "failed") {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return ExportJobView.parse({ exportId, status: "failed" });
}
