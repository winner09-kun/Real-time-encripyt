import { useState } from "react";
import { useMetrics } from "../hooks/useMetrics";
import { useTrace } from "../hooks/useTrace";
import StepViz from "../components/ProsesViz";
import SidePanel from "../components/SidePanel";
import MetricRow from "../components/MetricRow";
import "./PageLayout.css";
import "./Proses.css";

type Phase = "pengirim" | "transmisi" | "penerima";

interface Step {
  id: string;
  phase: Phase;
  title: string;
  short: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    id: "capture",
    phase: "pengirim",
    title: "1 · Ekstraksi Frame",
    short: "Ambil 1 frame dari webcam, resize ke lebar target, konversi BGR → RGB.",
    detail:
      "Setiap frame ditangkap lewat OpenCV VideoCapture, di-resize ke lebar tetap supaya beban komputasi konsisten di tiap frame, lalu dikonversi ke ruang warna RGB sebelum masuk ke pipeline enkripsi.",
  },
  {
    id: "chaos",
    phase: "pengirim",
    title: "2 · Pengacakan Spasial (Chaos)",
    short: "Logistic map x(n+1) = r·x(n)·(1−x(n)) membangkitkan urutan yang diurutkan jadi permutasi indeks piksel.",
    detail:
      "Nilai chaos dibangkitkan berurutan mulai dari x0, lalu diurutkan (argsort) menjadi permutasi indeks 0..n-1. Seluruh piksel frame (di-flatten) disusun ulang sesuai permutasi ini — posisi tiap piksel berubah total, tapi nilai warnanya belum berubah di tahap ini.",
  },
  {
    id: "vigenere-enc",
    phase: "pengirim",
    title: "3 · Enkripsi Warna (Auto-Key Vigenere 256)",
    short: "cipher = (plain + key) mod 256 — key awal dari seed, lalu otomatis disambung dari plaintext.",
    detail:
      "Key stream dimulai dari seed_key. Begitu seed habis, key dilanjutkan dari byte plaintext sebelumnya (auto-key), sehingga key tidak pernah berulang secara periodik — ini yang membedakannya dari Vigenere klasik dan memperkuat ketahanan terhadap analisis frekuensi.",
  },
  {
    id: "transmisi",
    phase: "transmisi",
    title: "4 · Transmisi (Frame Noise)",
    short: "Frame hasil chaos + vigenere dikirim lewat jaringan — tampak seperti noise acak murni.",
    detail:
      "Inilah yang ditampilkan di halaman Noise. Kalau frame ini disadap di tengah jalan, penyadap tidak bisa merekonstruksinya tanpa tahu parameter chaos (x0, r) dan seed key Vigenere yang persis sama dengan sisi pengirim.",
  },
  {
    id: "vigenere-dec",
    phase: "penerima",
    title: "5 · Dekripsi Warna (Vigenere 256)",
    short: "Kebalikan tahap 3: plain = cipher − key (mod 256), key direkonstruksi dari hasil dekripsi sebelumnya.",
    detail:
      "Karena key auto bergantung pada plaintext yang belum diketahui di muka, dekripsi diselesaikan sebagai rekursi alternating-sign lewat cumulative sum bertanda (divektorisasi dengan NumPy) — bukan loop per-piksel — supaya tetap sanggup mengejar frame rate real-time.",
  },
  {
    id: "unchaos",
    phase: "penerima",
    title: "6 · Deskripsi Spasial (Inverse Chaos)",
    short: "Permutasi yang sama dibalik untuk mengembalikan tiap piksel ke posisi aslinya.",
    detail:
      "Selama (x0, r) di kedua sisi identik, permutasi yang dihasilkan juga identik. Inverse dari permutasi itu dipakai untuk memetakan tiap piksel kembali ke koordinat semula, sebelum frame dianggap selesai direkonstruksi.",
  },
  {
    id: "verify",
    phase: "penerima",
    title: "7 · Rekonstruksi & Verifikasi",
    short: "Frame hasil dekripsi dibandingkan piksel-per-piksel dengan frame asli.",
    detail:
      'Backend menghitung kecocokan piksel-per-piksel antara frame asli dan frame hasil dekripsi pada tiap frame. Kalau parameter chaos atau seed key di kedua sisi tidak identik, hasil dekripsi akan meleset total dan status di panel kanan menampilkan "GAGAL DEKRIPSI".',
  },
];

