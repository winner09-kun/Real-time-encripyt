import { useEffect, useState } from "react";

export interface Metrics {
  fps: number;
  latency_ms: number;
  key_ready: boolean;
  decrypt_ok: boolean;
  frame_count: number;
  params: { x0: number; r: number; iterations: string };
  resolution: string;
}

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

export function useMetrics(page: string) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: number | null = null;
    let cancelled = false;

    function connect() {
      ws = new WebSocket(`${WS_BASE}/metrics/${page}`);
      ws.onopen = () => !cancelled && setConnected(true);
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "metrics") setMetrics(msg);
        } catch {
          /* abaikan */
        }
      };
      ws.onclose = () => {
        if (!cancelled) {
          setConnected(false);
          retry = window.setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => ws?.close();
    }

    connect();
    return () => {
      cancelled = true;
      if (retry) window.clearTimeout(retry);
      ws?.close();
    };
  }, [page]);

  return { metrics, connected };
}
