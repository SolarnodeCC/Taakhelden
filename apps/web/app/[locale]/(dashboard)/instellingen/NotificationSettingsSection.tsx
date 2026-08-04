"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { NotificationSettingsPatch, type NotificationSetting } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { MemberView, NotificationSettingsResponse } from "../../../../lib/api/types";
import { avatarEmoji } from "../../../../lib/avatars";
import { Alert, Button, Card, Field, Input } from "../../../../components/ui";

function toHhMm(value: string): string {
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value;
}

interface ChildCardProps {
  child: MemberView;
  setting: NotificationSetting | undefined;
  familyQuietStart?: string;
  familyQuietEnd?: string;
  onSaved: () => void;
}

function ChildNotificationCard({
  child,
  setting,
  familyQuietStart,
  familyQuietEnd,
  onSaved,
}: ChildCardProps) {
  const t = useTranslations("instellingen.notifications");

  const [enabled, setEnabled] = useState(setting?.enabled ?? true);
  const [useCustomQuiet, setUseCustomQuiet] = useState(
    Boolean(setting?.quietStart && setting?.quietEnd),
  );
  const [quietStart, setQuietStart] = useState(setting?.quietStart ?? familyQuietStart ?? "19:30");
  const [quietEnd, setQuietEnd] = useState(setting?.quietEnd ?? familyQuietEnd ?? "07:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setEnabled(setting?.enabled ?? true);
    const custom = Boolean(setting?.quietStart && setting?.quietEnd);
    setUseCustomQuiet(custom);
    setQuietStart(setting?.quietStart ?? familyQuietStart ?? "19:30");
    setQuietEnd(setting?.quietEnd ?? familyQuietEnd ?? "07:00");
  }, [setting, familyQuietStart, familyQuietEnd]);

  async function onSave() {
    setError(null);
    setSaved(false);

    const body = {
      childId: child.id,
      enabled,
      quietStart: useCustomQuiet ? toHhMm(quietStart) : null,
      quietEnd: useCustomQuiet ? toHhMm(quietEnd) : null,
    };
    const parsed = NotificationSettingsPatch.safeParse(body);
    if (!parsed.success) {
      setError(t("errorValidation"));
      return;
    }

    setBusy(true);
    try {
      await apiClient.patch("/api/v1/notification-settings", parsed.data);
      setSaved(true);
      onSaved();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 403) {
        setError(t("errorForbidden"));
      } else {
        setError(t("errorSave"));
      }
    } finally {
      setBusy(false);
    }
  }

  const emoji = avatarEmoji(child.avatarId);

  return (
    <Card as="li" variant="row">
      <div className="flex items-center gap-2">
        {emoji && (
          <span className="text-xl" aria-hidden>
            {emoji}
          </span>
        )}
        <h3 className="text-base font-semibold text-text">{child.displayName}</h3>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{t("enabled")}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted">{t("enabledHint")}</span>
          </span>
        </label>

        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            checked={useCustomQuiet}
            onChange={(e) => setUseCustomQuiet(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{t("customQuiet")}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted">
              {useCustomQuiet ? t("customQuietOn") : t("customQuietOff", {
                  start: familyQuietStart ?? "19:30",
                  end: familyQuietEnd ?? "07:00",
                })}
            </span>
          </span>
        </label>

        {useCustomQuiet && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("quietStart")}>
              <Input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                required
              />
            </Field>
            <Field label={t("quietEnd")}>
              <Input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                required
              />
            </Field>
          </div>
        )}

        {error && <Alert tone="danger">{error}</Alert>}
        {saved && !error && <Alert tone="success">{t("saved")}</Alert>}

        <div>
          <Button type="button" size="sm" disabled={busy} onClick={() => void onSave()}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

interface Props {
  childMembers: MemberView[];
  familyQuietStart?: string;
  familyQuietEnd?: string;
}

export default function NotificationSettingsSection({
  childMembers,
  familyQuietStart,
  familyQuietEnd,
}: Props) {
  const t = useTranslations("instellingen.notifications");
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const raw = await apiClient.get("/api/v1/notification-settings");
      const parsed = NotificationSettingsResponse.parse(raw);
      setSettings(parsed.settings);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (failed) {
    return <Alert tone="danger">{t("loadError")}</Alert>;
  }

  return (
    <section aria-labelledby="notifications-heading">
      <h2 id="notifications-heading" className="text-base font-semibold text-text">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>

      {childMembers.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("noChildren")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {childMembers.map((child) => (
            <ChildNotificationCard
              key={child.id}
              child={child}
              setting={settings.find((s) => s.childId === child.id)}
              familyQuietStart={familyQuietStart}
              familyQuietEnd={familyQuietEnd}
              onSaved={load}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
