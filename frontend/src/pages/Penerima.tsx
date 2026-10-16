import { useState, useCallback } from "react";
import PasskeyPanel from "../components/PasskeyPanel";
import { useVideoFeed } from "../hooks/useVideoFeed";
import { useMetrics } from "../hooks/useMetrics";
import VideoPanel from "../components/VideoPanel";
import SidePanel from "../components/SidePanel";
import MetricRow from "../components/MetricRow";
import "./PageLayout.css";

export default function Penerima() {
  const [token, setToken] = useState<string | null>(null);
  const clearToken = useCallback(() => setToken(null), []);
  const { status, frameSrc } = useVideoFeed("/feed/decrypted", token, clearToken);
  const { metrics: liveMetrics } = useMetrics("penerima");
  const metrics = token ? liveMetrics : null;

  const verified = metrics?.decrypt_ok;

  return (
    <div className="page-layout">
      <VideoPanel
        status={status}
        frameSrc={frameSrc}
        label="TAYANGAN VIDEO ASLI — OUTPUT"
        idleMessage={token ? "Menunggu hasil dekripsi dari backend..." : "Video terkunci. Masukkan passkey dari pengirim."}
        errorMessage="Channel dekripsi terputus dari backend."
      />

      <aside className="page-side">
        <PasskeyPanel role="penerima" token={token} onConnect={setToken} />
        <SidePanel title="TAHAP ARSITEKTUR">
          <p className="page-note">
            Dekripsi Nilai Warna (Vigenere 256) → Deskripsi Spasial (Inverse Chaos)
            → Rekonstruksi Frame → Bangun Video Asli.
          </p>
        </SidePanel>

        <SidePanel title="VERIFIKASI">
          <MetricRow
            label="Status dekripsi"
            value={metrics ? (verified ? "COCOK" : "GAGAL DEKRIPSI") : "—"}
            tone={metrics ? (verified ? "ok" : "err") : "neutral"}
          />
          <MetricRow
            label="Latency end-to-end"
            value={metrics ? `${metrics.latency_ms.toFixed(1)} ms` : "—"}
            tone={metrics && metrics.latency_ms < 120 ? "ok" : "warn"}
          />
          <MetricRow label="Frame diterima" value={metrics ? String(metrics.frame_count) : "—"} />
        </SidePanel>

        <SidePanel title="INTEGRITAS SINYAL">
          <p className="page-note">
            Video di halaman ini seharusnya identik piksel-per-piksel dengan
            feed di halaman Pengirim. Kalau kunci awal tidak cocok, status
            verifikasi di atas akan menampilkan "GAGAL DEKRIPSI".
          </p>
        </SidePanel>
      </aside>
    </div>
  );
}
