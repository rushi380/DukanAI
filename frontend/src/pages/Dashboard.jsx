import { useEffect, useState } from "react";
import { itemsAPI, alertsAPI } from "../utils/api";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const SOURCE_COLOR = { voice:"#10d9a0", bill:"#4f9cf9", manual:"#5c6280", whatsapp:"#f5c842" };
const ACTION_LABEL = { sale:"विकले", restock:"आले", manual_update:"बदलले", bill_scan:"बिल स्कॅन" };

function StatCard({ label, value, color, sub, icon, loading, onClick }) {
  if (loading) return (
    <div className="skeleton" style={{ height: 110, borderRadius: 14 }} />
  );
  return (
    <div onClick={onClick} style={{
      background: "var(--card)", border: "1px solid var(--border)",
      borderRadius: 14, padding: "18px 20px", cursor: onClick ? "pointer" : "default",
      borderTop: `2px solid ${color}`,
      transition: "border-color 0.2s, transform 0.15s",
      position: "relative", overflow: "hidden",
    }}
    onMouseEnter={e => onClick && (e.currentTarget.style.transform = "translateY(-2px)")}
    onMouseLeave={e => onClick && (e.currentTarget.style.transform = "none")}
    >
      <div style={{ position: "absolute", top: 16, right: 16, fontSize: 18, opacity: 0.15 }}>{icon}</div>
      <div style={{ fontSize: 11, color: "var(--text2)", fontWeight: 500, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</div>
      <div className="stat-num" style={{ color, marginBottom: 6 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "var(--text3)" }}>{sub}</div>
    </div>
  );
}

function ActivityRow({ log }) {
  const color = SOURCE_COLOR[log.source] || "#5c6280";
  const isNeg = log.quantityChanged < 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.itemName}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, display: "flex", gap: 6 }}>
            <span style={{ color }}>{log.source}</span>
            <span>·</span>
            <span>{new Date(log.createdAt).toLocaleTimeString("mr-IN", { hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: isNeg ? "var(--red)" : "var(--green)" }}>
          {log.quantityChanged > 0 ? "+" : ""}{log.quantityChanged}
        </div>
        <div style={{ fontSize: 10, color: "var(--text3)" }}>{ACTION_LABEL[log.action] || log.action}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [logs, setLogs]     = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const nav = useNavigate();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, l, a] = await Promise.all([
        itemsAPI.getStats(), itemsAPI.getLogs(), alertsAPI.getAll(),
      ]);
      setStats(s.data.data); setLogs(l.data.data); setAlerts(a.data.data);
    } catch { setError("Backend ला connect होत नाही — server चालू आहे का?"); }
    setLoading(false);
  }

  async function sendSummary() {
    try { await alertsAPI.sendSummary({ todaySales: stats?.todaySales || 0 }); toast.success("📱 WhatsApp वर पाठवला!"); }
    catch { toast.error("पाठवण्यात चूक"); }
  }

  const hour = new Date().getHours();
  const greet = hour < 12 ? "सुप्रभात" : hour < 17 ? "नमस्कार" : "शुभसंध्या";

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {error && (
        <div style={{ background: "#f5455a18", border: "1px solid #f5455a44", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "var(--red)", fontSize: 13 }}>⚠ {error}</span>
          <button onClick={load} style={{ background: "transparent", border: "1px solid var(--red)", color: "var(--red)", padding: "5px 14px", borderRadius: 7, fontSize: 12 }}>
            पुन्हा प्रयत्न
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>
            {greet}, दुकानदार! 🙏
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)", margin: "5px 0 0" }}>
            {new Date().toLocaleDateString("mr-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={{ padding: "8px 14px", background: "var(--card)", border: "1px solid var(--border)", color: "var(--text2)", borderRadius: 9, fontSize: 13 }}>
            ↻
          </button>
          <button onClick={sendSummary} style={{ padding: "8px 16px", background: "#25D36618", border: "1px solid #25D36644", color: "#25D366", borderRadius: 9, fontSize: 13, fontWeight: 600 }}>
            📱 WhatsApp
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid-4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard label="एकूण माल" value={stats?.total}     color="#4f9cf9" icon="◻" sub="सर्व उत्पादने"  loading={loading} onClick={() => nav("/inventory")} />
        <StatCard label="उपलब्ध"   value={stats?.inStock}   color="#10d9a0" icon="✓" sub="साठ्यात आहे"  loading={loading} onClick={() => nav("/inventory")} />
        <StatCard label="कमी साठा" value={stats?.lowStock}  color="#f5c842" icon="!" sub="लवकर मागवा"  loading={loading} onClick={() => nav("/alerts")} />
        <StatCard label="संपले"    value={stats?.outOfStock} color="#f5455a" icon="✕" sub="आत्ता मागवा" loading={loading} onClick={() => nav("/alerts")} />
      </div>

      {/* Value strip */}
      {stats && !loading && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 20px", marginBottom: 24, display: "flex", gap: 28, flexWrap: "wrap" }}>
          {[
            { label: "एकूण साठ्याचे मूल्य", value: `₹${(stats.totalValue || 0).toLocaleString("en-IN")}`, color: "var(--text)" },
            { label: "आजची विक्री", value: `${stats.todaySales || 0} वस्तू`, color: "var(--green)" },
            { label: "सूचना", value: `${alerts.length} items`, color: alerts.length > 0 ? "var(--red)" : "var(--green)" },
          ].map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two column */}
      <div className="grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

        {/* Activity */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>अलीकडील हालचाल</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{logs.length} entries</span>
          </div>
          {loading && [1,2,3,4,5].map(i => (
            <div key={i} className="skeleton" style={{ height: 36, marginBottom: 8, borderRadius: 8 }} />
          ))}
          {!loading && logs.length === 0 && (
            <div style={{ color: "var(--text3)", fontSize: 13, textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.3 }}>◈</div>
              अजून काही हालचाल नाही
            </div>
          )}
          {!loading && logs.slice(0, 8).map((log, i) => <ActivityRow key={i} log={log} />)}
        </div>

        {/* Alerts */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>⚠ सूचना</span>
            {alerts.length > 0 && (
              <span className="badge badge-red">{alerts.length}</span>
            )}
          </div>
          {loading && [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8, borderRadius: 8 }} />)}
          {!loading && alerts.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
              <div style={{ color: "var(--green)", fontSize: 13, fontWeight: 600 }}>सर्व ठीक आहे!</div>
              <div style={{ color: "var(--text3)", fontSize: 12, marginTop: 4 }}>सर्व माल उपलब्ध आहे</div>
            </div>
          )}
          {!loading && alerts.map(a => (
            <div key={a._id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: a.quantity === 0 ? "var(--red)" : "var(--yellow)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{a.name}</div>
                {a.nameHindi && <div style={{ fontSize: 11, color: "var(--text3)" }}>{a.nameHindi}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.quantity === 0 ? "var(--red)" : "var(--yellow)" }}>
                  {a.quantity} {a.unit}
                </div>
                <div style={{ fontSize: 10, color: "var(--text3)" }}>{a.status}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 20 }}>
        {[
          { icon: "◉", label: "आवाजाने साठा बदला", desc: "बोला — AI समजेल", color: "#4f9cf9", path: "/voice" },
          { icon: "◈", label: "बिल स्कॅन करा", desc: "फोटो → साठा जोडा", color: "#a78bfa", path: "/bill" },
          { icon: "▦", label: "मालाची यादी", desc: "CRUD + voice add", color: "#f5c842", path: "/inventory" },
        ].map(q => (
          <div key={q.path} onClick={() => nav(q.path)}
            style={{ background: "var(--card)", border: `1px solid ${q.color}33`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", transition: "border-color 0.2s, transform 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = q.color + "66"; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = q.color + "33"; e.currentTarget.style.transform = "none"; }}>
            <div style={{ fontSize: 20, color: q.color, marginBottom: 8 }}>{q.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{q.label}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{q.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}