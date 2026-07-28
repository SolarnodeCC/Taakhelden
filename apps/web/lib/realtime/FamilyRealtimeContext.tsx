"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WsMessage } from "@taakhelden/shared";
import { wsBackoffDelay } from "./backoff";
import { isActionableRealtimeEvent, type RealtimeSignal } from "./events";
import { WsConnectResponse } from "./types";

export type RealtimeStatus = "connected" | "connecting" | "disconnected";

type Listener = (event: RealtimeSignal) => void;

interface FamilyRealtimeContextValue {
  status: RealtimeStatus;
  subscribe: (listener: Listener) => () => void;
}

const FamilyRealtimeContext = createContext<FamilyRealtimeContextValue | null>(null);

export function FamilyRealtimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const listenersRef = useRef(new Set<Listener>());
  const attemptRef = useRef(0);
  const hadConnectionRef = useRef(false);

  const subscribe = useCallback((listener: Listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const notify = useCallback((event: RealtimeSignal) => {
    for (const listener of listenersRef.current) {
      listener(event);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearReconnect = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      setStatus("disconnected");
      const delay = wsBackoffDelay(attemptRef.current);
      attemptRef.current += 1;
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    async function connect() {
      if (cancelled) return;
      clearReconnect();
      setStatus("connecting");

      try {
        const res = await fetch("/api/ws/connect", { method: "POST", cache: "no-store" });
        if (!res.ok) {
          scheduleReconnect();
          return;
        }

        const parsed = WsConnectResponse.safeParse(await res.json());
        if (!parsed.success) {
          scheduleReconnect();
          return;
        }

        const url = `${parsed.data.wsUrl}?token=${encodeURIComponent(parsed.data.token)}`;
        const socket = new WebSocket(url);
        ws = socket;

        socket.onopen = () => {
          if (cancelled) return;
          attemptRef.current = 0;
          setStatus("connected");
          if (hadConnectionRef.current) {
            notify("connected");
          }
          hadConnectionRef.current = true;
        };

        socket.onmessage = (ev) => {
          let raw: unknown;
          try {
            if (typeof ev.data !== "string") return;
            raw = JSON.parse(ev.data);
          } catch {
            return;
          }
          const msg = WsMessage.safeParse(raw);
          if (!msg.success || !isActionableRealtimeEvent(msg.data.event)) return;
          notify(msg.data.event);
        };

        socket.onclose = () => {
          ws = null;
          if (!cancelled) scheduleReconnect();
        };

        socket.onerror = () => {
          socket.close();
        };
      } catch {
        scheduleReconnect();
      }
    }

    void connect();

    return () => {
      cancelled = true;
      clearReconnect();
      ws?.close();
      ws = null;
    };
  }, [notify]);

  const value = useMemo(() => ({ status, subscribe }), [status, subscribe]);

  return (
    <FamilyRealtimeContext.Provider value={value}>{children}</FamilyRealtimeContext.Provider>
  );
}

export function useFamilyRealtime(): FamilyRealtimeContextValue {
  const ctx = useContext(FamilyRealtimeContext);
  if (!ctx) {
    throw new Error("useFamilyRealtime must be used within FamilyRealtimeProvider");
  }
  return ctx;
}

const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Debounced refetch when matching FamilyRoom events arrive, plus an immediate
 * refetch after reconnect (not on the initial connect).
 */
export function useRealtimeRefetch(
  events: readonly RealtimeSignal[],
  refetch: () => void | Promise<void>,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) {
  const { subscribe } = useFamilyRealtime();
  const refetchRef = useRef(refetch);

  useEffect(() => {
    refetchRef.current = refetch;
  });

  const eventKey = events.join("\0");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Decode from eventKey so the effect does not depend on unstable array identity.
    const watched = new Set(
      eventKey.length > 0 ? (eventKey.split("\0") as RealtimeSignal[]) : [],
    );

    const run = () => {
      void refetchRef.current();
    };

    const schedule = () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(run, debounceMs);
    };

    const unsub = subscribe((signal) => {
      if (signal === "connected") {
        run();
        return;
      }
      if (watched.has(signal)) schedule();
    });

    return () => {
      unsub();
      if (timer !== null) clearTimeout(timer);
    };
  }, [subscribe, eventKey, debounceMs]);
}
