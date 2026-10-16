import type { FeedStatus } from "../hooks/useVideoFeed";
import "./VideoPanel.css";

interface Props {
  status: FeedStatus;
  frameSrc: string | null;
  label: string;
  variant?: "default" | "hazard";
  idleMessage: string;
  errorMessage: string;
}

export default function VideoPanel({
  status,
  frameSrc,
  label,
  variant = "default",
  idleMessage,
  errorMessage,
}: Props) {
  return (
    <div className={"video-panel" + (variant === "hazard" ? " video-panel--hazard" : "")}>
      <div className="video-panel-head">
        <span className="video-panel-label">{label}</span>
        <span className={"video-panel-dot video-panel-dot--" + statusToTone(status)} />
        <span className="video-panel-status mono">{statusToText(status)}</span>
      </div>

      <div className="video-panel-frame">
        {status === "streaming" && frameSrc ? (
          <img src={frameSrc} alt={label} className="video-panel-img" />
        ) : status === "error" ? (
          <div className="video-panel-empty video-panel-empty--error">
            <span className="video-panel-empty-icon">⚠</span>
            <p>{errorMessage}</p>
          </div>
        ) : (
          <div className="video-panel-empty">
            <span className="video-panel-empty-icon">◌</span>
            <p>{idleMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function statusToTone(status: FeedStatus) {
  if (status === "streaming") return "ok";
  if (status === "error") return "err";
  return "warn";
}

function statusToText(status: FeedStatus) {
  switch (status) {
    case "streaming":
      return "LIVE";
    case "error":
      return "TERPUTUS";
    case "connecting":
      return "MENYAMBUNG";
    default:
      return "IDLE";
  }
}
