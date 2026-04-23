import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import VoiceInput from "./pages/VoiceInput";
import Inventory from "./pages/Inventory";
import BillScan from "./pages/BillScan";
import Alerts from "./pages/Alerts";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/voice" element={<VoiceInput />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/bill" element={<BillScan />} />
          <Route path="/alerts" element={<Alerts />} />
        </Route>
      </Routes>
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            background: "#1a1d27",
            color: "#e2e8f0",
            border: "1px solid #2a2d3e",
            fontFamily: "'Noto Sans Devanagari', sans-serif",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#00c896", secondary: "#000" } },
          error: { iconTheme: { primary: "#f54255", secondary: "#fff" } },
        }}
      />
    </BrowserRouter>
  );
}
