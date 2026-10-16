import unittest
import numpy as np
from fastapi import HTTPException
from pydantic import ValidationError
import main


class Socket:
    def __init__(self, message):
        self.message = message
        self.closed = None

    async def receive_json(self):
        return self.message

    async def close(self, code, reason):
        self.closed = code


class PasskeyTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        main.passkey_digest = None
        main.pipeline = None
        main.sessions.clear()

    async def test_pairing_and_video_key(self):
        with self.assertRaises(HTTPException) as error:
            await main.pair(main.PairRequest(role="penerima", passkey="password123"))
        self.assertEqual(error.exception.status_code, 409)
        sender = await main.pair(main.PairRequest(role="pengirim", passkey="password123"))
        self.assertEqual(main.pipeline.vigenere.seed_key.tobytes(), b"password123")
        original_key = main.passkey_digest
        for role in ("pengirim", "penerima"):
            with self.assertRaises(HTTPException) as error:
                await main.pair(main.PairRequest(role=role, passkey="incorrect123"))
            self.assertEqual(error.exception.status_code, 401)
            self.assertEqual(main.passkey_digest, original_key)
        receiver = await main.pair(main.PairRequest(role="penerima", passkey="password123"))
        self.assertNotEqual(sender["token"], receiver["token"])
        self.assertEqual(await main.authorize_stream(Socket(receiver)), receiver["token"])
        for message in ({}, {"token": "invalid"}, {"token": []}, []):
            socket = Socket(message)
            self.assertIsNone(await main.authorize_stream(socket))
            self.assertEqual(socket.closed, 4401)
        main.sessions[receiver["token"]] = 0
        self.assertIsNone(await main.authorize_stream(Socket(receiver)))
        frame = np.arange(144, dtype=np.uint8).reshape(6, 8, 3)
        cipher = main.pipeline.encrypt_frame(frame)
        np.testing.assert_array_equal(main.pipeline.decrypt_frame(cipher), frame)
        self.assertFalse(np.array_equal(cipher, frame))

    async def test_trace_uses_demo_not_camera(self):
        main.state.original = np.full((360, 480, 3), 123, dtype=np.uint8)
        trace = await main.trace_mini()
        self.assertFalse(all(pixel == [123, 123, 123] for pixel in trace["rgb"]))

    async def test_utf8_passkey_is_encryption_seed(self):
        passkey = "kunci-rahasia-🔑"
        await main.pair(main.PairRequest(role="pengirim", passkey=passkey))
        self.assertEqual(main.pipeline.vigenere.seed_key.tobytes(), passkey.encode("utf-8"))
        frame = np.arange(144, dtype=np.uint8).reshape(6, 8, 3)
        receiver = main.VideoSecurityPipeline(seed_key=passkey.encode("utf-8"))
        cipher = main.pipeline.encrypt_frame(frame)
        np.testing.assert_array_equal(receiver.decrypt_frame(cipher), frame)
        wrong_receiver = main.VideoSecurityPipeline(seed_key=b"wrong-passkey")
        self.assertFalse(np.array_equal(wrong_receiver.decrypt_frame(cipher), frame))

    def test_pipeline_requires_explicit_seed(self):
        with self.assertRaises(TypeError):
            main.VideoSecurityPipeline()

    def test_short_passkey_rejected(self):
        with self.assertRaises(ValidationError):
            main.PairRequest(role="pengirim", passkey="short")


if __name__ == "__main__":
    unittest.main()
