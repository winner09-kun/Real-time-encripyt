import { useState, type FormEvent } from "react";
import SidePanel from "./SidePanel";

const HTTP_BASE = (import.meta.env.VITE_WS_BASE ?? "ws://localhost:8000").replace(/^ws/, "http");

export default function PasskeyPanel({ role, token, onConnect }: {
  role: "pengirim" | "penerima";
  token: string | null;
  onConnect: (token: string | null) => void;
}) {
  const [passkey, setPasskey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${HTTP_BASE}/pair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, passkey }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Passkey harus terdiri dari 8–128 karakter.");
      onConnect(data.token);
      setPasskey("");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Failed to fetch" ? err.message : "Backend tidak dapat dihubungi. Coba lagi.");
    } finally {
      setBusy(false);
    }
  }

  return <SidePanel title="HUBUNGKAN DENGAN PASSKEY">
    <p className="page-note">{role === "pengirim"
      ? "Tetapkan passkey pertama untuk sesi server ini, lalu bagikan ke penerima. Jika sudah ditetapkan, gunakan passkey yang sama."
      : "Passkey digunakan untuk mendekripsi video. Kunci yang cocok mengembalikan video asli; kunci yang salah tetap menampilkan hasil dekripsi yang rusak/noise."}</p>
    {token ? <div className="passkey-form">
      <p className="page-note" role="status">{role === "pengirim" ? "Passkey cocok. Pengirim aktif." : "Penerima terhubung. Dekripsi menggunakan passkey yang dimasukkan."}</p>
      <button type="button" onClick={() => onConnect(null)}>{role === "pengirim" ? "Kunci kembali" : "Ganti passkey"}</button>
    </div> : <form className="passkey-form" onSubmit={submit}>
      <label htmlFor={`passkey-${role}`}>Passkey (8–128 karakter)</label>
      <input id={`passkey-${role}`} type="password" minLength={8} maxLength={128}
        autoComplete="off" required value={passkey} disabled={busy}
        onChange={event => setPasskey(event.target.value)} />
      <button disabled={busy} type="submit">{busy ? "Memeriksa…" : role === "pengirim" ? "Aktifkan pengirim" : "Hubungkan penerima"}</button>
      {error && <p className="passkey-error" role="alert">{error}</p>}
    </form>}
  </SidePanel>;
}
