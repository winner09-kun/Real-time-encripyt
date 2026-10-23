# Sistem Pengamanan Video Real-Time — Dashboard Monitoring (Kelompok 2)

Dashboard 3 halaman (`/pengirim`, `/noise`, `/penerima`) untuk demo enkripsi
video real-time (Chaos Transformation + Auto-Key Vigenere 256) ke dosen.

## Struktur

```
backend/    FastAPI + OpenCV — capture webcam, enkripsi/dekripsi, 3 channel WebSocket
frontend/   React + Vite + TypeScript + React Router — 3 halaman + top bar bersama
```

## Menjalankan dari satu terminal

Setelah dependensi backend dan frontend terpasang (langkah di bawah), jalankan
dari folder utama `video-dashboard`:

```bash
npm run dev
```

Perintah ini menjalankan backend dan frontend sekaligus. Buka
`http://localhost:3000/pengirim`. Tekan **Ctrl+C** untuk menghentikan keduanya.
Tidak perlu `npm install` di folder utama; launcher memakai Node.js tanpa
dependensi tambahan. Matikan server yang sebelumnya berjalan di terminal lain
agar port 8000 dan 3000 tersedia.

## Menyiapkan backend / menjalankan terpisah

Di Windows PowerShell, instal dependensi sekali:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
cd frontend
npm install
cd ..
```

Untuk menjalankan backend secara terpisah, atau menyiapkannya di macOS/Linux:

```bash
cd backend
python3 -m venv venv && source venv/bin/activate   # opsional tapi disarankan
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend mencoba membuka kamera `0`. Kalau tidak ada kamera fisik yang
terdeteksi di komputer yang menjalankan backend, backend otomatis memakai
synthetic test-pattern bergerak supaya UI tetap bisa didemo end-to-end.

## Menjalankan frontend

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:3000/pengirim`, lalu buka 2 tab lagi untuk `/noise`
dan `/penerima` — semuanya dari 1 dev server yang sama (`localhost:3000`),
sesuai brief (3 route, 3 tab, 1 server).

Jika backend tidak jalan di `localhost:8000`, set env var sebelum `npm run dev`:

```bash
VITE_WS_BASE=ws://ALAMAT_BACKEND:8000 npm run dev
```

## Menghubungkan dengan passkey

1. Buka `/pengirim`, masukkan passkey 8–128 karakter, lalu klik **Aktifkan pengirim**.
2. Buka `/penerima`, masukkan passkey yang sama, lalu klik **Hubungkan penerima**.
3. Di penerima, passkey yang salah tetap dipakai untuk dekripsi: hasil yang rusak/noise tetap tampil dengan status **GAGAL DEKRIPSI**. Klik **Ganti passkey** untuk mencoba lagi. Setiap penerima memakai kuncinya sendiri.

Passkey pertama berlaku untuk satu sesi server. Pengirim berikutnya harus memakai
passkey yang sama; restart backend untuk menetapkan passkey baru. Token akses berlaku
12 jam dan hanya disimpan dalam memori halaman, sehingga setelah refresh atau pindah
halaman pengguna memasukkan passkey lagi. Passkey tidak disimpan di browser.
Seed key enkripsi video adalah passkey yang dikodekan langsung ke byte UTF-8
(`seed_key = passkey.encode("utf-8")`). Scrypt dan salt acak hanya dipakai untuk
memverifikasi passkey saat menghubungkan pengirim. Penerima tidak ditolak karena
kuncinya berbeda; status kecocokan dihitung dari frame hasil dekripsi penerima.
Token penerima tidak dapat membuka feed asli pengirim. Ini password bersama
untuk demo, bukan passkey WebAuthn. Untuk akses jaringan, gunakan HTTPS/WSS.
Algoritma Chaos/Vigenere tetap merupakan algoritma demonstrasi.

## Yang perlu diketahui sebelum presentasi

### Capture frame 1 detik

Di halaman **Penerima**, hubungkan passkey lalu klik **Capture 1 detik · 24 frame**.
Satu klik menyimpan ketiga tahap serentak ke `captures/<waktu-UTC>_<id>/` pada
komputer backend: subfolder `pengirim`, `noise`, dan `penerima`, masing-masing
24 PNG (72 gambar total). Nomor file yang sama berasal dari frame sumber yang sama.
PNG mempertahankan nilai piksel tanpa kompresi lossy. Hasil penerima menggunakan
passkey yang aktif saat tombol ditekan, termasuk hasil rusak jika key salah.

Capture mengambil sampel selama 1 detik pada target 24 FPS; FPS kamera aktual
bisa berbeda. Jika sumber lebih lambat, frame bisa berulang. `metadata.json`
mencatat nomor frame sumber, waktu sampling aktual, dan kecocokan dekripsi.
Setiap capture membuat folder baru; folder hasil tidak dimasukkan ke Git.

- Karena demo berjalan di 1 laptop lewat `localhost`, frame di `/noise` dan
  data yang "diterima" di `/penerima` secara data identik — tidak ada
  transformasi jaringan yang sesungguhnya terjadi. Halaman `/noise` sudah
  menampilkan catatan ini secara eksplisit ke dosen.
- Parameter chaos (`x0`, `r`) ada di `backend/main.py` (`X0`, `R`).
  Kunci Vigenere video sama dengan byte UTF-8 passkey; `DEMO_SEED_KEY` hanya untuk sampel edukasi.
- `crypto_core.py` sudah diverifikasi round-trip (`encrypt_frame` →
  `decrypt_frame` menghasilkan frame identik) dan divektorisasi dengan
  NumPy supaya sanggup mengejar frame rate real-time (bukan loop
  per-piksel di Python).

## Halaman /proses

Tiap tahap pipeline bisa dibuka dan menampilkan hitungan + gambaran piksel dari
**sampel 4×4 piksel pola demo sintetis**, dihitung backend lewat `GET /trace`
(`backend/proses_trace.py`, memakai kelas yang sama dengan `crypto_core.py`).
Seed key dipendekkan jadi 3 byte di sampel supaya auto-key terlihat di 16 piksel.
Endpoint publik ini tidak menampilkan piksel kamera atau kunci sesi aktif.

Tes backend: jalankan `python -m unittest test_passkey -v` dari folder `backend`.
Scrollbar halaman ini disembunyikan (scroll tetap jalan dengan mouse/trackpad).
