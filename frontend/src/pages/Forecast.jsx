import { useEffect, useState } from "react";
import { forecastAPI } from "../utils/api";
import toast from "react-hot-toast";

const RISK_STYLE = {
  "आज-उद्या संपेल": { badge: "badge-red",    color: "var(--red)" },
  "संपले":          { badge: "badge-red",    color: "var(--red)" },
  "लवकर संपेल":     { badge: "badge-yellow", color: "var(--yellow)" },
  "कमी आहे":        { badge: "badge-yellow", color: "var(--yellow)" },
  "ठीक":            { badge: "badge-green",  color: "var(--green)" },
};

export default function Forecast() {
  const [items, setItems]       = useState([]);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState({});
  const [draftMsg, setDraftMsg] = useState(null); // order message being reviewed
  const [busy, setBusy]         = useState(false);

  async function load() {
    try {
      const r = await forecastAPI.get();
      setItems(r.data.data);
      setStats(r.data.stats);
      const pre = {};
      r.data.data.forEach(f => { if (f.shouldOrder) pre[f._id] = true; });
      setSelected(pre);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function toggle(id) { setSelected(s => ({ ...s, [id]: !s[id] })); }

  async function makeDraft() {
    const itemIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (!itemIds.length) { toast.error("किमान एक माल निवडा"); return; }
    setBusy(true);
    try {
      const r = await forecastAPI.draft({ itemIds, horizonDays: 14 });
      if (!r.data.orderMessage) { toast(r.data.message, { icon: "👍" }); return; }
      setDraftMsg(r.data.orderMessage);
      toast.success("ऑर्डर ड्राफ्ट तयार");
    } catch { toast.error("ड्राफ्ट चूक"); }
    setBusy(false);
  }

  async function sendOrder() {
    setBusy(true);
    try {
      const r = await forecastAPI.send({ message: draftMsg });
      r.data.result?.simulated
        ? toast("📱 Simulated — Twilio सेट नाही (backend console पहा)", { icon: "⚠️", duration: 4000 })
        : toast.success(r.data.message);
      setDraftMsg(null);
    } catch { toast.error("पाठवण्यात चूक"); }
    setBusy(false);
  }

  const selCount = Object.values(selected).filter(Boolean).length;

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
          ऑर्डर अंदाज
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
          गेल्या 14 दिवसांच्या विक्रीवरून कोणता माल कधी संपेल — आणि पुरवठादाराला ऑर्डर
        </p>
      </div>

      {/* Summary strip */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { label: "ऑर्डर करायचे", count: stats.toOrderCount, color: "var(--yellow)", bg: "#f5c84218", border: "#f5c84233" },
            { label: "आज-उद्या संपणारे", count: stats.urgentCount, color: "var(--red)", bg: "#f5455a18", border: "#f5455a33" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: draftMsg ? "1fr 400px" : "1fr", gap: 20, alignItems: "start" }}>

        {/* Forecast list */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>अंदाज</span>
            <button onClick={makeDraft} disabled={busy || selCount === 0}
              style={{ padding: "8px 16px", background: selCount ? "#25D366" : "var(--border)", border: "none", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: selCount ? "pointer" : "not-allowed" }}>
              🛒 ऑर्डर ड्राफ्ट ({selCount})
            </button>
          </div>

          {loading && <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
          </div>}

          {!loading && items.map(f => {
            const style = RISK_STYLE[f.risk] || RISK_STYLE["ठीक"];
            return (
              <div key={f._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: "1px solid var(--border)" }}>
                <input type="checkbox" checked={!!selected[f._id]} onChange={() => toggle(f._id)}
                  style={{ width: 16, height: 16, accentColor: "#25D366", cursor: "pointer", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                    साठा: {f.quantity} {f.unit}
                    {f.velocityPerDay > 0 && <> · दर: {f.velocityPerDay}/दिवस · {f.daysLeft !== null ? `${f.daysLeft} दिवस शिल्लक` : ""}</>}
                  </div>
                </div>
                {f.suggestedQty > 0 && (
                  <span style={{ fontSize: 12, color: "#25D366", fontWeight: 600 }}>ऑर्डर: {f.suggestedQty} {f.unit}</span>
                )}
                <span className={`badge ${style.badge}`}>{f.risk}</span>
              </div>
            );
          })}

          {!loading && items.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>📦</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>माल नाही</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>आधी inventory मध्ये माल जोडा</div>
            </div>
          )}
        </div>

        {/* Draft / send panel */}
        {draftMsg && (
          <div style={{ background: "var(--card)", border: "1px solid #25D36666", borderRadius: 14, padding: 20 }} className="fade-in">
            <div style={{ fontSize: 13, fontWeight: 600, color: "#25D366", marginBottom: 12 }}>🛒 ऑर्डर मेसेज — तपासा आणि पाठवा</div>
            <textarea value={draftMsg} onChange={e => setDraftMsg(e.target.value)} rows={12}
              style={{ width: "100%", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={sendOrder} disabled={busy}
                style={{ flex: 1, padding: 12, background: "#25D366", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {busy ? "पाठवतोय…" : "📱 पुरवठादाराला पाठवा"}
              </button>
              <button onClick={() => setDraftMsg(null)}
                style={{ padding: "12px 16px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", fontSize: 13, cursor: "pointer" }}>रद्द</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 10 }}>
              SUPPLIER_WHATSAPP सेट नसल्यास मेसेज मालकाला जाईल.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
