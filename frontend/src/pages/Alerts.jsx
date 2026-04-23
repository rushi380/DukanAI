import { useEffect, useState } from "react";
import { alertsAPI } from "../utils/api";
import toast from "react-hot-toast";

export default function Alerts() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [customMsg, setCustomMsg] = useState("");

  useEffect(() => {
    alertsAPI.getAll()
      .then(r => setAlerts(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const outOfStock = alerts.filter(a => a.quantity === 0);
  const lowStock   = alerts.filter(a => a.quantity > 0);

  async function sendSummary() {
    setSending(true);
    try { await alertsAPI.sendSummary({}); toast.success("📱 WhatsApp वर पाठवला!"); }
    catch { toast.error("पाठवण्यात चूक"); }
    setSending(false);
  }

  async function sendCustom() {
    if (!customMsg.trim()) return;
    setSending(true);
    try { await alertsAPI.sendCustom(customMsg); toast.success("संदेश पाठवला!"); setCustomMsg(""); }
    catch { toast.error("पाठवण्यात चूक"); }
    setSending(false);
  }

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
          सूचना आणि WhatsApp
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
          कमी साठ्याची माहिती आणि WhatsApp alerts
        </p>
      </div>

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { label: "संपलेले", count: outOfStock.length, color: "var(--red)", bg: "#f5455a18", border: "#f5455a33" },
          { label: "कमी साठा", count: lowStock.length, color: "var(--yellow)", bg: "#f5c84218", border: "#f5c84233" },
          { label: "एकूण सूचना", count: alerts.length, color: "var(--blue)", bg: "#4f9cf918", border: "#4f9cf933" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>

        {/* Alert list */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>कमी आणि संपलेले माल</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{alerts.length} items</span>
          </div>

          {loading && (
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
            </div>
          )}

          {!loading && alerts.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12, color: "var(--green)", opacity: 0.6 }}>✓</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--green)" }}>सर्व माल उपलब्ध आहे!</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>कोणत्याही वस्तूचा साठा कमी नाही</div>
            </div>
          )}

          {!loading && alerts.map(a => {
            const isOut = a.quantity === 0;
            return (
              <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border)", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--bg3)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: isOut ? "#f5455a18" : "#f5c84218",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16,
                }}>
                  {isOut ? "✕" : "!"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                    {a.nameHindi && `${a.nameHindi} · `}
                    {isOut ? "पूर्णपणे संपले आहे" : `फक्त ${a.quantity} ${a.unit} शिल्लक (मर्यादा: ${a.lowStockThreshold})`}
                  </div>
                </div>
                <span className={`badge ${isOut ? "badge-red" : "badge-yellow"}`}>
                  {isOut ? "संपले" : "कमी"}
                </span>
              </div>
            );
          })}
        </div>

        {/* WhatsApp panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Send summary */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>📊 दैनिक सारांश</div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 16, lineHeight: 1.6 }}>
              आजची विक्री, कमी साठा आणि एकूण माल — WhatsApp वर पाठवा
            </div>
            <button onClick={sendSummary} disabled={sending}
              style={{ width: "100%", padding: 12, background: "#25D366", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700 }}>
              {sending ? "पाठवतोय…" : "📱 सारांश पाठवा"}
            </button>
          </div>

          {/* Custom message */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>💬 स्वतःचा संदेश</div>
            <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
              placeholder="पुरवठादाराला किंवा स्वतःला message लिहा…" rows={4}
              style={{ width: "100%", padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, resize: "none", marginBottom: 12, boxSizing: "border-box" }} />
            <button onClick={sendCustom} disabled={sending || !customMsg.trim()}
              style={{ width: "100%", padding: 12, background: !customMsg.trim() ? "var(--border)" : "#25D366", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700 }}>
              {sending ? "पाठवतोय…" : "📤 पाठवा"}
            </button>
          </div>

          {/* Tip card */}
          <div style={{ background: "#4f9cf910", border: "1px solid #4f9cf933", borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)", marginBottom: 6 }}>💡 टीप</div>
            <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.7 }}>
              WhatsApp Sandbox setup केल्यास — जेव्हा एखादा माल संपतो, तेव्हा automatic alert येतो.
              Twilio settings .env मध्ये भरा.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}