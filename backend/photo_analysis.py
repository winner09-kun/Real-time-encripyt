from pathlib import Path
import cv2
import numpy as np


def compare(original, other):
    delta = original.astype(np.float64) - other.astype(np.float64)
    mse = float(np.mean(delta ** 2))
    return {"mse": mse, "psnr": None if mse == 0 else float(10 * np.log10(255 ** 2 / mse)),
            "changed_percent": float(np.mean(original != other) * 100), "identical": mse == 0}


def entropy(image):
    values = []
    for channel in cv2.split(image):
        counts = np.bincount(channel.ravel(), minlength=256)
        p = counts[counts > 0] / channel.size
        values.append(float(-np.sum(p * np.log2(p))))
    return dict(zip(("B", "G", "R"), values))


def analyze_folder(folder: Path):
    names = sorted({p.name for stage in ("pengirim", "noise", "penerima")
                    for p in (folder / stage).glob("*.png")})
    if not names:
        raise ValueError("Tidak ada PNG pada subfolder pengirim, noise, dan penerima.")
    rows, skipped = [], []
    for name in names:
        paths = [folder / stage / name for stage in ("pengirim", "noise", "penerima")]
        images = [cv2.imdecode(np.fromfile(p, dtype=np.uint8), cv2.IMREAD_COLOR)
                  if p.is_file() and p.stat().st_size else None for p in paths]
        if any(im is None for im in images) or any(im.shape != images[0].shape for im in images if im is not None):
            skipped.append(name)
            continue
        original, noise, received = images
        rows.append({"file": name, "noise": compare(original, noise),
                     "received": compare(original, received), "entropy": entropy(noise)})
    return {"folder": str(folder), "frames": rows, "skipped": skipped,
            "identical_frames": sum(row["received"]["identical"] for row in rows)}
