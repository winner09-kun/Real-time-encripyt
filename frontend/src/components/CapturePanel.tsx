import { useState } from "react";
import SidePanel from "./SidePanel";

const HTTP_BASE = (import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000").replace(/^ws/, "http");

export default function CapturePanel({ token, ready }: { token: string | null; ready: boolean }) {
  const [busy, setBusy] = useState(false);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState("");

  async function capture() {
    if (!token || busy) return;
    setBusy(true);
    setFolder("");
    setError("");
    try {
      const response = await fetch(`${HTTP_BASE}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Capture gagal disimpan.");
      setFolder(data.folder);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Backend tidak dapat dihubungi. Periksa folder captures sebelum mencoba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return <SidePanel title="CAPTURE FRAME">
    <p className="page-note">Simpan 1 detik pada target 24 FPS: masing-masing 24 PNG pengirim, noise, dan penerima (72 gambar). Hasil penerima memakai passkey saat tombol ditekan.</p>
    <div className="passkey-form">
      <button type="button" disabled={!token || !ready || busy} onClick={capture}>
        {busy ? "Mengambil & menyimpan frame…" : "Capture 1 detik · 24 frame"}
      </button>
      {!token && <p className="page-note">Hubungkan penerima untuk mulai capture.</p>}
      {folder && <div role="status" className="page-note">72 gambar tersimpan di komputer backend:<br /><code className="capture-path">{folder}</code></div>}
      {error && <p role="alert" className="passkey-error">{error}</p>}
    </div>
    <p className="page-note">Jika sumber lebih lambat dari 24 FPS, sebagian frame dapat berulang. Nomor frame sumber dicatat di metadata.json.</p>
  </SidePanel>;
}
