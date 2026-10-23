import asyncio
import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import cv2
import numpy as np
from fastapi import HTTPException
import main


class CaptureTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        main.sessions.clear()
        main.capture_lock = asyncio.Lock()
        main.state = main.SharedState()
        self.frame = np.arange(144, dtype=np.uint8).reshape(6, 8, 3)
        self.encoder = main.VideoSecurityPipeline(seed_key=b"password123")
        main.state.original = self.frame
        main.state.noise = self.encoder.encrypt_frame(self.frame)
        main.state.frame_count = 42

    def connect(self, key=b"password123", role="penerima", expires=None):
        main.sessions["test"] = main.Session(
            expires if expires is not None else time.monotonic() + 60,
            role, main.VideoSecurityPipeline(seed_key=key))
        return main.CaptureRequest(token="test")

    async def test_capture_saves_24_synchronized_lossless_triples(self):
        for key, matches in ((b"password123", True), (b"incorrect123", False)):
            with self.subTest(matches=matches), tempfile.TemporaryDirectory() as temp:
                request = self.connect(key)
                with patch.object(main, "CAPTURE_ROOT", Path(temp)):
                    result = await main.capture_frames(request)
                folder = Path(result["folder"])
                self.assertEqual(result["total_images"], 72)
                for stage in ("pengirim", "noise", "penerima"):
                    self.assertEqual(len(list((folder / stage).glob("*.png"))), 24)
                for index in (1, 24):
                    def read(stage):
                        return cv2.cvtColor(cv2.imread(str(folder / stage / f"frame_{index:03d}.png")), cv2.COLOR_BGR2RGB)
                    np.testing.assert_array_equal(read("pengirim"), self.frame)
                    np.testing.assert_array_equal(read("noise"), main.state.noise)
                    np.testing.assert_array_equal(read("penerima"), main.sessions["test"].decoder.decrypt_frame(read("noise")))
                    self.assertEqual(np.array_equal(read("penerima"), self.frame), matches)
                metadata = json.loads((folder / "metadata.json").read_text())
                self.assertEqual(len(metadata["frames"]), 24)
                self.assertTrue(all(item["source_frame"] == 42 for item in metadata["frames"]))
                self.assertTrue(all(item["decrypt_ok"] == matches for item in metadata["frames"]))

    async def test_invalid_or_expired_sessions_cannot_capture(self):
        for request in (main.CaptureRequest(token="missing"), self.connect(role="pengirim")):
            with self.assertRaises(HTTPException) as error:
                await main.capture_frames(request)
            self.assertEqual(error.exception.status_code, 401)
        with self.assertRaises(HTTPException) as error:
            await main.capture_frames(self.connect(expires=0))
        self.assertEqual(error.exception.status_code, 401)

    async def test_missing_frames_and_busy_capture(self):
        request = self.connect()
        async with main.capture_lock:
            with self.assertRaises(HTTPException) as error:
                await main.capture_frames(request)
            self.assertEqual(error.exception.status_code, 409)
        main.state.noise = None
        with self.assertRaises(HTTPException) as error:
            await main.capture_frames(request)
        self.assertEqual(error.exception.status_code, 409)
        self.assertFalse(main.capture_lock.locked())


if __name__ == "__main__":
    unittest.main()
