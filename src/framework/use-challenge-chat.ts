import { useCallback, useEffect, useRef, useState } from "react";
import type { AppState } from "../../shared/contracts";
import type { PublicOverlayState } from "../../shared/public-state";
import type { LiveRunProjection } from "../../shared/framework";
import { api } from "../api";
import { channelPath } from "./channel";

type SocketMessage =
  | { type: "state.changed"; revision: number; state: AppState }
  | { type: "overlay.changed"; revision: number; state: PublicOverlayState }
  | { type: "framework.run.changed"; projection: LiveRunProjection };

export interface ChallengeChatConnection {
  status: "connecting" | "live" | "reconnecting";
  revision: number;
}

/**
 * Headless live-state hook shared by the reference control panel and OBS overlay.
 * Custom surfaces should consume this hook rather than reproduce transport logic.
 */
export function useChallengeChatState(scope: "overlay"): { state: PublicOverlayState | null; liveRun: LiveRunProjection | null; error: string | null; connection: ChallengeChatConnection; refresh: () => Promise<void> };
export function useChallengeChatState(scope?: "admin"): { state: AppState | null; liveRun: LiveRunProjection | null; error: string | null; connection: ChallengeChatConnection; refresh: () => Promise<void> };
export function useChallengeChatState(scope: "admin" | "overlay" = "admin") {
  const [state, setState] = useState<AppState | PublicOverlayState | null>(null);
  const [liveRun, setLiveRun] = useState<LiveRunProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ChallengeChatConnection>({ status: "connecting", revision: 0 });
  const retryRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      setState(scope === "admin" ? await api.state() : await api.publicState());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load state");
    }
  }, [scope]);

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      setConnection((current) => ({ ...current, status: retryRef.current ? "reconnecting" : "connecting" }));
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}${channelPath(`/api/v1/live/socket?scope=${scope}`)}`);
      socket.addEventListener("open", () => {
        retryRef.current = 0;
        setConnection((current) => ({ ...current, status: "live" }));
      });
      socket.addEventListener("message", (message) => {
        if (message.data === "pong") return;
        try {
          const update = JSON.parse(String(message.data)) as SocketMessage;
          if (scope === "admin" && update.type === "state.changed") {
            setState(update.state);
            setConnection({ status: "live", revision: update.revision });
          } else if (scope === "overlay" && update.type === "overlay.changed") {
            setState(update.state);
            setConnection({ status: "live", revision: update.revision });
          } else if (update.type === "framework.run.changed") {
            setLiveRun(update.projection);
          }
          setError(null);
        } catch {
          setError("Received an invalid live update");
        }
      });
      socket.addEventListener("close", () => {
        if (disposed) return;
        retryRef.current += 1;
        setConnection((current) => ({ ...current, status: "reconnecting" }));
        reconnectTimer = window.setTimeout(connect, Math.min(1_000 * 2 ** retryRef.current, 15_000));
      });
      socket.addEventListener("error", () => socket?.close());
    };

    void refresh();
    connect();
    const recoveryPoll = window.setInterval(() => void refresh(), 30_000);
    return () => {
      disposed = true;
      window.clearInterval(recoveryPoll);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [refresh, scope]);

  return { state, liveRun, error, connection, refresh };
}

/** Headless mutation/status model for fully custom creator control panels. */
export function useChallengeChatController() {
  const live = useChallengeChatState();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mutate = useCallback(async (task: () => Promise<unknown>) => {
    setBusy(true);
    setNotice(null);
    try {
      await task();
      await live.refresh();
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }, [live.refresh]);

  return { ...live, busy, notice, dismissNotice: () => setNotice(null), mutate, actions: api };
}
