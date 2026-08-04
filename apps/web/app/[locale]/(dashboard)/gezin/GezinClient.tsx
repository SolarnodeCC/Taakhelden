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
} from "../../../../lib/api/types";
import { avatarEmoji } from "../../../../lib/avatars";
import {
  FullParentForbidden,
  FullParentUpstreamError,
  useRequireFullParent,
} from "../../../../lib/auth/RequireFullParent";
import { useRouter } from "../../../../i18n/navigation";
import { Alert, Button, Card, EmptyState, PageError, SkeletonRows } from "../../../../components/ui";
import InviteCodeCard from "./InviteCodeCard";
import InviteParentForm from "./InviteParentForm";
import FamilySettingsForm from "./FamilySettingsForm";
import {
  ChildCreateForm,
  ChildEditForm,
  PincodeResetForm,
  type ChildCreatePayload,
  type ChildEditPayload,
} from "./ChildForms";
import PointsPanel from "./PointsPanel";
import DeleteChildForm from "./DeleteChildForm";
import PausePanel from "./PausePanel";
import { ActivePauseBadge } from "./PausePanel";
import {
  ParentBalancesResponse,
  parentBalancesChildren,
  type Balance,
  type ChildPause,
} from "../../../../lib/api/types";

/** Auto-scroll is a motion trigger, and CSS cannot reach an imperative call. */
function scrollToCode(el: HTMLElement | null) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

type Panel =
  | { kind: "create" }
  | { kind: "edit"; child: MemberView }
  | { kind: "pin"; child: MemberView }
  | { kind: "points"; child: MemberView }
  | { kind: "delete"; child: MemberView }
  | { kind: "pause"; child: MemberView }
  | null;

export default function GezinClient() {
  const t = useTranslations("gezin");
  const router = useRouter();
  const searchParams = useSearchParams();
  const onboarding = searchParams.get("onboarding") === "1";
  const gate = useRequireFullParent();

  const [family, setFamily] = useState<FamilyView | null>(null);
  const [children, setChildren] = useState<MemberView[]>([]);
  const [parents, setParents] = useState<MemberView[]>([]);
  const [failed, setFailed] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<2 | 3>(2);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [pauses, setPauses] = useState<Record<string, ChildPause | null>>({});
  const codeRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [familyRaw, membersRaw, balanceRaw] = await Promise.all([
        apiClient.get("/api/v1/families/me"),
        apiClient.get("/api/v1/members"),
        apiClient.get("/api/v1/points/balance").catch(() => null),
      ]);
      const fam = FamilyView.parse(familyRaw);
      const members = MemberList.parse(membersRaw);
      setFamily(fam);
      setChildren(members.filter((m) => m.role === "child"));
      setParents(members.filter((m) => m.role === "parent"));
      if (balanceRaw) {
        const parsed = ParentBalancesResponse.parse(balanceRaw);
        const map: Record<string, Balance> = {};
        for (const b of parentBalancesChildren(parsed)) {
          map[b.childId] = b;
        }
        setBalances(map);
      }
      setFailed(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        setFailed(true);
        return;
      }
      setFailed(true);
    }
  }, [router]);

  useEffect(() => {
    if (gate !== "ok") return;
    void load();
  }, [gate, load]);

  useEffect(() => {
    if (!onboarding) return;
    if (children.length > 0) {
      setOnboardingStep(3);
      window.setTimeout(() => scrollToCode(codeRef.current), 50);
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
        window.setTimeout(() => scrollToCode(codeRef.current), 50);
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

  if (gate === "forbidden") return <FullParentForbidden />;
  if (gate === "upstream_error") return <FullParentUpstreamError />;

  if (gate === "loading" || (!family && !failed)) {
    return (
      <div aria-busy>
        <SkeletonRows count={3} />
      </div>
    );
  }

  if (failed || !family) {
    return <PageError message={t("loadError")} onRetry={() => void load()} />;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle", { name: family.name })}</p>
      </header>

      {onboarding && (
        <Card variant="tinted-accent">
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
        </Card>
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

      <FamilySettingsForm family={family} onSaved={setFamily} />

      <section aria-labelledby="children-heading">
        <div className="flex items-center justify-between gap-3">
          <h2 id="children-heading" className="text-lg font-semibold text-text">
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
          <div className="mt-3">
            <EmptyState
              title={t("children.emptyTitle")}
              body={t("children.empty")}
              action={
                <Button type="button" onClick={() => setPanel({ kind: "create" })}>
                  {t("children.add")}
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {children.map((child) => {
              const emoji = avatarEmoji(child.avatarId);
              const childBalance = balances[child.id];
              const isActivePanel =
                panel?.kind === "points" ||
                panel?.kind === "delete" ||
                panel?.kind === "pause"
                  ? panel.child.id === child.id
                  : false;
              return (
                <li
                  key={child.id}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {emoji && (
                          <span className="text-xl" aria-hidden>
                            {emoji}
                          </span>
                        )}
                        <h3 className="truncate text-base font-semibold text-text">
                          {child.displayName}
                        </h3>
                        {pauses[child.id] && (
                          <ActivePauseBadge pause={pauses[child.id]!} />
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted">
                        {child.birthYear != null && t("children.born", { year: child.birthYear })}
                        {child.birthYear != null && child.ageMode ? " · " : ""}
                        {child.ageMode && t(`children.ageMode.${child.ageMode}`)}
                        {childBalance != null && (
                          <>
                            {" · "}
                            {t("children.balance", { points: childBalance.balance })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setPanel({ kind: "points", child })}
                      >
                        {t("children.points")}
                      </Button>
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
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPanel(
                            panel?.kind === "pause" && panel.child.id === child.id
                              ? null
                              : { kind: "pause", child },
                          )
                        }
                      >
                        {t("children.pause")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPanel({ kind: "delete", child })}
                      >
                        {t("children.delete")}
                      </Button>
                    </div>
                  </div>
                  {isActivePanel && panel?.kind === "points" && (
                    <PointsPanel child={child} onClose={() => setPanel(null)} />
                  )}
                  {isActivePanel && panel?.kind === "pause" && (
                    <PausePanel
                      child={child}
                      onChanged={load}
                      onPauseLoaded={(p) =>
                        setPauses((prev) => ({ ...prev, [child.id]: p }))
                      }
                    />
                  )}
                  {isActivePanel && panel?.kind === "delete" && (
                    <DeleteChildForm
                      child={child}
                      busy={busy}
                      onCancel={() => setPanel(null)}
                      onDeleted={async () => {
                        setPanel(null);
                        await load();
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="parents-heading">
        <h2 id="parents-heading" className="text-lg font-semibold text-text">
          {t("parents.title")}
        </h2>
        {parents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{t("parents.empty")}</p>
        ) : (
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
        )}
        <InviteParentForm onInvited={load} />
      </section>
    </div>
  );
}
