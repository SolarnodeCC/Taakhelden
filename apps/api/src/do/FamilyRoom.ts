/**
 * Eén Durable Object per gezin:
 *  - WebSocket-broadcast naar ouder-dashboards (instance.updated, points.changed, …)
 *  - serialisatie van alle ledger-writes (voorkomt races bij simultaan afvinken)
 */
export class FamilyRoom implements DurableObject {
  private sockets = new Set<WebSocket>();

  constructor(private state: DurableObjectState, private env: unknown) {}

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      this.sockets.add(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    // TODO: interne RPC-routes: /complete /redeem — roepen pointsEngine aan
    return new Response("not found", { status: 404 });
  }

  broadcast(event: string, data: unknown) {
    const msg = JSON.stringify({ event, data });
    for (const ws of this.sockets) {
      try { ws.send(msg); } catch { this.sockets.delete(ws); }
    }
  }

  webSocketClose(ws: WebSocket) { this.sockets.delete(ws); }
}
