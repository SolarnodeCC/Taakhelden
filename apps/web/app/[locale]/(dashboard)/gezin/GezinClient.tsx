"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { apiClient, ApiClientError } from "../../../../lib/api/client";
import {
  FamilyView,
  InviteCodeResult,
  MemberList,
  MemberView,
  SessionInfo,
} from "../../../../lib/api/types";
import { avatarEmoji } from "../../../../lib/avatars";
import { Link, useRouter } from "../../../../i18n/navigation";
import { Alert, Button } from "../../../../components/ui";
import InviteCodeCard from "./InviteCodeCard";
import {
  ChildCreateForm,
  ChildEditForm,
  PincodeResetForm,
  type ChildCreatePayload,
  type ChildEditPayload,
} from "./ChildForms";

type Panel =
  | { kind: "create" }
  | { kind: "edit"; child: MemberView }
  | { kind: "pin"; child: MemberView }
  | null;

export default function GezinClient() {
  const t = useTranslations("gezin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";

  const [family, setFamily] = useState<FamilyView | null>(null);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [parents, setParents] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<2 | 3>(2);
  const codeRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [sessionRaw, familyRaw, membersRaw] = await Promise.all([
        apiClient.get("/api/session"),
        apiClient.get("/api/v1/families/me"),
        apiClient.get("/api/v1/members"),
      ]);
      const session = SessionInfo.parse(sessionRaw);
      if (session.permissions !== "full") {
        setForbidden(true);
        return;
      }
      const fam = FamilyView.parse(familyRaw);
      const members = MemberList.parse(membersRaw);
      setFamily(fam);
      setChildren(members.filter((m) => m.role === "child"));
      setParents(members.filter((m) => m.role === "parent"));
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setForbidden(true);
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!onboarding) return;
    if (children.length > 0) {
      setOnboardingStep(3);
      // Focus the invite-code card after first child exists.
      window.setTimeout(() => codeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } else {
      setOnboardingStep(2);
      setPanel((p) => p ?? { kind: "create" });
    }
  }, [onboarding, children.length]);

  async function regenerateCode() {
    setRegenerating(true);
    setActionError(null);
    try {
      const raw = await apiClient.post("/api/v1/families/me/invite-code");
      const result = InviteCodeResult.parse(raw);
      setFamily((f) => (f ? { ...f, inviteCode: result.inviteCode } : f));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setActionError(t("actionError"));
    } finally {
      setRegenerating(false);
    }
  }

  async function createChild(payload: ChildCreatePayload) {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.post("/api/v1/members/children", payload);
      setPanel(null);
      await load();
      if (onboarding) {
        setOnboardingStep(3);
        window.setTimeout(() => codeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } finally {
      setBusy(false);
    }
  }

  async function editChild(childId: string, payload: ChildEditPayload) {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.patch(`/api/v1/members/${childId}`, payload);
      setPanel(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function resetPin(childId: string, pincode: string) {
    setBusy(true);
    setActionError(null);
    try {
      await apiClient.post(`/api/v1/members/${childId}/pincode`, { pincode });
      setPanel(null);
    } finally {
      setBusy(false);
    }
  }

  function finishOnboarding() {
    router.replace("/gezin");
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert tone="danger">{t("forbidden")}</Alert>
        <p className="mt-4">
          <Link href="/vandaag" className="font-medium text-accent hover:underline">
            {t("backToToday")}
          </Link>
        </p>
      </div>
    );
  }

  if (failed) {
    return <p className="text-sm text-muted">{t("loadError")}</p>;
  }

  if (!family) {
    return <p className="text-sm text-muted">{t("loading")}</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle", { name: family.name })}</p>
      </header>

      {onboarding && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-sm font-medium text-text">
            {onboardingStep === 2 ? t("onboarding.step2") : t("onboarding.step3")}
          </p>
          {onboardingStep === 3 && children.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => router.push("/vandaag")}>
                {t("onboarding.goToday")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={finishOnboarding}>
                {t("onboarding.dismiss")}
              </Button>
            </div>
          )}
        </div>
      )}

      {actionError && <Alert tone="danger">{actionError}</Alert>}

      {family.inviteCode && (
        <InviteCodeCard
          inviteCode={family.inviteCode}
          regenerating={regenerating}
          onRegenerate={regenerateCode}
          onCodeMount={(el) => {
            codeRef.current = el;
          }}
        />
      )}

      <section aria-labelledby="children-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="children-heading" className="text-base font-semibold text-text">
            {t("children.title")}
          </h2>
          {panel?.kind !== "create" && (
            <Button type="button" size="sm" onClick={() => setPanel({ kind: "create" })}>
              {t("children.add")}
            </Button>
          )}
        </div>

        {panel?.kind === "create" && (
          <div className="mt-3">
            <ChildCreateForm
              busy={busy}
              onCancel={() => setPanel(null)}
              onSubmit={createChild}
            />
          </div>
        )}

        {panel?.kind === "edit" && (
          <div className="mt-3">
            <ChildEditForm
              child={panel.child}
              busy={busy}
              onCancel={() => setPanel(null)}
              onSubmit={(payload) => editChild(panel.child.id, payload)}
            />
          </div>
        )}

        {panel?.kind === "pin" && (
          <div className="mt-3">
            <PincodeResetForm
              busy={busy}
              onCancel={() => setPanel(null)}
              onSubmit={(pin) => resetPin(panel.child.id, pin)}
            />
          </div>
        )}

        {children.length === 0 && panel?.kind !== "create" ? (
          <p className="mt-3 text-sm text-muted">{t("children.empty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((child) => {
              const emoji = avatarEmoji(child.avatarId);
              return (
                <li
                  key={child.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {emoji && (
                        <span className="text-xl" aria-hidden>
                          {emoji}
                        </span>
                      )}
                      <h3 className="truncate text-base font-semibold text-text">
                        {child.displayName}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">
                      {child.birthYear != null && t("children.born", { year: child.birthYear })}
                      {child.birthYear != null && child.ageMode ? " · " : ""}
                      {child.ageMode && t(`children.ageMode.${child.ageMode}`)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPanel({ kind: "edit", child })}
                    >
                      {t("children.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setPanel({ kind: "pin", child })}
                    >
                      {t("children.resetPin")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {parents.length > 0 && (
        <section aria-labelledby="parents-heading">
          <h2 id="parents-heading" className="text-base font-semibold text-text">
            {t("parents.title")}
          </h2>
          <ul className="mt-2 flex flex-col gap-1">
            {parents.map((p) => (
              <li key={p.id} className="text-sm text-muted">
                {p.displayName}
                {p.permissions && (
                  <span className="ml-2 text-xs">
                    ({t(`parents.permissions.${p.permissions}`)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
