import { useVideoFeed } from "../hooks/useVideoFeed";
import { useMetrics } from "../hooks/useMetrics";
import VideoPanel from "../components/VideoPanel";
import SidePanel from "../components/SidePanel";
import MetricRow from "../components/MetricRow";
import "./PageLayout.css";
import "./Noise.css";

export default function Noise() {
  const { status, frameSrc } = useVideoFeed("/feed/noise");
  const { metrics } = useMetrics("noise");

  return (
    <div className="page-layout noise-page">
      <VideoPanel
        status={status}
        frameSrc={frameSrc}
        label="FRAME TERENKRIPSI — NOISE"
        variant="hazard"
        idleMessage="Belum ada frame terenkripsi untuk ditampilkan."
        errorMessage="Channel noise terputus dari backend."
      />

      <aside className="page-side">
        <div className="hazard-banner">
          Representasi data yang lewat jaringan — bukan tampilan video biasa
        </div>

        <SidePanel title="STATUS KUNCI">
          <MetricRow
            label="Kunci"
            value={metrics?.key_ready ? "TERPASANG" : "TIDAK ADA"}
            tone={metrics?.key_ready ? "ok" : "warn"}
          />
          <MetricRow label="Cipher" value="Auto-Key Vigenere 256" />
          <MetricRow label="Permutasi spasial" value="Logistic map (chaos)" />
        </SidePanel>

        <SidePanel title="METADATA TRANSMISI">
          <MetricRow label="Frame terproses" value={metrics ? String(metrics.frame_count) : "—"} />
          <MetricRow label="Resolusi" value={metrics?.resolution ?? "—"} />
        </SidePanel>
      </aside>
    </div>
  );
}
