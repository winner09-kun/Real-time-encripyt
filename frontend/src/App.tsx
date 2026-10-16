import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopBar from "./components/TopBar";
import Pengirim from "./pages/Pengirim";
import Noise from "./pages/Noise";
import Penerima from "./pages/Penerima";
import Proses from "./pages/Proses";

function Shell() {
  const location = useLocation();
  return (
    <>
      <TopBar activePath={location.pathname} />
      <Routes>
        <Route path="/" element={<Navigate to="/pengirim" replace />} />
        <Route path="/pengirim" element={<Pengirim />} />
        <Route path="/noise" element={<Noise />} />
        <Route path="/penerima" element={<Penerima />} />
        <Route path="/proses" element={<Proses />} />
        <Route path="*" element={<Navigate to="/pengirim" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
