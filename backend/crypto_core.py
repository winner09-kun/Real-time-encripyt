"""
Chaos Transformation + Auto-Key Vigenere 256
=============================================
Implementasi sesuai arsitektur Kelompok 2:

Pengirim:
  Ekstraksi Frame (Piksel) -> Pengacakan Spasial (Chaos)
  -> Enkripsi Nilai Warna (Vigenere 256) -> Frame Terenkripsi (Noise)

Penerima (kebalikan urutan):
  Terima Stream -> Dekripsi Nilai Warna (Vigenere 256)
  -> Deskripsi Spasial (Inverse Chaos) -> Rekonstruksi Frame (Piksel)
"""

import numpy as np


class ChaosPermutation:
    """
    Menghasilkan permutasi posisi piksel dari logistic map:
        x_{n+1} = r * x_n * (1 - x_n)

    Urutan nilai chaos yang dihasilkan diurutkan (argsort) untuk
    membentuk permutasi indeks yang deterministik terhadap (x0, r).
    """

    def __init__(self, x0: float = 0.437, r: float = 3.9789):
        self.x0 = x0
        self.r = r
        self._cache = {}

    def _sequence(self, n: int) -> np.ndarray:
        x = self.x0
        seq = np.empty(n, dtype=np.float64)
        for i in range(n):
            x = self.r * x * (1.0 - x)
            seq[i] = x
        return seq

    def permutation(self, n: int) -> np.ndarray:
        """Permutasi indeks 0..n-1 (di-cache per ukuran frame)."""
        if n not in self._cache:
            seq = self._sequence(n)
            self._cache[n] = np.argsort(seq)
        return self._cache[n]

    def scramble(self, frame: np.ndarray) -> np.ndarray:
        h, w, c = frame.shape
        flat = frame.reshape(-1, c)
        perm = self.permutation(flat.shape[0])
        scrambled = flat[perm]
        return scrambled.reshape(h, w, c)

    def unscramble(self, frame: np.ndarray) -> np.ndarray:
        h, w, c = frame.shape
        flat = frame.reshape(-1, c)
        perm = self.permutation(flat.shape[0])
        inverse = np.empty_like(perm)
        inverse[perm] = np.arange(perm.shape[0])
        original = flat[inverse]
        return original.reshape(h, w, c)


class AutoKeyVigenere256:
    """
    Auto-Key Vigenere atas byte 0..255 (nilai warna RGB).
    Key stream awal berasal dari `seed_key`; setelah key awal habis,
    key stream dilanjutkan dari byte PLAINTEXT itu sendiri (auto-key),
    sehingga key tidak pernah berulang secara periodik.
    """

    def __init__(self, seed_key: bytes):
        if not seed_key:
            raise ValueError("seed_key tidak boleh kosong")
        self.seed_key = np.frombuffer(seed_key, dtype=np.uint8)

    def encrypt(self, plain: np.ndarray) -> np.ndarray:
        """cipher[i] = plain[i] + key[i] (mod 256), key[i] = seed[i] atau plain[i-L] (auto-key)."""
        flat = plain.reshape(-1).astype(np.uint8)
        n = flat.shape[0]
        L = self.seed_key.shape[0]
        k = min(L, n)
        stream = np.empty(n, dtype=np.uint8)
        stream[:k] = self.seed_key[:k]
        if n > L:
            stream[L:] = flat[: n - L]
        cipher = ((flat.astype(np.uint16) + stream.astype(np.uint16)) % 256).astype(np.uint8)
        return cipher.reshape(plain.shape)

    def decrypt(self, cipher: np.ndarray) -> np.ndarray:
        """
        plain[i] = cipher[i] - key[i] (mod 256), key[i] = seed[i] atau plain[i-L].
        Rekursi plain[i] = cipher[i] - plain[i-L] pada tiap kelas residu (mod L)
        adalah rekursi alternating-sign yang bisa diselesaikan lewat cumulative
        sum bertanda, sehingga seluruh frame didekripsi tanpa loop per-piksel
        (perlu untuk throughput real-time).
        """
        flat = cipher.reshape(-1).astype(np.int32)
        n = flat.shape[0]
        L = self.seed_key.shape[0]
        plain = np.empty(n, dtype=np.uint8)

        k = min(L, n)
        plain0 = ((flat[:k] - self.seed_key[:k].astype(np.int32)) % 256).astype(np.uint8)
        plain[:k] = plain0
        if n <= L:
            return plain.reshape(cipher.shape)

        rest_len = n - L
        T = rest_len // L + 1  # jumlah baris (t=0..T-1) yang bisa dibentuk penuh
        full_len = T * L
        C = flat[:full_len].reshape(T, L)  # C[t, r] = cipher[t*L + r]

        t_idx = np.arange(T).reshape(-1, 1)
        sign = np.where(t_idx % 2 == 0, 1, -1)  # (-1)^t per baris
        signedC = (sign * C).astype(np.int64)
        S = np.cumsum(signedC, axis=0) - signedC[0]  # S[0]=0, S[t]=sum_{u=1..t} (-1)^u C[u]

        P0 = plain0.astype(np.int64).reshape(1, -1)
        P = (sign * (P0 + S)) % 256  # P[t, r] = plain[t*L + r]
        plain[:full_len] = P.astype(np.uint8).reshape(-1)

        # sisa elemen ekor (< L) di luar grid penuh, diselesaikan langsung
        for i in range(full_len, n):
            plain[i] = np.uint8((int(flat[i]) - int(plain[i - L])) % 256)

        return plain.reshape(cipher.shape)


class VideoSecurityPipeline:
    def __init__(self, x0: float = 0.437, r: float = 3.9789, *, seed_key: bytes):
        self.chaos = ChaosPermutation(x0=x0, r=r)
        self.vigenere = AutoKeyVigenere256(seed_key)
        self.x0 = x0
        self.r = r

    def encrypt_frame(self, frame: np.ndarray) -> np.ndarray:
        scrambled = self.chaos.scramble(frame)
        return self.vigenere.encrypt(scrambled)

    def decrypt_frame(self, noise_frame: np.ndarray) -> np.ndarray:
        color_decrypted = self.vigenere.decrypt(noise_frame)
        return self.chaos.unscramble(color_decrypted)
