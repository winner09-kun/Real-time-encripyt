import { NavLink } from "react-router-dom";
import "./TopBar.css";

type StageKey = "chaos" | "vigenere" | "noise" | "transmisi" | "dekripsi";

const STAGES: { key: StageKey; label: string }[] = [
  { key: "chaos", label: "Chaos" },
  { key: "vigenere", label: "Vigenere" },
  { key: "noise", label: "Noise" },
  { key: "transmisi", label: "Transmisi" },
  { key: "dekripsi", label: "Dekripsi" },
];

const ACTIVE_BY_ROUTE: Record<string, StageKey[]> = {
  "/pengirim": ["chaos", "vigenere"],
  "/noise": ["noise", "transmisi"],
  "/penerima": ["dekripsi"],
};

const NAV_ITEMS = [
  { to: "/pengirim", label: "Pengirim" },
  { to: "/noise", label: "Noise" },
  { to: "/penerima", label: "Penerima" },
  { to: "/proses", label: "Proses" },
];

export default function TopBar({ activePath }: { activePath: string }) {
  const activeStages = ACTIVE_BY_ROUTE[activePath] ?? [];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-mark">◈</span>
        <span className="topbar-title">SISTEM PENGAMANAN VIDEO REALTIME</span>
        <span className="topbar-subtitle">Kelompok 2 — Chaos + Auto-Key Vigenere 256</span>
      </div>

      <div className="topbar-strip" aria-hidden="true">
        {STAGES.map((stage, i) => (
          <span className="strip-item" key={stage.key}>
            <span
              className={
                "strip-dot" + (activeStages.includes(stage.key) ? " strip-dot--active" : "")
              }
            />
            <span className="strip-label">{stage.label}</span>
            {i < STAGES.length - 1 && <span className="strip-connector" />}
          </span>
        ))}
      </div>

      <nav className="topbar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => "topbar-navlink" + (isActive ? " topbar-navlink--active" : "")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
