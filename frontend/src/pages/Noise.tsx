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

        <SidePanel title="CATATAN DEMO LOKAL">
          <p className="page-note">
            Demo ini berjalan di 1 laptop lewat <code className="mono">localhost</code>.
            Data yang dikirim = data yang diterima, tidak berubah — tidak ada transformasi
            yang terjadi selama transmisi lokal. Kotak ini secara data identik dengan
            "Terima Stream Terenkripsi" di halaman Penerima.
          </p>
          <p className="page-note">
            Kalau nanti berjalan lewat jaringan nyata antar 2 perangkat, baru dua titik
            ini punya arti operasional berbeda: satu titik kirim, satu titik terima
            setelah delay jaringan.
          </p>
        </SidePanel>

        <SidePanel title="METADATA TRANSMISI">
          <MetricRow label="Frame terproses" value={metrics ? String(metrics.frame_count) : "—"} />
          <MetricRow label="Resolusi" value={metrics?.resolution ?? "—"} />
        </SidePanel>
      </aside>
    </div>
  );
}
