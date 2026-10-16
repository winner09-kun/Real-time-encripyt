"""
Backend — Sistem Pengamanan Video Real-Time (Kelompok 2)
=========================================================
Menyediakan 3 channel WebSocket video (satu per tahap arsitektur)
dan 1 channel metrik per halaman, sesuai brief UI dashboard monitoring.

Jalankan:
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000

Endpoint:
    ws://localhost:8000/feed/original    -> Pengirim  (video mentah)
    ws://localhost:8000/feed/noise       -> Noise     (hasil chaos+vigenere)
    ws://localhost:8000/feed/decrypted   -> Penerima  (hasil dekripsi, harus = original)
    ws://localhost:8000/metrics/{page}   -> page in {pengirim, noise, penerima, proses}
    GET http://localhost:8000/trace      -> trace mini 4x4 piksel untuk halaman /proses
"""

import asyncio
import base64
import hashlib
import hmac
import secrets
import time
from typing import Literal
from contextlib import asynccontextmanager
from dataclasses import dataclass, field

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from crypto_core import VideoSecurityPipeline
from proses_trace import build_trace

@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(capture_loop())
    yield
    task.cancel()


app = FastAPI(title="Video Security Pipeline — Kelompok 2", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TARGET_WIDTH = 480  # frame di-resize supaya chaos+vigenere sanggup mengejar frame rate
JPEG_QUALITY = 70
X0, R = 0.437, 3.9789
SEED_KEY = b"KELOMPOK2-VIGENERE256-KEY"


@dataclass
class SharedState:
    """State frame terbaru dibagi ke semua koneksi WebSocket yang subscribe."""
    original: np.ndarray | None = None
    noise: np.ndarray | None = None
    decrypted: np.ndarray | None = None
    capture_fps: float = 0.0
    latency_ms: float = 0.0
    key_ready: bool = False
    decrypt_ok: bool = False
    frame_count: int = 0
    raw_size: tuple = (0, 0)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


state = SharedState()
pipeline = VideoSecurityPipeline(x0=X0, r=R, seed_key=SEED_KEY)
passkey_salt = secrets.token_bytes(16)
passkey_digest: bytes | None = None
pair_lock = asyncio.Lock()
sessions: dict[str, float] = {}


class PairRequest(BaseModel):
    role: Literal["pengirim", "penerima"]
    passkey: str = Field(min_length=8, max_length=128)


@app.post("/pair")
async def pair(body: PairRequest):
    global passkey_digest, pipeline
    async with pair_lock:
        if passkey_digest is None and body.role != "pengirim":
            raise HTTPException(409, "Pengirim belum menetapkan passkey.")
        digest = await asyncio.to_thread(
            hashlib.scrypt, body.passkey.encode("utf-8"), salt=passkey_salt,
            n=16384, r=8, p=1, dklen=32,
        )
        if passkey_digest is not None and not hmac.compare_digest(digest, passkey_digest):
            raise HTTPException(401, "Passkey tidak cocok. Masukkan passkey dari pengirim.")
        if passkey_digest is None:
            passkey_digest = digest
            pipeline = VideoSecurityPipeline(x0=X0, r=R, seed_key=digest)
            async with state.lock:
                state.original = state.noise = state.decrypted = None
                state.key_ready = True
        now = time.monotonic()
        for token in list(sessions):
            if sessions[token] <= now:
                del sessions[token]
        token = secrets.token_urlsafe(32)
        sessions[token] = now + 12 * 60 * 60
        return {"token": token}


async def authorize_stream(ws: WebSocket) -> str | None:
    try:
        message = await asyncio.wait_for(ws.receive_json(), timeout=10)
        token = message.get("token") if isinstance(message, dict) else None
        if isinstance(token, str) and sessions.get(token, 0) > time.monotonic():
            return token
    except (asyncio.TimeoutError, WebSocketDisconnect, ValueError):
        pass
    await ws.close(code=4401, reason="Masukkan passkey untuk menghubungkan video.")
    return None


async def capture_loop():
    """Loop tunggal: capture webcam -> chaos+vigenere -> dekripsi balik, ditulis ke SharedState."""
    cap = cv2.VideoCapture(0)
    last_tick = time.time()
    fps_smooth = 0.0

    while True:
        t_start = time.time()
        ok, frame = cap.read() if cap.isOpened() else (False, None)

        if not ok or frame is None:
            # tidak ada kamera fisik di server ini -> pakai synthetic test-pattern
            frame = _synthetic_frame(state.frame_count)

        h, w = frame.shape[:2]
        raw_size = (w, h)
        scale = TARGET_WIDTH / w
        frame = cv2.resize(frame, (TARGET_WIDTH, int(h * scale)))
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        noise_frame = pipeline.encrypt_frame(frame_rgb) if passkey_digest is not None else None
        decrypted_frame = pipeline.decrypt_frame(noise_frame) if noise_frame is not None else None
        decrypt_ok = decrypted_frame is not None and np.array_equal(frame_rgb, decrypted_frame)

        now = time.time()
        instantaneous_fps = 1.0 / max(now - last_tick, 1e-6)
        fps_smooth = fps_smooth * 0.9 + instantaneous_fps * 0.1
        last_tick = now
        latency_ms = (now - t_start) * 1000.0

        async with state.lock:
            state.original = frame_rgb
            state.noise = noise_frame
            state.decrypted = decrypted_frame
            state.capture_fps = fps_smooth
            state.latency_ms = latency_ms
            state.key_ready = passkey_digest is not None
            state.decrypt_ok = decrypt_ok
            state.frame_count += 1
            state.raw_size = raw_size

        await asyncio.sleep(0)  # yield ke event loop


def _synthetic_frame(counter: int) -> np.ndarray:
    """Test-pattern bergerak, dipakai kalau server tidak punya akses webcam fisik."""
    h, w = 360, 480
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    t = counter % w
    frame[:, :, 0] = 30
    frame[:, :, 2] = 40
    cv2.circle(frame, (t, h // 2), 40, (0, 200, 255), -1)
    cv2.putText(frame, "NO CAMERA - SYNTHETIC FEED", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    cv2.putText(frame, f"frame {counter}", (10, h - 15),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1, cv2.LINE_AA)
    return frame


def _encode_jpeg_b64(frame_rgb: np.ndarray) -> str:
    bgr = cv2.cvtColor(frame_rgb, cv2.COLOR_RGB2BGR)
    ok, buf = cv2.imencode(".jpg", bgr, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
    if not ok:
        return ""
    return base64.b64encode(buf).decode("ascii")


async def _stream_endpoint(ws: WebSocket, field_name: str):
    await ws.accept()
    token = None
    if field_name != "noise":
        token = await authorize_stream(ws)
        if token is None:
            return
    try:
        while True:
            if token is not None and sessions.get(token, 0) <= time.monotonic():
                await ws.close(code=4401, reason="Sesi habis. Masukkan passkey kembali.")
                return
            async with state.lock:
                frame = getattr(state, field_name)
            if frame is not None:
                payload = _encode_jpeg_b64(frame)
                if payload:
                    await ws.send_json({"type": "frame", "data": payload})
            await asyncio.sleep(1 / 25)
    except WebSocketDisconnect:
        pass


@app.websocket("/feed/original")
async def feed_original(ws: WebSocket):
    await _stream_endpoint(ws, "original")


@app.websocket("/feed/noise")
async def feed_noise(ws: WebSocket):
    await _stream_endpoint(ws, "noise")


@app.websocket("/feed/decrypted")
async def feed_decrypted(ws: WebSocket):
    await _stream_endpoint(ws, "decrypted")


@app.websocket("/metrics/{page}")
async def metrics(ws: WebSocket, page: str):
    await ws.accept()
    try:
        while True:
            async with state.lock:
                payload = {
                    "type": "metrics",
                    "page": page,
                    "fps": round(state.capture_fps, 1),
                    "latency_ms": round(state.latency_ms, 2),
                    "key_ready": state.key_ready,
                    "decrypt_ok": state.decrypt_ok,
                    "frame_count": state.frame_count,
                    "params": {"x0": X0, "r": R, "iterations": "per-pixel (logistic map)"},
                    "resolution": f"{TARGET_WIDTH}p",
                }
            await ws.send_json(payload)
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass


@app.get("/trace")
async def trace_mini(x: int | None = None, y: int | None = None, acak: bool = False):
    """Trace mini (4x4 piksel) untuk halaman /proses. acak=true -> potongan di posisi acak."""
    async with state.lock:
        # Halaman edukasi publik tidak boleh membocorkan piksel kamera atau kunci sesi.
        frame = cv2.cvtColor(_synthetic_frame(state.frame_count), cv2.COLOR_BGR2RGB)
        raw_size = (480, 360)
    if frame is None:
        raise HTTPException(status_code=503, detail="frame belum tersedia")
    if acak:
        h, w = frame.shape[:2]
        x = int(np.random.randint(0, w - 3))
        y = int(np.random.randint(0, h - 3))
    return build_trace(frame, X0, R, SEED_KEY, raw_size, x, y)


@app.get("/")
async def root():
    return {"status": "ok", "service": "video-security-pipeline-kelompok2"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
