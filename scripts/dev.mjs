import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const python = path.join(root, "backend", "venv", windows ? "Scripts/python.exe" : "bin/python");
const vite = path.join(root, "frontend/node_modules/vite/bin/vite.js");

if (!existsSync(python) || !existsSync(vite)) {
  console.error("Dependensi belum siap. Buat backend/venv dan instal requirements.txt, lalu jalankan npm install di folder frontend. Lihat README.md.");
  process.exit(1);
}

const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid || child.exitCode !== null) continue;
    if (windows) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      try { process.kill(-child.pid, "SIGTERM"); } catch { /* Already stopped. */ }
    }
  }
  process.exit(code);
}

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd: path.join(root, cwd),
    stdio: "inherit",
    windowsHide: true,
    detached: !windows,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} gagal dijalankan: ${error.message}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${name} berhenti. Menghentikan server lainnya.`);
      stop(code ?? 1);
    }
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

console.log("Menjalankan backend :8000 dan frontend :3000. Tekan Ctrl+C untuk menghentikan keduanya.");
start("Backend", python, ["-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"], "backend");
start("Frontend", process.execPath, [vite, "--port", "3000", "--strictPort"], "frontend");
