"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FamilyPatchBody } from "@taakhelden/shared";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import { FamilyView } from "../../../../lib/api/types";
import { Alert, Button, Field, Input } from "../../../../components/ui";

/** Dispatched after a successful settings save so AppShell can refresh the family name. */
export const FAMILY_UPDATED_EVENT = "taakhelden:family-updated";

function toHhMm(value: string): string {
  // `<input type="time">` may yield HH:MM or HH:MM:SS depending on the browser.
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? value;
}

function listTimeZones(): string[] {
  try {
    const values = Intl.supportedValuesOf("timeZone");
    return values.length > 0 ? values : ["Europe/Amsterdam"];
  } catch {
    return ["Europe/Amsterdam"];
  }
}

interface Props {
  family: FamilyView;
  onSaved: (family: FamilyView) => void;
}

export default function FamilySettingsForm({ family, onSaved }: Props) {
  const t = useTranslations("gezin.settings");
  const timeZones = useMemo(() => listTimeZones(), []);

  const [name, setName] = useState(family.name);
  const [timezone, setTimezone] = useState(family.timezone ?? "Europe/Amsterdam");
  const [tzFilter, setTzFilter] = useState("");
  const [quietStart, setQuietStart] = useState(family.quietStart ?? "19:30");
  const [quietEnd, setQuietEnd] = useState(family.quietEnd ?? "07:00");
  const [dayBonusPoints, setDayBonusPoints] = useState(family.dayBonusPoints ?? 20);
  const [weekBonusPoints, setWeekBonusPoints] = useState(family.weekBonusPoints ?? 100);
  const [weekBonusPct, setWeekBonusPct] = useState(
    Math.round((family.weekBonusThreshold ?? 0.8) * 100),
  );
  const [vacationMode, setVacationMode] = useState(family.vacationMode ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const filteredZones = useMemo(() => {
    const q = tzFilter.trim().toLowerCase();
    if (!q) return timeZones;
    return timeZones.filter((z) => z.toLowerCase().includes(q));
  }, [timeZones, tzFilter]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const body = {
      name: name.trim(),
      timezone,
      quietStart: toHhMm(quietStart),
      quietEnd: toHhMm(quietEnd),
      dayBonusPoints,
      weekBonusPoints,
      weekBonusThreshold: weekBonusPct / 100,
      vacationMode,
    };
    const parsed = FamilyPatchBody.safeParse(body);
    if (!parsed.success) {
      setError(t("errorValidation"));
      return;
    }

    setBusy(true);
    try {
      const raw = await apiClient.patch("/api/v1/families/me", parsed.data);
      const updated = FamilyView.parse(raw);
      onSaved(updated);
      setSaved(true);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(FAMILY_UPDATED_EVENT));
      }
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

  return (
    <section aria-labelledby="settings-heading" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="settings-heading" className="text-base font-semibold text-text">
        {t("title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("hint")}</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
        <Field label={t("name")}>
          <Input
            name="familyName"
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label={t("timezone")}>
          <Input
            type="search"
            name="timezoneFilter"
            value={tzFilter}
            onChange={(e) => setTzFilter(e.target.value)}
            placeholder={t("timezoneFilter")}
            aria-label={t("timezoneFilter")}
            className="mb-2"
          />
          <select
            name="timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            size={Math.min(8, Math.max(4, filteredZones.length))}
          >
            {!filteredZones.includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {filteredZones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("quietStart")}>
            <Input
              type="time"
              name="quietStart"
              required
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </Field>
          <Field label={t("quietEnd")}>
            <Input
              type="time"
              name="quietEnd"
              required
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">{t("quietHint")}</p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("dayBonus")}>
            <Input
              type="number"
              name="dayBonusPoints"
              min={0}
              step={1}
              required
              value={dayBonusPoints}
              onChange={(e) => setDayBonusPoints(Number(e.target.value))}
            />
          </Field>
          <Field label={t("weekBonus")}>
            <Input
              type="number"
              name="weekBonusPoints"
              min={0}
              step={1}
              required
              value={weekBonusPoints}
              onChange={(e) => setWeekBonusPoints(Number(e.target.value))}
            />
          </Field>
          <Field label={t("weekThreshold")}>
            <Input
              type="number"
              name="weekBonusThreshold"
              min={50}
              max={100}
              step={1}
              required
              value={weekBonusPct}
              onChange={(e) => setWeekBonusPct(Number(e.target.value))}
            />
          </Field>
        </div>
        <p className="text-xs text-muted">{t("bonusHint")}</p>

        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            name="vacationMode"
            checked={vacationMode}
            onChange={(e) => setVacationMode(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="font-medium">{t("vacation")}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted">{t("vacationHint")}</span>
          </span>
        </label>

        {error && <Alert tone="danger">{error}</Alert>}
        {saved && !error && <Alert tone="success">{t("saved")}</Alert>}

        <div>
          <Button type="submit" disabled={busy}>
            {busy ? t("saving") : t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
