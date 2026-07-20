/**
 * Eén Durable Object per gezin:
 *  - WebSocket-broadcast naar ouder-dashboards (instance.updated, points.changed, …)
 *  - serialisatie van alle ledger-writes (voorkomt races bij simultaan afvinken)
 *
 * Routes sturen mutaties als interne POST /complete|/approve|/redo|/undo|/adjust;
 * de payload bevat altijd familyId zodat elke repo-aanroep gescoped blijft.
 */
import type { Env } from "../types";
import { ApiException } from "../middleware/error";
import {
  applyComplete,
  applyApprove,
  applyRedo,
  applyUndo,
  applyAdjust,
  type Actor,
} from "../services/pointsEngine";

interface MutationBody {
  familyId: string;
  instanceId?: string;
  actor: Actor;
  note?: string;
  childId?: string;
  amount?: number;
}

export class FamilyRoom implements DurableObject {
  /** Promise-ketting: mutaties draaien strikt na elkaar, per gezin. */
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private state: DurableObjectState, private env: Env) {}

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
    const body = (await req.json()) as MutationBody;
    try {
      const result = await this.serialize(() => this.handleMutation(path, body));
      return Response.json(result);
    } catch (err) {
      if (err instanceof ApiException) {
        return Response.json(
          { error: { code: err.code, message: err.message, details: err.details } },
          { status: err.status },
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

  private async handleMutation(path: string, body: MutationBody): Promise<unknown> {
    const db = this.env.DB;
    const { familyId, actor } = body;

    switch (path) {
      case "/complete": {
        const { result, status, childId } = await applyComplete(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        if (result.pointsEarned > 0) {
          this.broadcast("points.changed", { childId, newBalance: result.newBalance });
        }
        return result;
      }
      case "/approve": {
        const { result, status, childId } = await applyApprove(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        this.broadcast("points.changed", { childId, newBalance: result.newBalance });
        return result;
      }
      case "/redo": {
        const { status, childId } = await applyRedo(db, familyId, body.instanceId!, body.note ?? "");
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        return { status };
      }
      case "/undo": {
        const { status, childId } = await applyUndo(db, familyId, body.instanceId!, actor);
        this.broadcast("instance.updated", { instanceId: body.instanceId, status, childId });
        return { status };
      }
      case "/adjust": {
        const { newBalance } = await applyAdjust(db, familyId, {
          childId: body.childId!,
          amount: body.amount!,
          note: body.note ?? "",
        });
        this.broadcast("points.changed", { childId: body.childId, newBalance });
        return { newBalance };
      }
      default:
        throw new ApiException(404, "NOT_FOUND", "Onbekende mutatie.");
    }
  }

  broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(msg); } catch { /* gesloten socket — hibernation-API ruimt op */ }
    }
  }
}
