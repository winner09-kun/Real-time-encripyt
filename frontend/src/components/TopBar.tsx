import { NavLink } from "react-router-dom";
import "./TopBar.css";

const NAV_ITEMS = [
  { to: "/pengirim", label: "Pengirim" },
  { to: "/noise", label: "Noise" },
  { to: "/penerima", label: "Penerima" },
  { to: "/proses", label: "Proses" },
  { to: "/analisa", label: "Analisa Foto" },
];

export default function TopBar({ activePath: _activePath }: { activePath?: string }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-mark">◈</span>
        <span className="topbar-title">SISTEM PENGAMANAN VIDEO REALTIME</span>
        <span className="topbar-subtitle">Kelompok 2 — Chaos + Auto-Key Vigenere 256</span>
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