const PHASE_LABEL: Record<Phase, string> = {
  pengirim: "SISI PENGIRIM",
  transmisi: "JARINGAN",
  penerima: "SISI PENERIMA",
};

const PHASES: Phase[] = ["pengirim", "transmisi", "penerima"];

export default function Proses() {
  const { metrics } = useMetrics("proses");
  const { trace, loading, load } = useTrace();
  const [openId, setOpenId] = useState<string | null>(STEPS[0].id);

  return (
    <div className="page-layout proses-page">
      <div className="proses-pipeline">
        <div className="proses-sample">
          <span className="proses-sample-text">
            SAMPEL: potongan 4×4 piksel pola demo (bukan kamera){trace ? ` (x=${trace.patch.x}, y=${trace.patch.y})` : ""} · algoritma sama persis, dikecilkan jadi{" "}
            {trace ? trace.n : 16} piksel supaya hitungannya muat di layar
            {trace ? ` (frame asli ${trace.capture.total_pixels.toLocaleString("id-ID")} piksel)` : ""}
          </span>
          <button type="button" className="pv-btn" onClick={() => load(true)} disabled={loading}>
            {loading ? "memuat…" : "↻ ambil sampel baru"}
          </button>
        </div>
        {PHASES.map((phase) => {
          const stepsInPhase = STEPS.filter((s) => s.phase === phase);
          return (
            <div className={"proses-phase proses-phase--" + phase} key={phase}>
              <div className="proses-phase-label">{PHASE_LABEL[phase]}</div>
              {stepsInPhase.map((step, i) => {
                const open = openId === step.id;
                return (
                  <div className="proses-step-wrap" key={step.id}>
                    <div className={"proses-step" + (open ? " proses-step--open" : "")}>
                      <button
                        type="button"
                        className="proses-step-toggle"
                        onClick={() => setOpenId(open ? null : step.id)}
                        aria-expanded={open}
                      >
                        <div className="proses-step-head">
                          <span className="proses-step-title">{step.title}</span>
                          <span className="proses-step-caret">{open ? "▾" : "▸"}</span>
                        </div>
                        <p className="proses-step-short">{step.short}</p>
                      </button>
                      {open && (
                        <div className="proses-step-body">
                          <p className="proses-step-detail">{step.detail}</p>
                          <StepViz id={step.id} trace={trace} metrics={metrics} />
                        </div>
                      )}
                    </div>
                    {i < stepsInPhase.length - 1 && <span className="proses-arrow" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <aside className="page-side">
        <SidePanel title="STATUS LIVE PIPELINE">
          <MetricRow
            label="FPS capture"
            value={metrics ? metrics.fps.toFixed(1) : "—"}
            tone={metrics && metrics.fps > 8 ? "ok" : "warn"}
          />
          <MetricRow
            label="Latency end-to-end"
            value={metrics ? `${metrics.latency_ms.toFixed(1)} ms` : "—"}
            tone={metrics && metrics.latency_ms < 120 ? "ok" : "warn"}
          />
          <MetricRow
            label="Kunci"
            value={metrics?.key_ready ? "TERPASANG" : "TIDAK ADA"}
            tone={metrics?.key_ready ? "ok" : "warn"}
          />
          <MetricRow
            label="Verifikasi dekripsi"
            value={metrics ? (metrics.decrypt_ok ? "COCOK" : "GAGAL") : "—"}
            tone={metrics ? (metrics.decrypt_ok ? "ok" : "err") : "neutral"}
          />
          <MetricRow label="Frame diproses" value={metrics ? String(metrics.frame_count) : "—"} />
        </SidePanel>

        <SidePanel title="PARAMETER ALGORITMA">
          <MetricRow label="x0 (logistic map)" value={metrics ? metrics.params.x0.toFixed(4) : "—"} />
          <MetricRow label="r (logistic map)" value={metrics ? metrics.params.r.toFixed(4) : "—"} />
          <MetricRow label="Resolusi" value={metrics?.resolution ?? "—"} />
        </SidePanel>

        <SidePanel title="CARA PAKAI">
          <p className="page-note">
            Klik tiap kotak tahap di kiri untuk membuka penjelasan, hitungan, dan gambaran perubahan pikselnya. Tombol &quot;ambil sampel baru&quot; mengambil potongan piksel lain dari pola demo.
            Angka di panel ini diambil langsung dari backend secara real-time, jadi
            kalau kamera atau koneksi terputus, panel ini ikut berubah.
          </p>
        </SidePanel>
      </aside>
    </div>
  );
}
