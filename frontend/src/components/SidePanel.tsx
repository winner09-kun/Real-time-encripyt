import type { ReactNode } from "react";
import "./SidePanel.css";

export default function SidePanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="side-panel">
      <div className="side-panel-title">{title}</div>
      <div className="side-panel-body">{children}</div>
    </div>
  );
}
