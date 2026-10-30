import { useEffect, useState } from "react";
import "./Analisa.css";
import AnalysisChart from "../components/AnalysisChart";

const BASE = (import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000").replace(/^ws/, "http");
type Metrics = { mse: number; psnr: number | null; changed_percent: number; identical: boolean };
type Result = { folder: string; identical_frames: number; skipped: string[]; frames: { file: string; noise: Metrics; received: Metrics; entropy: Record<string, number> }[] };
export default function Analisa() {
  const [folders, setFolders] = useState<string[]>([]);
  const [folder, setFolder] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function refresh() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${BASE}/analysis/folders`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Daftar folder gagal dimuat.");
      setFolders(data.folders);
      setFolder(current => data.folders.includes(current) ? current : data.folders[0] || "");
    } catch (e) { setError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "Backend tidak dapat dihubungi. Jalankan npm run dev, lalu klik Muat ulang folder."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function analyze() {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch(`${BASE}/analysis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ folder }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Analisa gagal.");
      setResult(data);
    } catch (e) { setError(e instanceof Error ? e.message : "Analisa gagal."); }
    finally { setBusy(false); }
  }
  return <main className="analysis-page">
    <h1>Analisa foto capture</h1>
    <p>Bandingkan gambar pengirim, noise, dan penerima dari nomor frame yang sama.</p>
    <form onSubmit={e => { e.preventDefault(); void analyze(); }}>
      <label htmlFor="analysis-folder">Folder sesi di dalam captures (komputer backend)</label>
      <div className="analysis-controls">
        <select id="analysis-folder" value={folder} disabled={busy || loading} onChange={e => { setFolder(e.target.value); setResult(null); }} required>
          <option value="">{loading ? "Memuat folder…" : "Pilih folder capture"}</option>
          {folders.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
        <button type="button" disabled={loading || busy} onClick={refresh}>{loading ? "Memuat…" : "Muat ulang folder"}</button>
        <button disabled={busy || !folder.trim()}>{busy ? "Menganalisa…" : "Analisa folder"}</button>
      </div>
    </form>
    {!loading && !error && !folders.length && <p>Belum ada folder capture. Ambil capture di tab Penerima, lalu muat ulang folder.</p>}
    {error && <p role="alert">{error}</p>}
    {busy && <p role="status">Membaca dan membandingkan foto…</p>}
    {result && <section aria-label="Hasil analisa">
      <h2>{result.identical_frames} / {result.frames.length} frame dekripsi identik</h2>
      <p className="analysis-path">{result.folder}</p>
      {result.frames.length > 0 && <div className="analysis-charts">
        <AnalysisChart title="Selisih gambar per frame" description="MSE terhadap pengirim. Garis penerima di angka 0 berarti dekripsi identik." unit="MSE" labels={result.frames.map(r => r.file)} maximum={Math.max(1, ...result.frames.flatMap(r => [r.noise.mse, r.received.mse])) * 1.1} series={[
          { label: "Noise", color: "#f0a83c", values: result.frames.map(r => r.noise.mse) },
          { label: "Penerima", color: "#67c6ed", values: result.frames.map(r => r.received.mse) },
        ]} />
        <AnalysisChart title="Entropi noise per kanal" description="Skala tetap 0–8 bit. Mendekati 8 berarti distribusi intensitas semakin merata." unit="bit" labels={result.frames.map(r => r.file)} maximum={8} series={[
          { label: "Merah (R)", color: "#ff8585", values: result.frames.map(r => r.entropy.R) },
          { label: "Hijau (G)", color: "#78d69c", values: result.frames.map(r => r.entropy.G) },
          { label: "Biru (B)", color: "#67c6ed", values: result.frames.map(r => r.entropy.B) },
        ]} />
      </div>}
      {result.skipped.length > 0 && <p role="status">Dilewati karena pasangan hilang, rusak, atau ukuran berbeda: {result.skipped.join(", ")}</p>}
      {!result.frames.length ? <p>Tidak ada pasangan frame valid untuk dibandingkan.</p> : <div className="analysis-table"><table>
        <caption>Perbandingan dengan pengirim; entropi dihitung pada noise.</caption>
        <thead><tr><th>Frame</th><th>MSE noise</th><th>PSNR noise (dB)</th><th>Nilai berubah (%)</th><th>Entropi R / G / B</th><th>MSE penerima</th><th>PSNR penerima (dB)</th><th>Dekripsi</th></tr></thead>
        <tbody>{result.frames.map(row => <tr key={row.file}><th>{row.file}</th><td>{row.noise.mse.toFixed(2)}</td><td>{row.noise.psnr === null ? "∞" : row.noise.psnr.toFixed(2)}</td><td>{row.noise.changed_percent.toFixed(2)}</td><td>{["R", "G", "B"].map(c => row.entropy[c].toFixed(3)).join(" / ")}</td><td>{row.received.mse.toFixed(2)}</td><td>{row.received.psnr === null ? "∞" : row.received.psnr.toFixed(2)}</td><td>{row.received.identical ? "Identik" : "Berbeda"}</td></tr>)}</tbody>
      </table></div>}
    </section>}
    <section><h2>Metode dan interpretasi</h2><p>MSE adalah rata-rata kuadrat selisih seluruh nilai kanal RGB. MSE 0 dan PSNR ∞ berarti gambar identik. PSNR menggunakan rentang 8-bit (255); semakin besar nilainya, semakin mirip gambar.</p><p>Persentase nilai berubah menghitung perbedaan setiap kanal RGB. Entropi Shannon dihitung terpisah per kanal noise, dengan rentang 0–8 bit. Entropi tinggi menggambarkan distribusi intensitas yang lebih merata, tetapi tidak membuktikan keamanan enkripsi. Ini bukan uji diferensial NPCR/UACI antar dua ciphertext.</p></section>
  </main>;
}
