/**
 * Eén Durable Object per gezin:
 *  - WebSocket-broadcast naar ouder-dashboards (instance.updated, points.changed, …)
 *  - serialisatie van alle ledger-writes (voorkomt races bij simultaan afvinken)
 *
 * Routes sturen mutaties als interne POST /complete|/approve|/redo|/undo|/adjust;
 * de payload bevat altijd familyId zodat elke repo-aanroep gescoped blijft.
 */
import { ErrorCodes, type SyncMutation, type CompleteResult } from "@taakhelden/shared";
import type { Env } from "../types";
import { ApiException } from "../middleware/error";
import {
  applyComplete,
  applyApprove,
  applyRedo,
  applyUndo,
  applyAdjust,
  applyRedeem,
  applyFulfillRedemption,
  applyCancelRedemption,
  applyAttachPhoto,
  type Actor,
} from "../services/pointsEngine";
import { notifyChild, notifyParents, memberName, childCopy, parentCopy } from "../services/notifier";
import { processSyncBatch } from "../services/syncService";
import { applyMoveInstance } from "../services/instanceService";
import { getIdempotencyResponse, storeIdempotencyResponse } from "../repo/system";
import { completeActiveGoalIfReached } from "../repo/familyGoals";

interface MutationBody {
  familyId: string;
  instanceId?: string;
  actor: Actor;
  note?: string;
  childId?: string;
  amount?: number;
  rewardId?: string;
  redemptionId?: string;
  photoId?: string;
  date?: string;
  mutations?: SyncMutation[];
  since?: string;
  idempotencyKey?: string;
}

export class FamilyRoom implements DurableObject {
  /** Promise-ketting: mutaties draaien strikt na elkaar, per gezin. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]); // hibernation-API: overleeft evictions
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (req.method !== "POST") {
      return new Response("not found", { status: 404 });
    }

    const path = new URL(req.url).pathname;
    try {
      const body = (await req.json()) as MutationBody;
      const result = await this.serialize(() => this.runIdempotent(path, body));
      return Response.json(result);
    } catch (err) {
      if (err instanceof ApiException) {
        return Response.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status },
        );
      }
      // Malformed JSON → structured 400 (req.json was previously outside the try).
      if (err instanceof SyntaxError) {
        return Response.json(
          { error: { code: ErrorCodes.VALIDATION_FAILED, message: "Ongeldige mutatie-payload." } },
          { status: 400 },
        );
      }
      throw err;
    }
  }

  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(fn, fn);
    this.chain = next.catch(() => {}); // fout in de ene mutatie blokkeert de volgende niet
    return next;
  }

  /**
   * DO-side idempotentie: draait binnen de geserialiseerde mutatie-turn, dus de
   * check-en-schrijf kan niet racen met een gelijktijdig request. Voorkomt dubbel
   * afboeken/afvinken als twee requests met dezelfde Idempotency-Key de KV-cache
   * allebei missen. Alleen succesvolle resultaten worden gecachet (een fout mag
   * opnieuw geprobeerd worden). Zonder key: gewoon doorlaten.
   */
  private async runIdempotent(path: string, body: MutationBody): Promise<unknown> {
    const rawKey = body.idempotencyKey;
    if (!rawKey) return this.handleMutation(path, body);
    const storeKey = `${body.actor.userId}:${rawKey}`;
    const cached = await getIdempotencyResponse(this.env.DB, storeKey);
    if (cached) return JSON.parse(cached);
    const result = await this.handleMutation(path, body);
    await storeIdempotencyResponse(this.env.DB, storeKey, body.actor.userId, JSON.stringify(result));
    return result;
  }

  /** Na positieve ledger-writes: actief gezinsdoel afronden als target bereikt. */
  private async maybeCompleteGoal(familyId: string) {
    try {
      await completeActiveGoalIfReached(this.env.DB, familyId);
    } catch {
      /* best-effort — mutatie zelf mag niet falen op goal-progress */
    }
  }

