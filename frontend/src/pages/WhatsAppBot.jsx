import { useState, useRef, useEffect } from "react";
import { useVoice } from "../hooks/useVoice";
import { botAPI } from "../utils/api";
import toast from "react-hot-toast";

const EXAMPLES = [
  "दहा किलो गहू आला",
  "पाच मॅगी गेल्या",
  "शर्मा काकांनी 500 चा माल घेतला",
  "शर्मा काकांनी 200 पैसे दिले",
  "ऑर्डर कर",
  "आजचा हिशोब सांग",
];

export default function WhatsAppBot() {
  const [messages, setMessages] = useState([
    { from: "bot", text: "नमस्कार! 🙏 मी DukanAI बॉट.\nखाली उदाहरण टाइप करा किंवा 🎤 दाबून बोला." },
  ]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const chatEndRef = useRef(null);

  const { listening, transcript, interimTranscript, startListening, stopListening } = useVoice({
    onResult: t => send(t), lang: "mr-IN",
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text) {
    const msg = (text || "").trim();
    if (!msg || busy) return;
    setInput("");
    setMessages(m => [...m, { from: "you", text: msg }]);
    setBusy(true);
    try {
      const r = await botAPI.simulate(msg);
      setMessages(m => [...m, { from: "bot", text: r.data.reply }]);
    } catch {
      setMessages(m => [...m, { from: "bot", text: "❌ Backend ला जोडता आले नाही." }]);
    }
    setBusy(false);
  }

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>
          WhatsApp बॉट
        </h2>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
          App शिवाय — WhatsApp वर मेसेज किंवा 🎤 voice note पाठवा, बॉट हिशोब सांभाळतो
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, alignItems: "start" }}>

        {/* Simulator */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 480, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✆</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>DukanAI बॉट — Simulator</div>
              <div style={{ fontSize: 11, color: "var(--text3)" }}>खरे WhatsApp नाही — बॉट लॉजिक तपासण्यासाठी</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 10, background: "var(--bg)" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.from === "you" ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                <div style={{
                  padding: "10px 14px", borderRadius: 14,
                  borderBottomRightRadius: m.from === "you" ? 4 : 14,
                  borderBottomLeftRadius: m.from === "you" ? 14 : 4,
                  background: m.from === "you" ? "#005c4b" : "#202c33",
                  color: "#e9edef", fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                }}>{m.text}</div>
              </div>
            ))}
            {busy && (
              <div style={{ alignSelf: "flex-start", fontSize: 12, color: "var(--text3)", padding: "4px 14px" }}>बॉट लिहितोय…</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: 14, borderTop: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={listening ? stopListening : startListening}
              title="बोला"
              style={{
                width: 40, height: 40, borderRadius: "50%", cursor: "pointer", flexShrink: 0,
                background: listening ? "var(--red)" : "var(--card)", border: "1px solid var(--border)",
                color: listening ? "#fff" : "var(--text2)", fontSize: 16,
              }}>
              🎤
            </button>
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send(input)}
              placeholder={listening ? (transcript || interimTranscript || "ऐकतोय…") : "मेसेज लिहा…"}
              style={{ flex: 1, padding: "11px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, color: "var(--text)", fontSize: 13.5, fontFamily: "inherit", outline: "none" }} />
            <button onClick={() => send(input)} disabled={busy || !input.trim()}
              style={{
                width: 40, height: 40, borderRadius: "50%", border: "none", flexShrink: 0,
                background: input.trim() ? "#25D366" : "var(--border)",
                color: "#fff", fontSize: 15, cursor: input.trim() ? "pointer" : "not-allowed",
              }}>➤</button>
          </div>
        </div>

        {/* Side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Quick examples */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>⚡ उदाहरणे — दाबा आणि पाठवा</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {EXAMPLES.map(ex => (
                <button key={ex} onClick={() => send(ex)} disabled={busy}
                  style={{ textAlign: "left", padding: "9px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text2)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* Setup */}
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 10 }}>📱 खरे WhatsApp जोडण्यासाठी</div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text3)", lineHeight: 2 }}>
              <li>Twilio Console → Messaging → Try it out → WhatsApp sandbox</li>
              <li>Sandbox webhook URL: <code style={{ color: "var(--blue)", fontSize: 11 }}>https://&lt;backend&gt;/api/webhook</code> (POST)</li>
              <li>.env मध्ये <code style={{ color: "var(--blue)", fontSize: 11 }}>TWILIO_WHATSAPP_FROM</code> आणि <code style={{ color: "var(--blue)", fontSize: 11 }}>OWNER_WHATSAPP</code> भरा</li>
              <li>WhatsApp वरून sandbox नंबरला मेसेज करा — voice note पण चालते 🎤</li>
            </ol>
            <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 12, lineHeight: 1.6 }}>
              पैसे आणि ऑर्डर असलेल्या गोष्टींसाठी बॉट आधी विचारतो “हो / नाही” — चुकून नोंद होणार नाही.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
