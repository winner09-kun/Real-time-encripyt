import { useEffect, useRef, useState } from "react";

export type FeedStatus = "idle" | "connecting" | "streaming" | "error";

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";

export function useVideoFeed(path: string, token?: string | null, onUnauthorized?: () => void) {
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const [frameSrc, setFrameSrc] = useState<string | null>(null);
  const retryRef = useRef<number | null>(null);

  useEffect(() => {
    setFrameSrc(null);
    if (token === null) {
      setStatus("idle");
      return;
    }
    let ws: WebSocket | null = null;
    let cancelled = false;

    function connect() {
      setStatus("connecting");
      ws = new WebSocket(`${WS_BASE}${path}`);

      ws.onopen = () => {
        if (!cancelled && token) ws?.send(JSON.stringify({ token }));
      };
      ws.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(evt.data);
          if (msg.type === "frame") {
            setFrameSrc(`data:image/jpeg;base64,${msg.data}`);
            setStatus("streaming");
          }
        } catch {
          /* abaikan payload yang tidak valid */
        }
      };
      ws.onerror = () => {
        if (!cancelled) setStatus("error");
      };
      ws.onclose = (event) => {
        if (!cancelled) {
          setFrameSrc(null);
          if (event.code === 4401) {
            setStatus("idle");
            onUnauthorized?.();
            return;
          }
          setStatus("error");
          retryRef.current = window.setTimeout(connect, 2000);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (retryRef.current) window.clearTimeout(retryRef.current);
      ws?.close();
    };
  }, [path, token, onUnauthorized]);

  return { status: token === null ? "idle" as const : status, frameSrc: token === null ? null : frameSrc };
}
