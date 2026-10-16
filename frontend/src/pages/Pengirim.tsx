import { useState, useCallback } from "react";
import PasskeyPanel from "../components/PasskeyPanel";
import { useVideoFeed } from "../hooks/useVideoFeed";
import { useMetrics } from "../hooks/useMetrics";
import VideoPanel from "../components/VideoPanel";
import SidePanel from "../components/SidePanel";
import MetricRow from "../components/MetricRow";
import "./PageLayout.css";

export default function Pengirim() {
  const [token, setToken] = useState<string | null>(null);
  const clearToken = useCallback(() => setToken(null), []);
  const { status, frameSrc } = useVideoFeed("/feed/original", token, clearToken);
  const { metrics } = useMetrics("pengirim");

  return (
    <div className="page-layout">
      <VideoPanel
        status={status}
        frameSrc={frameSrc}
        label="ALIRAN VIDEO ASLI — INPUT"
        idleMessage={token ? "Menunggu kamera server..." : "Masukkan passkey untuk mengaktifkan pengirim."}
        errorMessage="Tidak dapat menyambung ke backend capture."
      />

      <aside className="page-side">
        <PasskeyPanel role="pengirim" token={token} onConnect={setToken} />
        <SidePanel title="TAHAP ARSITEKTUR">
          <p className="page-note">
            Ekstraksi Frame (Piksel) → diteruskan ke Pengacakan Spasial (Chaos).
            Halaman ini menampilkan aliran video mentah sebelum diproses.
          </p>
        </SidePanel>

        <SidePanel title="PARAMETER CAPTURE">
          <MetricRow label="Resolusi" value={metrics?.resolution ?? "—"} />
          <MetricRow
            label="FPS Capture"
            value={metrics ? metrics.fps.toFixed(1) : "—"}
            tone={metrics && metrics.fps > 8 ? "ok" : "warn"}
          />
          <MetricRow label="x0 (logistic map)" value={metrics ? metrics.params.x0.toFixed(4) : "—"} />
          <MetricRow label="r (logistic map)" value={metrics ? metrics.params.r.toFixed(4) : "—"} />
          <MetricRow label="Iterasi chaos" value={metrics?.params.iterations ?? "—"} />
        </SidePanel>

        <SidePanel title="STATUS KUNCI">
          <MetricRow
            label="Kunci awal"
            value={metrics?.key_ready ? "TERPASANG" : "TIDAK ADA"}
            tone={metrics?.key_ready ? "ok" : "warn"}
          />
          <MetricRow label="Frame terkirim" value={metrics ? String(metrics.frame_count) : "—"} />
        </SidePanel>
      </aside>
    </div>
  );
}
