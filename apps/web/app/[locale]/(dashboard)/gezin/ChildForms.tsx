"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CreateChildBody, UpdateMemberBody } from "@taakhelden/shared";
import { Field, Input, Alert, Button } from "../../../../components/ui";
import { AVATAR_PLACEHOLDERS } from "../../../../lib/avatars";
import type { MemberView } from "../../../../lib/api/types";

export type ChildCreatePayload = {
  displayName: string;
  birthYear: number;
  avatarId?: string;
  pincode: string;
};

export type ChildEditPayload = {
  displayName: string;
  birthYear: number;
  avatarId?: string;
};

const MIN_BIRTH_YEAR = 2005;

function yearOptions(): number[] {
  const max = new Date().getFullYear() - 3;
  const years: number[] = [];
  for (let y = max; y >= MIN_BIRTH_YEAR; y -= 1) years.push(y);
  return years;
}

export function ChildCreateForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (payload: ChildCreatePayload) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useTranslations("gezin");
  const years = useMemo(() => yearOptions(), []);
  const [displayName, setDisplayName] = useState("");
  const [birthYear, setBirthYear] = useState(String(years[0] ?? MIN_BIRTH_YEAR));
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [pincode, setPincode] = useState("");
  const [pincodeConfirm, setPincodeConfirm] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!consent) {
      setError(t("form.consentRequired"));
      return;
    }
    if (pincode !== pincodeConfirm) {
      setError(t("form.pinMismatch"));
      return;
    }

    const body: ChildCreatePayload = {
      displayName: displayName.trim(),
      birthYear: Number(birthYear),
      pincode,
      ...(avatarId ? { avatarId } : {}),
    };
    const parsed = CreateChildBody.safeParse(body);
    if (!parsed.success) {
      setError(t("form.errorValidation"));
      return;
    }

    try {
      await onSubmit(parsed.data);
    } catch {
      setError(t("form.errorSave"));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
      aria-labelledby="child-create-title"
    >
      <h2 id="child-create-title" className="text-base font-semibold text-text">
        {t("form.createTitle")}
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        <Field label={t("form.displayName")}>
          <Input
            required
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>

        <Field label={t("form.birthYear")}>
          <select
            className="rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            required
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-text">{t("form.avatar")}</legend>
          <p className="mt-0.5 text-xs text-muted">{t("form.avatarOptional")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATAR_PLACEHOLDERS.map((a) => {
              const selected = avatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t("form.avatarOption", { id: a.id })}
                  onClick={() => setAvatarId(selected ? null : a.id)}
                  className={
                    "flex h-11 w-11 items-center justify-center rounded-lg border text-xl transition-colors " +
                    (selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-bg hover:border-accent/50")
                  }
                >
                  <span aria-hidden>{a.emoji}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <Field label={t("form.pincode")}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            required
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </Field>
        <Field label={t("form.pincodeConfirm")}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            required
            value={pincodeConfirm}
            onChange={(e) => setPincodeConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm text-text">
          <input
            type="checkbox"
            className="mt-1"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            {t("form.consent")}{" "}
            <span className="text-muted">({t("form.privacyNote")})</span>
          </span>
        </label>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy || !consent}>
            {busy ? t("form.saving") : t("form.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("form.cancel")}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ChildEditForm({
  child,
  onSubmit,
  onCancel,
  busy,
}: {
  child: MemberView;
  onSubmit: (payload: ChildEditPayload) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useTranslations("gezin");
  const years = useMemo(() => yearOptions(), []);
  const [displayName, setDisplayName] = useState(child.displayName);
  const [birthYear, setBirthYear] = useState(
    String(child.birthYear ?? years[0] ?? MIN_BIRTH_YEAR),
  );
  const [avatarId, setAvatarId] = useState<string | null>(child.avatarId ?? null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: ChildEditPayload = {
      displayName: displayName.trim(),
      birthYear: Number(birthYear),
      ...(avatarId ? { avatarId } : { avatarId: undefined }),
    };
    // UpdateMemberBody allows partial; we always send the edited fields.
    const parsed = UpdateMemberBody.safeParse({
      displayName: body.displayName,
      birthYear: body.birthYear,
      avatarId: avatarId ?? undefined,
    });
    if (!parsed.success) {
      setError(t("form.errorValidation"));
      return;
    }

    try {
      await onSubmit({
        displayName: body.displayName,
        birthYear: body.birthYear,
        ...(avatarId ? { avatarId } : {}),
      });
    } catch {
      setError(t("form.errorSave"));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
      aria-labelledby="child-edit-title"
    >
      <h2 id="child-edit-title" className="text-base font-semibold text-text">
        {t("form.editTitle")}
      </h2>

      <div className="mt-4 flex flex-col gap-4">
        <Field label={t("form.displayName")}>
          <Input
            required
            maxLength={30}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </Field>

        <Field label={t("form.birthYear")}>
          <select
            className="rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text outline-none focus:border-accent"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            required
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-text">{t("form.avatar")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {AVATAR_PLACEHOLDERS.map((a) => {
              const selected = avatarId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t("form.avatarOption", { id: a.id })}
                  onClick={() => setAvatarId(selected ? null : a.id)}
                  className={
                    "flex h-11 w-11 items-center justify-center rounded-lg border text-xl transition-colors " +
                    (selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-bg hover:border-accent/50")
                  }
                >
                  <span aria-hidden>{a.emoji}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? t("form.saving") : t("form.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("form.cancel")}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function PincodeResetForm({
  onSubmit,
  onCancel,
  busy,
}: {
  onSubmit: (pincode: string) => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const t = useTranslations("gezin");
  const [pincode, setPincode] = useState("");
  const [pincodeConfirm, setPincodeConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pincode !== pincodeConfirm) {
      setError(t("form.pinMismatch"));
      return;
    }
    if (!/^\d{4}$/.test(pincode)) {
      setError(t("form.errorValidation"));
      return;
    }
    try {
      await onSubmit(pincode);
    } catch {
      setError(t("form.errorSave"));
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border bg-surface p-5"
      aria-labelledby="pin-reset-title"
    >
      <h2 id="pin-reset-title" className="text-base font-semibold text-text">
        {t("form.resetPinTitle")}
      </h2>
      <div className="mt-4 flex flex-col gap-4">
        <Field label={t("form.pincode")}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            required
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </Field>
        <Field label={t("form.pincodeConfirm")}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            required
            value={pincodeConfirm}
            onChange={(e) => setPincodeConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? t("form.saving") : t("form.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            {t("form.cancel")}
          </Button>
        </div>
      </div>
    </form>
  );
}