  private async handleMutation(path: string, body: MutationBody): Promise<unknown> {
    const db = this.env.DB;
    const { familyId, actor } = body;

    switch (path) {
      case "/complete": {
        const { result, status, childId } = await applyComplete(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        if (result.pointsEarned > 0) {
          this.broadcast("points.changed", { childId, newBalance: result.newBalance });
          await this.maybeCompleteGoal(familyId);
        }
        this.broadcastBadges(childId, result.newBadges);
        return result;
      }
      case "/approve": {
        const { result, status, childId } = await applyApprove(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        this.broadcast("points.changed", { childId, newBalance: result.newBalance });
        await this.maybeCompleteGoal(familyId);
        this.broadcastBadges(childId, result.newBadges);
        await this.tryNotify(() =>
          notifyChild(
            this.env,
            familyId,
            childId,
            childCopy.approved(result.pointsEarned + result.photoBonusPoints),
            { type: "task_approved", refId: body.instanceId, childId, contentAvailable: true },
          ),
        );
        return result;
      }
      case "/redo": {
        const { status, childId } = await applyRedo(db, familyId, body.instanceId!, body.note ?? "");
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        await this.tryNotify(async () =>
          notifyChild(
            this.env,
            familyId,
            childId,
            childCopy.redo(await memberName(this.env, familyId, actor.userId)),
            { type: "task_redo", refId: body.instanceId, childId, contentAvailable: true },
          ),
        );
        return { status };
      }
      case "/undo": {
        const { status, childId } = await applyUndo(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        return { status };
      }
      case "/attach-photo": {
        const result = await applyAttachPhoto(db, familyId, body.instanceId!, body.photoId!, body.actor);
        this.broadcast("instance.updated", {
          instanceId: body.instanceId,
          childId: result.childId,
          photoStatus: result.photoStatus,
        });
        if (result.photoBonusPoints > 0) {
          this.broadcast("points.changed", { childId: result.childId, newBalance: result.newBalance });
          await this.maybeCompleteGoal(familyId);
        }
        return result;
      }
      case "/redeem": {
        const { result, childId, rewardTitle } = await applyRedeem(db, familyId, body.rewardId!, body.actor);
        this.broadcast("redemption.created", {
          redemptionId: result.redemptionId,
          rewardId: body.rewardId,
          rewardTitle,
          childId,
        });
        this.broadcast("points.changed", { childId, newBalance: result.newBalance });
        await this.tryNotify(async () =>
          notifyParents(
            this.env,
            familyId,
            parentCopy.redemption(await memberName(this.env, familyId, childId), rewardTitle),
            { type: "approval_queue", refId: result.redemptionId, childId, contentAvailable: true },
          ),
        );
        return result;
      }
      case "/redemption-fulfill": {
        const { status, childId } = await applyFulfillRedemption(db, familyId, body.redemptionId!, body.actor);
        this.broadcast("redemption.updated", { redemptionId: body.redemptionId, status, childId });
        return { status };
      }
      case "/redemption-cancel": {
        const { status, childId, newBalance } = await applyCancelRedemption(
          db,
          familyId,
          body.redemptionId!,
          body.actor,
        );
        this.broadcast("redemption.updated", { redemptionId: body.redemptionId, status, childId });
        this.broadcast("points.changed", { childId, newBalance });
        await this.maybeCompleteGoal(familyId);
        return { status, newBalance };
      }
      case "/sync": {
        // Hele batch in één DO-turn: strikt op volgorde, per gezin geserialiseerd.
        const syncResult = await processSyncBatch(
          this.env,
          familyId,
          actor,
          body.mutations ?? [],
          body.since,
          (event, data) => this.broadcast(event, data),
        );
        await this.maybeCompleteGoal(familyId);
        return syncResult;
      }
      case "/adjust": {
        const { newBalance } = await applyAdjust(db, familyId, {
          childId: body.childId!,
          amount: body.amount!,
          note: body.note ?? "",
        });
        this.broadcast("points.changed", { childId: body.childId, newBalance });
        await this.maybeCompleteGoal(familyId);
        return { newBalance };
      }
      case "/move": {
        const { view, status, childId, date } = await applyMoveInstance(
          db,
          familyId,
          body.instanceId!,
          actor,
          { date: body.date!, childId: body.childId! },
        );
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId, date });
        return view;
      }
      default:
        throw new ApiException(404, ErrorCodes.NOT_FOUND, "Onbekende mutatie.");
    }
  }

  /** Eén badge.earned-event per zojuist verdiende badge. */
  private broadcastBadges(childId: string, newBadges: CompleteResult["newBadges"]) {
    for (const badge of newBadges) {
      this.broadcast("badge.earned", { childId, badge });
    }
  }

  /** Pushmeldingen zijn best-effort: een APNs-fout mag nooit een mutatie breken. */
  private async tryNotify(fn: () => Promise<void>) {
    try {
      await fn();
    } catch {
      /* bewust stil — nooit tokens of namen loggen */
    }
  }

  broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
        /* gesloten socket — hibernation-API ruimt op */
      }
    }
  }
}
