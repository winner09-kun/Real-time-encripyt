"""
Trace mini untuk halaman /proses.

Menjalankan algoritma YANG SAMA (kelas di crypto_core.py) pada potongan 4x4 piksel
dari frame live, lalu mengembalikan semua nilai antara supaya frontend bisa
menampilkan hitungannya. Seed key dipendekkan jadi 3 byte (= 1 piksel RGB) supaya
mekanisme auto-key terlihat jelas di 16 piksel.
"""

import numpy as np

from crypto_core import AutoKeyVigenere256, ChaosPermutation

PATCH = 4
MINI_SEED_LEN = 3


def build_trace(frame_rgb, x0, r, seed_key, raw_size, px=None, py=None):
    h, w = frame_rgb.shape[:2]
    px = (w - PATCH) // 2 if px is None else px
    py = (h - PATCH) // 2 if py is None else py
    px = int(max(0, min(px, w - PATCH)))
    py = int(max(0, min(py, h - PATCH)))

    patch = np.ascontiguousarray(frame_rgb[py:py + PATCH, px:px + PATCH])
    n = PATCH * PATCH

    chaos = ChaosPermutation(x0=x0, r=r)
    seq = chaos._sequence(n)
    perm = chaos.permutation(n)
    inverse = np.empty_like(perm)
    inverse[perm] = np.arange(n)
    scrambled = chaos.scramble(patch)

    seed = seed_key[:MINI_SEED_LEN]
    vig = AutoKeyVigenere256(seed)
    cipher = vig.encrypt(scrambled)

    # key stream persis seperti di AutoKeyVigenere256.encrypt
    flat = scrambled.reshape(-1)
    L = len(seed)
    stream = np.empty(flat.size, dtype=np.uint8)
    stream[:L] = np.frombuffer(seed, dtype=np.uint8)
    stream[L:] = flat[: flat.size - L]

    decrypted = vig.decrypt(cipher)
    restored = chaos.unscramble(decrypted)
    diff = np.abs(patch.astype(np.int16) - restored.astype(np.int16))

    def px_list(a):
        return a.reshape(-1, 3).astype(int).tolist()

    return {
        "n": n,
        "patch": {"x": px, "y": py, "size": PATCH},
        "capture": {
            "raw_w": raw_size[0], "raw_h": raw_size[1],
            "target_w": w, "target_h": h,
            "total_pixels": w * h, "total_bytes": w * h * 3,
        },
        "x0": x0, "r": r,
        "seed": {"text": seed.decode("latin-1"), "bytes": list(seed)},
        "rgb": px_list(patch),
        "chaos": {"x": seq.tolist(), "perm": perm.tolist(), "inverse": inverse.tolist()},
        "scrambled": px_list(scrambled),
        "vigenere": {"key": px_list(stream), "cipher": px_list(cipher)},
        "decrypted": px_list(decrypted),
        "restored": px_list(restored),
        "diff": px_list(diff),
        "roundtrip_ok": bool(np.array_equal(patch, restored)),
    }
