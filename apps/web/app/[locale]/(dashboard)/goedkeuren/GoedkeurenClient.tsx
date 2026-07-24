"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { ParentTodayView, PhotoView, type InstanceView } from "../../../../lib/api/types";
import { useRouter } from "../../../../i18n/navigation";
import { Button } from "../../../../components/ui";

// A submitted task plus the child it belongs to — the unit of the approval queue.
interface QueueItem extends InstanceView {
  childName: string;
}

function toQueue(view: ParentTodayView): QueueItem[] {
  return view.children.flatMap((child) =>
    child.instances
      .filter((inst) => inst.status === "submitted")
      .map((inst) => ({ ...inst, childName: child.displayName })),
  );
}

function PhotoThumb({ photoId }: { photoId: string }) {
  const t = useTranslations("goedkeuren");
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await apiClient.get(`/api/v1/photos/${photoId}`);
        const photo = PhotoView.parse(raw);
        if (active) {
          if (photo.status === "ready" && photo.url) setUrl(photo.url);
          else setFailed(true);
        }
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [photoId]);

  if (failed) return <p className="text-xs text-muted">{t("photoUnavailable")}</p>;
  if (!url) return <div className="h-40 w-full animate-pulse rounded bg-border/40" />;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived R2 URL; not a static asset
    <img
      src={url}
      alt={t("photoAlt")}
      className="max-h-64 w-full rounded object-cover"
    />
  );
}

function QueueCard({ item, onResolve }: { item: QueueItem; onResolve: (id: string) => void }) {
  const t = useTranslations("goedkeuren");
  const [busy, setBusy] = useState(false);
  const [redoOpen, setRedoOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/instances/${item.id}/approve`);
      onResolve(item.id);
    } catch {
      setError(t("actionError"));
      setBusy(false);
    }
  }

  async function submitRedo(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/api/v1/instances/${item.id}/redo`, { note: note.trim() });
      onResolve(item.id);
    } catch {
      setError(t("actionError"));
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        {item.icon && <span aria-hidden>{item.icon}</span>}
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text">{item.title}</h2>
        {typeof item.points === "number" && (
          <span className="text-sm font-medium text-muted">{t("points", { points: item.points })}</span>
        )}
      </div>
      <p className="mt-0.5 text-sm text-muted">{t("submittedBy", { name: item.childName })}</p>

      {item.photoId && (
        <div className="mt-3">
          <PhotoThumb photoId={item.photoId} />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}

      {!redoOpen ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={approve} disabled={busy}>
            {t("approve")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRedoOpen(true)}
            disabled={busy}
          >
            {t("redo")}
          </Button>
        </div>
      ) : (
        <form onSubmit={submitRedo} className="mt-3 flex flex-col gap-2">
          <label className="text-sm font-medium text-text">
            {t("redoLabel")}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
              maxLength={200}
              rows={2}
              placeholder={t("redoPlaceholder")}
              className="mt-1 w-full rounded border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || note.trim().length === 0}>
              {t("redoSubmit")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRedoOpen(false);
                setNote("");
                setError(null);
              }}
              disabled={busy}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function GoedkeurenClient() {
  const t = useTranslations("goedkeuren");
  const router = useRouter();
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const raw = await apiClient.get("/api/v1/instances/today");
        const view = ParentTodayView.parse(raw);
        if (active) setQueue(toQueue(view));
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  const resolve = useCallback((id: string) => {
    setQueue((prev) => (prev ? prev.filter((item) => item.id !== id) : prev));
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-text">{t("title")}</h1>

      {failed && <p className="mt-4 text-sm text-danger">{t("loadError")}</p>}

      {!failed && queue === null && <p className="mt-4 text-sm text-muted">{t("loading")}</p>}

      {queue !== null && queue.length === 0 && (
        <p className="mt-4 text-sm text-muted">{t("empty")}</p>
      )}

      {queue !== null && queue.length > 0 && (
        <div className="mt-4 flex flex-col gap-4">
          {queue.map((item) => (
            <QueueCard key={item.id} item={item} onResolve={resolve} />
          ))}
        </div>
      )}
    </div>
  );
}
