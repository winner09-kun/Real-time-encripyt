import tempfile
import unittest
from pathlib import Path
import cv2
import numpy as np
from photo_analysis import analyze_folder, compare, entropy


class PhotoAnalysisTests(unittest.TestCase):
    def test_known_metrics(self):
        black = np.zeros((16, 16, 3), dtype=np.uint8)
        white = np.full_like(black, 255)
        self.assertEqual(compare(black, black)["psnr"], None)
        self.assertEqual(compare(black, white)["mse"], 65025)
        self.assertEqual(compare(black, white)["changed_percent"], 100)
        self.assertEqual(compare(black, white)["psnr"], 0)
        self.assertEqual(entropy(black)["R"], 0)
        uniform = np.repeat(np.arange(256, dtype=np.uint8).reshape(16, 16, 1), 3, axis=2)
        self.assertEqual(entropy(uniform)["R"], 8)

    def test_pairs_and_missing_frames(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for stage in ("pengirim", "noise", "penerima"):
                (root / stage).mkdir()
                cv2.imwrite(str(root / stage / "frame_001.png"), np.zeros((4, 4, 3), dtype=np.uint8))
            cv2.imwrite(str(root / "pengirim" / "frame_002.png"), np.zeros((4, 4, 3), dtype=np.uint8))
            result = analyze_folder(root)
            self.assertEqual(result["identical_frames"], 1)
            self.assertEqual(result["skipped"], ["frame_002.png"])
