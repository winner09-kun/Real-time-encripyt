import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { RGB, Trace } from "../hooks/useTrace";
import type { Metrics } from "../hooks/useMetrics";
import "./ProsesViz.css";

/* ---------- helper ---------- */
const css = (p: RGB) => `rgb(${p[0]},${p[1]},${p[2]})`;
const ink = (p: RGB) => (0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2] > 140 ? "#000" : "#fff");
const mod = (a: number) => ((a % 256) + 256) % 256;
const f4 = (x: number) => x.toFixed(4);
const CH = ["R", "G", "B"];

function Swatch({ p, label }: { p: RGB; label?: string }) {
  return (
    <span className="pv-sw-wrap">
      <span className="pv-sw" style={{ background: css(p) }} title={`RGB(${p.join(", ")})`} />
      <span className="pv-rgb mono">{label ?? `(${p.join(", ")})`}</span>
    </span>
  );
}

function Grid({ pixels, title, cell = 46, mode = "index" }: { pixels: RGB[]; title: string; cell?: number; mode?: "index" | "value" }) {
  const size = Math.round(Math.sqrt(pixels.length));
  return (
    <figure className="pv-fig">
      <div className="pv-grid" style={{ gridTemplateColumns: `repeat(${size}, ${cell}px)`, gridAutoRows: `${cell}px` }}>
        {pixels.map((p, i) => (
          <div key={i} className="pv-cell mono" style={{ background: css(p), color: ink(p) }}>
            {mode === "index" ? i : p.reduce((a, b) => a + b, 0)}
          </div>
        ))}
      </div>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

function ShuffleGrid({ pixels, inverse, direction }: { pixels: RGB[]; inverse: number[]; direction: "scramble" | "unscramble" }) {
  const size = Math.round(Math.sqrt(pixels.length));
  const cell = 52;
  const gap = 4;
  const start = direction === "unscramble";
  const [shuffled, setShuffled] = useState(start);

  const play = () => {
    setShuffled(start);
    return window.setTimeout(() => setShuffled(!start), 500);
  };
  useEffect(() => {
    const t = play();
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels, direction]);

  const side = size * cell + (size - 1) * gap;
  return (
    <figure className="pv-fig">
      <div className="pv-shuffle" style={{ width: side, height: side }}>
        {pixels.map((p, i) => {
          const pos = shuffled ? inverse[i] : i;
          const x = (pos % size) * (cell + gap);
          const y = Math.floor(pos / size) * (cell + gap);
          return (
            <div key={i} className="pv-shuffle-cell mono" style={{ width: cell, height: cell, background: css(p), color: ink(p), transform: `translate(${x}px, ${y}px)` }}>
              {i}
            </div>
          );
        })}
      </div>
      <figcaption>
        Angka di kotak = nomor piksel asli.{" "}
        <button type="button" className="pv-btn" onClick={() => play()}>
          ▶ putar ulang
        </button>
      </figcaption>
    </figure>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="pv-formula mono">{children}</div>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="pv-block">
      <h4 className="pv-title">{title}</h4>
      {children}
    </section>
  );
}

function MoreToggle({ all, setAll, total, shown }: { all: boolean; setAll: (v: boolean) => void; total: number; shown: number }) {
  if (total <= shown && !all) return null;
  return (
    <button type="button" className="pv-btn pv-more" onClick={() => setAll(!all)}>
      {all ? "▴ ringkas" : `▾ tampilkan semua ${total} baris`}
    </button>
  );
}

/* ---------- 1. ekstraksi frame ---------- */
function VizCapture({ t }: { t: Trace }) {
  const c = t.capture;
  const scale = c.target_w / c.raw_w;
  const p0 = t.rgb[0];
  const bgr = [p0[2], p0[1], p0[0]];
  return (
    <>
      <Block title="Hitungan resize">
        <Formula>
          <div>skala = lebar_target / lebar_asli = {c.target_w} / {c.raw_w} = {scale.toFixed(4)}</div>
          <div>tinggi_baru = int({c.raw_h} × {scale.toFixed(4)}) = {c.target_h}</div>
          <div>jumlah piksel = {c.target_w} × {c.target_h} = {c.total_pixels.toLocaleString("id-ID")}</div>
          <div>jumlah byte = {c.total_pixels.toLocaleString("id-ID")} × 3 (R,G,B) = {c.total_bytes.toLocaleString("id-ID")} byte per frame</div>
        </Formula>
      </Block>
      <Block title={`Frame itu ternyata cuma tabel angka — ini potongan 4×4 piksel dari posisi (x=${t.patch.x}, y=${t.patch.y})`}>
        <div className="pv-row">
          <Grid pixels={t.rgb} title="16 piksel (diperbesar). Angka = jumlah R+G+B" mode="value" />
          <div className="pv-col">
            <div className="pv-note">Piksel #0 dibaca OpenCV dalam urutan B, G, R lalu ditukar jadi R, G, B:</div>
            <Formula>
              <div>
                OpenCV (BGR): B={bgr[0]}, G={bgr[1]}, R={bgr[2]}
              </div>
              <div>
                Sesudah cvtColor → (R, G, B) = ({p0.join(", ")})
              </div>
            </Formula>
            <div className="pv-row">
              <Swatch p={bgr} label="tanpa konversi (biru↔merah tertukar)" />
              <Swatch p={p0} label="setelah konversi (benar)" />
            </div>
          </div>
        </div>
      </Block>
    </>
  );
}

/* ---------- 2. chaos ---------- */
function VizChaos({ t }: { t: Trace }) {
  const { x, perm, inverse } = t.chaos;
  const rows = x.map((v, i) => ({ i, prev: i === 0 ? t.x0 : x[i - 1], v }));
  const half = Math.ceil(rows.length / 2);
  const table = (part: typeof rows) => (
    <table className="pv-table mono">
      <thead>
        <tr>
          <th>i</th>
          <th>x[i] = r × x[i−1] × (1 − x[i−1])</th>
          <th>urutan</th>
        </tr>
      </thead>
      <tbody>
        {part.map(({ i, prev, v }) => (
          <tr key={i}>
            <td>{i}</td>
            <td>
              {t.r} × {f4(prev)} × (1 − {f4(prev)}) = <b>{f4(v)}</b>
            </td>
            <td>ke-{inverse[i]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <>
      <Block title={`Langkah 1 — bangkitkan ${t.n} angka chaos (mulai x[−1] = x0 = ${f4(t.x0)}, r = ${t.r})`}>
        <div className="pv-row pv-row--top">
          {table(rows.slice(0, half))}
          {table(rows.slice(half))}
        </div>
        <div className="pv-note">Angka dibulatkan 4 desimal biar muat; komputer memakai presisi penuh. Beda x0 sedikit saja, deretnya jadi beda total (sifat chaos).</div>
      </Block>
      <Block title="Langkah 2 — urutkan dari terkecil ke terbesar (argsort), catat nomor asalnya → perm">
        <div className="pv-chips">
          {perm.map((src, k) => (
            <div className="pv-chip mono" key={k}>
              <span className="pv-chip-k">k={k}</span>
              <b>{src}</b>
              <span className="pv-chip-v">{f4(x[src])}</span>
            </div>
          ))}
        </div>
        <div className="pv-note">
          Baca: perm[k] = nomor piksel yang <b>pindah ke posisi k</b>. Nilai kecil di bawah tiap kotak terlihat naik = memang sudah terurut.
        </div>
      </Block>
      <Block title="Langkah 3 — susun ulang piksel: hasil[k] = asli[perm[k]]">
        <div className="pv-row">
          <ShuffleGrid pixels={t.rgb} inverse={inverse} direction="scramble" />
          <Formula>
            <div>perm = [{perm.join(", ")}]</div>
            <div>contoh: hasil[0] = asli[{perm[0]}] → piksel #{perm[0]} pindah ke pojok kiri-atas</div>
            <div>warna piksel TIDAK berubah, hanya posisinya</div>
          </Formula>
        </div>
      </Block>
    </>
  );
}

/* ---------- 3. vigenere enkripsi ---------- */
function VizVigEnc({ t }: { t: Trace }) {
  const [all, setAll] = useState(false);
  const shown = all ? t.n : 6;
  const seed = t.seed.bytes;
  return (
    <>
      <Block title="Rumus">
        <Formula>
          <div>cipher[i] = (plain[i] + key[i]) mod 256</div>
          <div>key[i] = seed[i] &nbsp;jika i &lt; L &nbsp;|&nbsp; plain[i − L] &nbsp;jika i ≥ L &nbsp;(auto-key)</div>
        </Formula>
        <div className="pv-note">
          Di sini seed dipendekkan jadi L = {seed.length} byte: &quot;{t.seed.text}&quot; = {seed.join(", ")} (di sistem asli 25 byte, prinsipnya sama). Karena L = 3 = jumlah kanal RGB, <b>key tiap piksel = warna piksel sebelumnya</b>; piksel #0 memakai seed sebagai warna:
        </div>
        <Swatch p={seed} label={`seed (${seed.join(", ")})`} />
      </Block>
      <Block title="Hitungan per piksel (input = hasil tahap 2)">
        <div className="pv-tablewrap">
          <table className="pv-table mono">
            <thead>
              <tr>
                <th>#</th>
                <th>plain</th>
                <th>+ key</th>
                <th>hitungan (R, G, B)</th>
                <th>= cipher</th>
              </tr>
            </thead>
            <tbody>
              {t.scrambled.slice(0, shown).map((pl, p) => {
                const k = t.vigenere.key[p];
                const ci = t.vigenere.cipher[p];
                return (
                  <tr key={p}>
                    <td>{p}</td>
                    <td><Swatch p={pl} /></td>
                    <td><Swatch p={k} label={`${p === 0 ? "seed" : `#${p - 1}`} (${k.join(", ")})`} /></td>
                    <td>
                      <div className="pv-calc">
                        {[0, 1, 2].map((c) => {
                          const s = pl[c] + k[c];
                          return (
                            <span key={c} className={s >= 256 ? "pv-wrap" : ""} title={s >= 256 ? "lewat 255 → dikurangi 256" : ""}>
                              <i>{CH[c]}</i> {pl[c]}+{k[c]}={s}→<b>{ci[c]}</b>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td><Swatch p={ci} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MoreToggle all={all} setAll={setAll} total={t.n} shown={6} />
        <div className="pv-note">
          <span className="pv-wrap">Oranye</span> = jumlahnya ≥ 256, jadi &quot;memutar&quot; balik ke 0 (mod 256), misal 275 → 275 − 256 = 19. Lihat warna cipher: sudah tidak mirip warna asli.
        </div>
      </Block>
    </>
  );
}

/* ---------- 4. transmisi ---------- */
function VizTransmisi({ t }: { t: Trace }) {
  return (
    <Block title="Yang terjadi pada 16 piksel tadi, dari awal sampai keluar ke jaringan">
      <div className="pv-row pv-row--top">
        <Grid pixels={t.rgb} title="asli" />
        <span className="pv-op">→ chaos →</span>
        <Grid pixels={t.scrambled} title="posisi diacak (warna sama)" />
        <span className="pv-op">→ vigenere →</span>
        <Grid pixels={t.vigenere.cipher} title="dikirim: warna & posisi acak" />
      </div>
      <div className="pv-note">Penyadap hanya melihat kotak paling kanan (48 angka acak). Untuk membaliknya dia butuh x0, r, dan seed yang persis sama.</div>
    </Block>
  );
}

/* ---------- 5. vigenere dekripsi ---------- */
function VizVigDec({ t }: { t: Trace }) {
  const [all, setAll] = useState(false);
  const [allT, setAllT] = useState(false);
  const shown = all ? t.n : 6;
  const shownT = allT ? t.n : 8;
  const seed = t.seed.bytes;

  // trik vektorisasi, kanal R: P[t] = (-1)^t (P0 + S[t]), S[t] = sum_{u=1..t} (-1)^u C[u]
  const C = t.vigenere.cipher.map((p) => p[0]);
  const P0 = mod(C[0] - seed[0]);
  let S = 0;
  const trick = C.map((c, i) => {
    const sign = i % 2 === 0 ? 1 : -1;
    const sc = sign * c;
    if (i > 0) S += sc;
    const raw = sign * (P0 + S);
    return { i, c, sign, sc, S, raw, P: mod(raw), loop: t.scrambled[i][0] };
  });

  return (
    <>
      <Block title="Rumus kebalikan — dan kenapa harus berurutan">
        <Formula>
          <div>plain[i] = (cipher[i] − key[i]) mod 256</div>
          <div>key[i] = seed[i] &nbsp;jika i &lt; L &nbsp;|&nbsp; plain[i − L] &nbsp;← hasil dekripsi sebelumnya</div>
        </Formula>
        <div className="pv-note">Key piksel #p adalah hasil dekripsi piksel #(p−1), jadi secara logika harus dikerjakan satu-satu dari piksel #0:</div>
        <div className="pv-tablewrap">
          <table className="pv-table mono">
            <thead>
              <tr>
                <th>#</th>
                <th>cipher</th>
                <th>− key</th>
                <th>hitungan (R, G, B)</th>
                <th>= plain</th>
              </tr>
            </thead>
            <tbody>
              {t.vigenere.cipher.slice(0, shown).map((ci, p) => {
                const k = t.vigenere.key[p];
                const pl = t.scrambled[p];
                return (
                  <tr key={p}>
                    <td>{p}</td>
                    <td><Swatch p={ci} /></td>
                    <td><Swatch p={k} label={`${p === 0 ? "seed" : `hasil #${p - 1}`} (${k.join(", ")})`} /></td>
                    <td>
                      <div className="pv-calc">
                        {[0, 1, 2].map((c) => {
                          const d = ci[c] - k[c];
                          return (
                            <span key={c} className={d < 0 ? "pv-wrap" : ""} title={d < 0 ? "negatif → ditambah 256" : ""}>
                              <i>{CH[c]}</i> {ci[c]}−{k[c]}={d}→<b>{pl[c]}</b>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td><Swatch p={pl} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <MoreToggle all={all} setAll={setAll} total={t.n} shown={6} />
        <div className="pv-note"><span className="pv-wrap">Oranye</span> = hasil pengurangan negatif, ditambah 256 dulu (mod 256).</div>
      </Block>

      <Block title="Trik supaya cepat: tanpa loop per-piksel (contoh kanal R)">
        <div className="pv-note">
          Loop di atas terlalu lambat untuk {t.capture.total_pixels.toLocaleString("id-ID")} piksel per frame. Untuk satu kanal, rekursinya P[t] = C[t] − P[t−1]. Kalau dijabarkan: P[1] = C[1] − P[0], P[2] = C[2] − C[1] + P[0], P[3] = C[3] − C[2] + C[1] − P[0], ... pola tanda selang-seling itu bisa ditulis sebagai jumlah kumulatif:
        </div>
        <Formula>
          <div>S[t] = Σ (u=1..t) (−1)^u · C[u]</div>
          <div>P[t] = (−1)^t · (P[0] + S[t]) mod 256 &nbsp;dengan P[0] = {C[0]} − {seed[0]} = {P0}</div>
        </Formula>
        <div className="pv-tablewrap">
          <table className="pv-table mono">
            <thead>
              <tr>
                <th>t</th>
                <th>C[t]</th>
                <th>(−1)^t</th>
                <th>(−1)^t·C[t]</th>
                <th>S[t]</th>
                <th>(−1)^t·(P0+S[t])</th>
                <th>mod 256 = P[t]</th>
                <th>cocok loop?</th>
              </tr>
            </thead>
            <tbody>
              {trick.slice(0, shownT).map((r) => (
                <tr key={r.i}>
                  <td>{r.i}</td>
                  <td>{r.c}</td>
                  <td>{r.sign > 0 ? "+1" : "−1"}</td>
                  <td>{r.sc}</td>
                  <td>{r.S}</td>
                  <td className={r.raw < 0 || r.raw > 255 ? "pv-wrap" : ""}>{r.raw}</td>
                  <td><b>{r.P}</b></td>
                  <td className={r.P === r.loop ? "pv-ok" : "pv-bad"}>{r.P === r.loop ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <MoreToggle all={allT} setAll={setAllT} total={t.n} shown={8} />
        <div className="pv-note">
          Di sistem asli L = 25, jadi ada 25 kolom seperti ini sekaligus dan semua jumlah kumulatifnya dihitung satu kali lewat <code>np.cumsum(axis=0)</code>.
        </div>
      </Block>
    </>
  );
}

/* ---------- 6. inverse chaos ---------- */
function VizUnchaos({ t }: { t: Trace }) {
  const { perm, inverse } = t.chaos;
  return (
    <>
      <Block title="Membalik permutasi: inverse[perm[k]] = k">
        <div className="pv-chips">
          {perm.map((src, k) => (
            <div className="pv-chip mono" key={k}>
              <span className="pv-chip-k">k={k}</span>
              <span>perm={src}</span>
              <b>inv[{src}]={k}</b>
            </div>
          ))}
        </div>
        <div className="pv-note">
          Contoh: dulu piksel #{perm[0]} pindah ke posisi 0 (perm[0] = {perm[0]}). Sekarang inverse[{perm[0]}] = 0 artinya &quot;piksel asli #{perm[0]} ada di posisi 0 di frame yang diterima&quot;.
        </div>
      </Block>
      <Block title="Kembalikan tiap piksel: asli[j] = diterima[inverse[j]]">
        <div className="pv-row">
          <ShuffleGrid pixels={t.rgb} inverse={inverse} direction="unscramble" />
          <Formula>
            <div>inverse = [{inverse.join(", ")}]</div>
            <div>Kiri: piksel setelah dekripsi warna (masih acak posisinya). Animasi: tiap piksel kembali ke tempat semula.</div>
          </Formula>
        </div>
      </Block>
    </>
  );
}

/* ---------- 7. verifikasi ---------- */
function VizVerify({ t, metrics }: { t: Trace; metrics: Metrics | null }) {
  const matched = t.diff.filter((d) => d[0] + d[1] + d[2] === 0).length;
  return (
    <Block title="Bandingkan piksel asli vs hasil rekonstruksi: Δ = |asli − hasil|">
      <div className="pv-row pv-row--top">
        <Grid pixels={t.rgb} title="asli" />
        <Grid pixels={t.restored} title="hasil dekripsi" />
        <figure className="pv-fig">
          <div className="pv-grid" style={{ gridTemplateColumns: "repeat(4, 46px)", gridAutoRows: "46px" }}>
            {t.diff.map((d, i) => {
              const sum = d[0] + d[1] + d[2];
              return (
                <div key={i} className={"pv-cell mono " + (sum === 0 ? "pv-cell--ok" : "pv-cell--bad")}>
                  {sum}
                </div>
              );
            })}
          </div>
          <figcaption>Δ per piksel (R+G+B)</figcaption>
        </figure>
      </div>
      <Formula>
        <div>
          piksel cocok = {matched} / {t.n} &nbsp;→&nbsp; {t.roundtrip_ok ? "SEMUA COCOK ✓" : "ADA YANG BEDA ✗"}
        </div>
        <div>
          frame penuh: np.array_equal(asli, hasil) atas {t.capture.total_pixels.toLocaleString("id-ID")} piksel →{" "}
          {metrics ? (metrics.decrypt_ok ? "COCOK" : "GAGAL") : "—"} {metrics ? `(frame ke-${metrics.frame_count})` : ""}
        </div>
      </Formula>
    </Block>
  );
}

/* ---------- entry ---------- */
export default function StepViz({ id, trace, metrics }: { id: string; trace: Trace | null; metrics: Metrics | null }) {
  if (!trace) return <div className="pv-note">Menunggu sampel piksel dari backend (pastikan backend jalan di localhost:8000)…</div>;
  switch (id) {
    case "capture":
      return <VizCapture t={trace} />;
    case "chaos":
      return <VizChaos t={trace} />;
    case "vigenere-enc":
      return <VizVigEnc t={trace} />;
    case "transmisi":
      return <VizTransmisi t={trace} />;
    case "vigenere-dec":
      return <VizVigDec t={trace} />;
    case "unchaos":
      return <VizUnchaos t={trace} />;
    case "verify":
      return <VizVerify t={trace} metrics={metrics} />;
    default:
      return null;
  }
}
