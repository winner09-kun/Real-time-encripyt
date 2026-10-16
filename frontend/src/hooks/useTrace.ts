import { useCallback, useEffect, useState } from "react";

export type RGB = number[];

export interface Trace {
  n: number;
  patch: { x: number; y: number; size: number };
  capture: {
    raw_w: number;
    raw_h: number;
    target_w: number;
    target_h: number;
    total_pixels: number;
    total_bytes: number;
  };
  x0: number;
  r: number;
  seed: { text: string; bytes: number[] };
  rgb: RGB[];
  chaos: { x: number[]; perm: number[]; inverse: number[] };
  scrambled: RGB[];
  vigenere: { key: RGB[]; cipher: RGB[] };
  decrypted: RGB[];
  restored: RGB[];
  diff: RGB[];
  roundtrip_ok: boolean;
}

const WS_BASE = import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000";
const HTTP_BASE = WS_BASE.replace(/^ws/, "http");

export function useTrace() {
  const [trace, setTrace] = useState<Trace | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (acak = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${HTTP_BASE}/trace${acak ? "?acak=true" : ""}`);
      if (!res.ok) throw new Error(String(res.status));
      setTrace(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // backend belum siap / frame belum ada -> coba lagi sampai dapat sampel pertama
  useEffect(() => {
    if (trace || !error) return;
    const t = window.setTimeout(() => load(), 2000);
    return () => window.clearTimeout(t);
  }, [trace, error, load]);

  return { trace, error, loading, load };
}
