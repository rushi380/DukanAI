import { useEffect, useState } from "react";
import { useVoice } from "../hooks/useVoice";
import { creditAPI } from "../utils/api";
import toast from "react-hot-toast";

const fmt = n => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function Udhaar() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(true);

  const [text, setText]       = useState("");
  const [parsing, setParsing] = useState(false);
  const [draft, setDraft]     = useState(null); // editable confirmation card

  const [openLogs, setOpenLogs] = useState(null);
  const [logs, setLogs]         = useState([]);

  async function load() {
    try {
      const r = await creditAPI.list();
      setCustomers(r.data.data);
      setStats(r.data.stats);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function handleParse(t) {
    setParsing(true);
    try {
      const r = await creditAPI.parse(t);
      if (!r.data.parsed || (!r.data.parsed.amount && !r.data.parsed.customerName)) {
        toast.error("समजले नाही — उदा: “शर्मा काकांनी 500 चा माल घेतला”");
      } else {
        setDraft({
          customerName: r.data.matchedCustomer?.name || r.data.parsed.customerName || "",
          type: r.data.parsed.type || "udhaar",
          amount: r.data.parsed.amount || "",
          note: r.data.parsed.note || "",
          candidates: r.data.candidates || [],
          rawText: t,
        });
      }
    } catch { toast.error("काहीतरी चुकले"); }
    setParsing(false);
  }

  const { listening, transcript, interimTranscript, startListening, stopListening } = useVoice({
    onResult: handleParse, lang: "mr-IN",
  });

  async function saveDraft() {
    if (!draft.customerName.trim() || !draft.amount) { toast.error("नाव आणि रक्कम आवश्यक"); return; }
    try {
      const r = await creditAPI.entry({
        customerName: draft.customerName.trim(),
        type: draft.type,
        amount: parseFloat(draft.amount),
        note: draft.note,
        source: "voice",
        rawVoiceText: draft.rawText,
      });
      toast.success(r.data.message);
      setDraft(null);
      setText("");
      load();
    } catch (e) { toast.error(e.response?.data?.message || "नोंद चूक"); }
  }

  async function remind(c) {
    try {
      const r = await creditAPI.remind(c._id);
      r.data.result?.simulated ? toast("📱 Simulated — Twilio सेट नाही", { icon: "⚠️" }) : toast.success("स्मरण पाठवले!");
    } catch (e) { toast.error(e.response?.data?.message || "चूक"); }
  }

  async function settle(c) {
    try {
      const r = await creditAPI.settle(c._id);
      toast.success(r.data.message);
      load();
    } catch (e) { toast.error(e.response?.data?.message || "चूक"); }
  }

  async function toggleLogs(c) {
    if (openLogs === c._id) { setOpenLogs(null); return; }
    setOpenLogs(c._id);
    const r = await creditAPI.logs(c._id);
    setLogs(r.data.data);
  }

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
          उधार खाते
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
          आवाजाने उधार नोंदवा — “शर्मा काकांनी 500 चा माल घेतला”
        </p>
      </div>

      {/* Summary strip */}
      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { label: "एकूण उधार", value: fmt(stats.totalUdhaar), color: "var(--red)",   bg: "#f5455a18", border: "#f5455a33" },
            { label: "उधार ग्राहक", value: stats.withBalance,    color: "var(--yellow)", bg: "#f5c84218", border: "#f5c84233" },
            { label: "एकूण ग्राहक", value: stats.total,          color: "var(--blue)",  bg: "#4f9cf918", border: "#4f9cf933" },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: 12, padding: "14px 20px", flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, alignItems: "start" }}>

        {/* Customer list */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>ग्राहक</span>
            <span style={{ fontSize: 11, color: "var(--text3)" }}>{customers.length} ग्राहक</span>
          </div>

          {loading && <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 8 }} />)}
          </div>}

          {!loading && customers.length === 0 && (
            <div style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: 30, marginBottom: 10 }}>👤</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>अजून ग्राहक नाहीत</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>उजवीकडून आवाजाने पहिली नोंद करा</div>
            </div>
          )}

          {customers.map(c => (
            <div key={c._id}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  background: c.balance > 0 ? "#f5455a18" : "#10d9a018",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700,
                  color: c.balance > 0 ? "var(--red)" : "var(--green)",
                }}>{c.name[0]}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                    {c.balance > 0 ? "उधार बाकी" : c.balance < 0 ? "आडवणूक" : "हिशोब बरोबर"}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: c.balance > 0 ? "var(--red)" : c.balance < 0 ? "var(--blue)" : "var(--green)" }}>
                  {fmt(c.balance)}
                </span>
                {c.balance > 0 && <>
                  <button onClick={() => settle(c)} title="पूर्ण हिशोब भरला"
                    style={{ padding: "6px 10px", background: "#10d9a018", border: "1px solid #10d9a040", borderRadius: 8, color: "var(--green)", fontSize: 12, cursor: "pointer" }}>✓ भरला</button>
                  <button onClick={() => remind(c)} title="WhatsApp स्मरण पाठवा"
                    style={{ padding: "6px 10px", background: "#25D36618", border: "1px solid #25D36640", borderRadius: 8, color: "#25D366", fontSize: 12, cursor: "pointer" }}>📱</button>
                </>}
                <button onClick={() => toggleLogs(c)}
                  style={{ padding: "6px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text3)", fontSize: 12, cursor: "pointer" }}>📜</button>
              </div>

              {openLogs === c._id && (
                <div style={{ padding: "10px 20px 16px 72px", background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                  {logs.length === 0 && <div style={{ fontSize: 12, color: "var(--text3)" }}>नोंदी नाहीत</div>}
                  {logs.map(l => (
                    <div key={l._id} style={{ display: "flex", gap: 10, fontSize: 12, padding: "4px 0", color: "var(--text2)" }}>
                      <span style={{ color: l.type === "udhaar" ? "var(--red)" : "var(--green)", fontWeight: 600, minWidth: 60 }}>
                        {l.type === "udhaar" ? "+" : "−"}{fmt(l.amount)}
                      </span>
                      <span style={{ flex: 1 }}>{l.note || (l.type === "udhaar" ? "उधार" : "जमा")}{l.source === "whatsapp" ? " · WhatsApp" : l.source === "voice" ? " · आवाज" : ""}</span>
                      <span style={{ color: "var(--text3)" }}>{new Date(l.createdAt).toLocaleDateString("en-IN")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Voice entry panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>🎤 आवाजाने नोंद करा</div>

            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0" }}>
              <button onClick={listening ? stopListening : startListening}
                style={{
                  width: 64, height: 64, borderRadius: "50%", border: "none", cursor: "pointer",
                  background: listening ? "var(--red)" : "var(--green)",
                  fontSize: 24, color: "#fff",
                  boxShadow: listening ? "0 0 22px #f5455a66" : "0 0 14px #10d9a044",
                }}>
                {listening ? "⏹" : "🎤"}
              </button>
            </div>
            {(transcript || interimTranscript) && (
              <div style={{ fontSize: 13, color: "var(--text2)", textAlign: "center", marginBottom: 12, minHeight: 18 }}>
                {transcript || interimTranscript}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && text.trim() && handleParse(text)}
                placeholder="किंवा टाइप करा…"
                style={{ flex: 1, padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <button onClick={() => text.trim() && handleParse(text)} disabled={parsing}
                style={{ padding: "9px 14px", background: "var(--blue)", border: "none", borderRadius: 10, color: "#fff", fontSize: 13, cursor: "pointer" }}>→</button>
            </div>
          </div>

          {/* Confirmation card */}
          {draft && (
            <div style={{ background: "var(--card)", border: "1px solid var(--purple)", borderRadius: 14, padding: 20 }} className="fade-in">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--purple)", marginBottom: 14 }}>✍️ नोंद तपासा</div>

              <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>ग्राहकाचे नाव</div>
              <input value={draft.customerName} onChange={e => setDraft({ ...draft, customerName: e.target.value })}
                style={{ width: "100%", padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 10 }} />

              {draft.candidates.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 10 }}>
                  शक्य: {draft.candidates.map((c, i) => (
                    <button key={c._id} onClick={() => setDraft({ ...draft, customerName: c.name })}
                      style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--blue)", fontSize: 11, padding: "2px 8px", margin: "0 4px 4px 0", cursor: "pointer" }}>{c.name}</button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>प्रकार</div>
                  <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}
                    style={{ width: "100%", padding: "9px 10px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: "inherit" }}>
                    <option value="udhaar">उधार (माल घेतला)</option>
                    <option value="payment">जमा (पैसे आले)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>रक्कम (₹)</div>
                  <input type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: e.target.value })}
                    style={{ width: "100%", padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>

              <input value={draft.note} onChange={e => setDraft({ ...draft, note: e.target.value })}
                placeholder="काय घेतलं? (ऐच्छिक)"
                style={{ width: "100%", padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 14 }} />

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={saveDraft}
                  style={{ flex: 1, padding: 11, background: "var(--green)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✓ नोंदवा</button>
                <button onClick={() => setDraft(null)}
                  style={{ padding: "11px 16px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", fontSize: 13, cursor: "pointer" }}>रद्द</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
