import { useState, useCallback, useRef, useEffect } from "react";
import { voiceAPI, itemsAPI } from "../utils/api";
import toast from "react-hot-toast";

const C = {
  bg: "#0f1117", card: "#1a1d27", border: "#2a2d3e",
  green: "#00c896", yellow: "#f5c842", red: "#f54255",
  blue: "#5b9cf6", text: "#e2e8f0", muted: "#6b7280",
  cardDeep: "#141720",
};

const CATEGORIES = ["सामान्य","धान्य","तेल","मसाले","डाळी","पेय","साबण/तेल","नाश्ता","दुग्धजन्य"];
const UNITS      = ["pcs","kg","litre","packet","bottle","dozen","gram"];

// ── Minimal mic hook (no deps, self-contained) ─────────────
function useMic({ onResult, lang = "mr-IN" }) {
  const [listening, setListening] = useState(false);
  const [live, setLive]           = useState("");
  const [error, setError]         = useState(null);
  const recRef    = useRef(null);
  const timerRef  = useRef(null);
  const finalRef  = useRef("");
  const doneRef   = useRef(false);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Chrome वापरा"); return; }

    setLive(""); setError(null);
    finalRef.current = ""; doneRef.current = false;

    const rec = new SR();
    rec.lang = lang; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 3;

    rec.onstart = () => setListening(true);

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        // pick highest-confidence alternative
        let best = e.results[i][0].transcript, bestConf = e.results[i][0].confidence || 0;
        for (let j = 1; j < e.results[i].length; j++) {
          if ((e.results[i][j].confidence || 0) > bestConf) {
            bestConf = e.results[i][j].confidence;
            best = e.results[i][j].transcript;
          }
        }
        if (e.results[i].isFinal) finalRef.current += best + " ";
        else interim += best;
      }
      setLive((finalRef.current + interim).trim());

      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const full = (finalRef.current + interim).trim();
        if (full && !doneRef.current) {
          doneRef.current = true;
          rec.stop();
          if (onResult) onResult(full);
        }
      }, 1600);
    };

    rec.onerror = (e) => {
      clearTimeout(timerRef.current);
      const msgs = { "no-speech":"काही ऐकले नाही","not-allowed":"मायक्रोफोन परवानगी द्या","network":"नेटवर्क तपासा" };
      setError(msgs[e.error] || "Error: " + e.error);
      setListening(false);
    };

    rec.onend = () => {
      clearTimeout(timerRef.current);
      setListening(false); setLive("");
      const full = finalRef.current.trim();
      if (full && !doneRef.current) { doneRef.current = true; if (onResult) onResult(full); }
    };

    recRef.current = rec; rec.start();
  }, [lang, onResult]);

  const stop = useCallback(() => {
    clearTimeout(timerRef.current); recRef.current?.stop(); setListening(false);
  }, []);

  return { listening, live, error, start, stop };
}

// ── Single answer input — voice + text ─────────────────────
function AnswerInput({ onAnswer, placeholder, autoStart = false }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);

  const { listening, live, error, start, stop } = useMic({
    onResult: (t) => { setText(""); onAnswer(t); },
    lang: "mr-IN",
  });

  useEffect(() => {
    if (autoStart) {
      const t = setTimeout(start, 400);
      return () => clearTimeout(t);
    }
    inputRef.current?.focus();
  }, []);  // eslint-disable-line

  const submit = () => { if (text.trim()) { onAnswer(text.trim()); setText(""); } };

  return (
    <div style={{ marginTop: 10 }}>
      {/* Voice button */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <button onClick={listening ? stop : start}
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
            background: listening ? C.red : C.green, fontSize: 18,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: listening ? `0 0 16px ${C.red}66` : `0 0 10px ${C.green}44`,
            flexShrink: 0,
          }}>
          {listening ? "⏹" : "🎤"}
        </button>
        <div style={{ fontSize: 12, color: listening ? C.red : C.muted }}>
          {listening ? (live || "ऐकतोय…") : "माइक दाबा किंवा खाली टाइप करा"}
        </div>
      </div>

      {/* Text fallback */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={placeholder || "टाइप करा…"}
          style={{
            flex: 1, padding: "10px 14px", background: C.bg,
            border: `1px solid ${C.border}`, borderRadius: 8,
            color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none",
          }}
          onFocus={e => e.target.style.borderColor = C.blue}
          onBlur={e => e.target.style.borderColor = C.border}
        />
        <button onClick={submit} disabled={!text.trim()}
          style={{
            padding: "10px 18px", background: text.trim() ? C.blue : C.border,
            border: "none", borderRadius: 8, color: "#fff", fontSize: 13,
            cursor: text.trim() ? "pointer" : "not-allowed", fontWeight: 600,
          }}>
          →
        </button>
      </div>
      {error && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

// ── Chat bubble ─────────────────────────────────────────────
function Bubble({ role, text, extra }) {
  const isAI = role === "ai";
  return (
    <div style={{
      display: "flex", flexDirection: isAI ? "row" : "row-reverse",
      gap: 10, marginBottom: 12, alignItems: "flex-start",
    }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, background: isAI ? C.blue + "33" : C.green + "33", marginTop: 4 }}>
        {isAI ? "🤖" : "🧑"}
      </div>
      <div style={{ maxWidth: "78%" }}>
        <div style={{
          padding: "10px 14px", borderRadius: isAI ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
          background: isAI ? "#1a2035" : "#0d2518",
          border: `1px solid ${isAI ? C.blue + "44" : C.green + "44"}`,
          fontSize: 14, color: C.text, lineHeight: 1.6,
        }}>
          {text}
        </div>
        {extra && <div style={{ marginTop: 6 }}>{extra}</div>}
      </div>
    </div>
  );
}

// ── Collected data display card ─────────────────────────────
function DataCard({ data, onEdit }) {
  const rows = [
    { key: "name",     label: "नाव",           val: data.name },
    { key: "nameHindi",label: "मराठी नाव",     val: data.nameHindi },
    { key: "category", label: "श्रेणी",         val: data.category },
    { key: "quantity", label: "प्रमाण",         val: data.quantity ? `${data.quantity} ${data.unit || ""}` : null },
    { key: "buyPrice", label: "खरेदी किंमत",    val: data.buyPrice ? `₹${data.buyPrice}` : null },
    { key: "sellPrice",label: "विक्री किंमत",   val: data.sellPrice ? `₹${data.sellPrice}` : null },
    { key: "lowStockThreshold", label: "कमी साठा सूचना", val: data.lowStockThreshold ? `${data.lowStockThreshold} ${data.unit || ""}` : null },
  ].filter(r => r.val);

  if (!rows.length) return null;
  return (
    <div style={{ background: C.cardDeep, border: `1px solid ${C.green}33`, borderRadius: 10, padding: "12px 14px", marginBottom: 4 }}>
      <div style={{ fontSize: 11, color: C.green, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>आत्तापर्यंत समजले</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rows.map(r => (
          <div key={r.key} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px" }}>
            <span style={{ fontSize: 10, color: C.muted }}>{r.label}: </span>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Editable final form ─────────────────────────────────────
function FinalForm({ data, onSave, onBack, saving }) {
  const [form, setForm] = useState({
    name: data.name || "", nameHindi: data.nameHindi || "",
    category: data.category || "सामान्य",
    quantity: data.quantity || "", unit: data.unit || "pcs",
    buyPrice: data.buyPrice || "", sellPrice: data.sellPrice || "",
    lowStockThreshold: data.lowStockThreshold || 10,
  });
  const set = k => e => setForm(f => ({ ...f, [k]: typeof e === "object" ? e.target.value : e }));

  const inp = (k, placeholder, type = "text") => (
    <input type={type} value={form[k]} onChange={set(k)} placeholder={placeholder}
      style={{ width: "100%", padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
      onFocus={e => e.target.style.borderColor = C.blue}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
  const sel = (k, opts) => (
    <select value={form[k]} onChange={set(k)}
      style={{ width: "100%", padding: "9px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  const lbl = (t) => <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{t}</div>;

  const profit = form.buyPrice && form.sellPrice
    ? (parseFloat(form.sellPrice) - parseFloat(form.buyPrice)).toFixed(2) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>
        सर्व माहिती बरोबर आहे का? हवे तर बदला:
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>{lbl("नाव (English) *")}{inp("name", "Wheat")}</div>
        <div>{lbl("नाव (मराठी)")}{inp("nameHindi", "गहू")}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>{lbl("प्रमाण *")}{inp("quantity", "50", "number")}</div>
        <div>{lbl("एकक")}{sel("unit", UNITS)}</div>
        <div>{lbl("श्रेणी")}{sel("category", CATEGORIES)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div>{lbl("खरेदी किंमत ₹")}{inp("buyPrice", "40", "number")}</div>
        <div>{lbl("विक्री किंमत ₹")}{inp("sellPrice", "50", "number")}</div>
        <div>{lbl("कमी साठा सूचना")}{inp("lowStockThreshold", "10", "number")}</div>
      </div>

      {/* Preview */}
      {form.name && form.quantity && (
        <div style={{ background: C.cardDeep, border: `1px solid ${C.green}44`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{form.name}</div>
            {form.nameHindi && <div style={{ fontSize: 12, color: C.muted }}>{form.nameHindi} · {form.category}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{form.quantity} {form.unit}</div>
            {form.sellPrice && <div style={{ fontSize: 13, color: C.muted }}>₹{form.sellPrice}/{form.unit}</div>}
            {profit && <div style={{ fontSize: 12, color: C.green }}>नफा ₹{profit}</div>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave(form)} disabled={saving || !form.name || !form.quantity}
          style={{
            flex: 1, padding: "13px", background: (!form.name || !form.quantity) ? C.border : C.green,
            border: "none", borderRadius: 10, color: "#000",
            fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
          }}>
          {saving ? "जोडतोय…" : "✅ यादीत जोडा"}
        </button>
        <button onClick={onBack}
          style={{ padding: "13px 18px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
          मागे
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ════════════════════════════════════════════════════════════
const INITIAL_Q = "नवीन माल जोडायचा आहे. मालाचे नाव सांगा — मराठी किंवा English मध्ये.";

export default function VoiceAddItem({ onItemAdded, onClose }) {
  const [chat, setChat]       = useState([{ role: "ai", text: INITIAL_Q }]);
  const [collected, setCollected] = useState({});   // all extracted data so far
  const [phase, setPhase]     = useState("chat");   // chat | review | saving | done
  const [saving, setSaving]   = useState(false);

  const chatEndRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  // ── Process one user answer ───────────────────────────
  const handleAnswer = useCallback(async (userText) => {
    // Add user bubble
    setChat(c => [...c, { role: "user", text: userText }]);

    // Send to backend /api/voice/understand-item
    let result;
    try {
      const res = await voiceAPI.understandItem(userText, collected);
      result = res.data;
    } catch {
      setChat(c => [...c, { role: "ai", text: "सर्व्हरशी संपर्क नाही. पुन्हा प्रयत्न करा." }]);
      return;
    }

    const newData = result.mergedData;
    setCollected(newData);

    if (result.isComplete) {
      // All required fields collected — go to review
      setChat(c => [...c, { role: "ai", text: `✅ समजले! सर्व माहिती मिळाली — आता तपासा.` }]);
      setTimeout(() => setPhase("review"), 600);
    } else {
      // Ask next missing field
      const q = result.nextQuestion || "आणखी काही सांगायचे आहे का?";
      setChat(c => [...c, { role: "ai", text: q }]);
    }
  }, [collected]);

  // ── Save to DB ───────────────────────────────────────
  async function save(form) {
    setSaving(true);
    try {
      await itemsAPI.create({
        name:              form.name.trim(),
        nameHindi:         form.nameHindi?.trim() || "",
        category:          form.category || "सामान्य",
        quantity:          parseFloat(form.quantity) || 0,
        unit:              form.unit || "pcs",
        buyPrice:          parseFloat(form.buyPrice) || 0,
        sellPrice:         parseFloat(form.sellPrice) || 0,
        lowStockThreshold: parseInt(form.lowStockThreshold) || 10,
      });
      setCollected(form); // save final form for done screen
      setPhase("done");
      toast.success(`✅ ${form.name} यादीत जोडले!`);
      if (onItemAdded) onItemAdded();
    } catch (err) {
      toast.error(err.response?.data?.message || "जोडता आले नाही");
    }
    setSaving(false);
  }

  function restart() {
    setChat([{ role: "ai", text: INITIAL_Q }]);
    setCollected({});
    setPhase("chat");
  }

  // ── DONE ────────────────────────────────────────────
  if (phase === "done") return (
    <div style={{ background: C.card, border: `1px solid ${C.green}44`, borderRadius: 16, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 10 }}>✅</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 4 }}>{collected.name} जोडले!</div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>
        {collected.quantity} {collected.unit} · {collected.category}
        {collected.sellPrice ? ` · ₹${collected.sellPrice}/${collected.unit}` : ""}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button onClick={restart}
          style={{ padding: "10px 24px", background: C.green, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          🎤 आणखी जोडा
        </button>
        {onClose && <button onClick={onClose}
          style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, cursor: "pointer", fontFamily: "inherit" }}>
          बंद करा
        </button>}
      </div>
    </div>
  );

  // ── REVIEW / EDIT ────────────────────────────────────
  if (phase === "review") return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 4 }}>माल तपासा</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>AI ने भरलेले — हवे ते बदला, मग जोडा</div>
      <FinalForm data={collected} onSave={save} onBack={() => setPhase("chat")} saving={saving} />
    </div>
  );

  // ── CHAT ────────────────────────────────────────────
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>🎤 आवाजाने नवीन माल जोडा</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>AI तुम्हाला step-by-step विचारेल</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={restart}
            style={{ padding: "5px 10px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 12, cursor: "pointer" }}>
            🔄 रीसेट
          </button>
          {onClose && <button onClick={onClose}
            style={{ background: "none", border: "none", color: C.muted, fontSize: 18, cursor: "pointer" }}>✕</button>}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ padding: 16, maxHeight: 340, overflowY: "auto" }}>
        {chat.map((msg, i) => (
          <Bubble key={i} role={msg.role} text={msg.text} />
        ))}

        {/* Show collected data inline when we have something */}
        {Object.keys(collected).length > 0 && phase === "chat" && (
          <div style={{ marginBottom: 12 }}>
            <DataCard data={collected} />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input area — only show when in chat phase */}
      {phase === "chat" && (
        <div style={{ padding: "0 16px 16px" }}>
          <AnswerInput
            key={chat.length}              // remount (and auto-start) after each AI message
            onAnswer={handleAnswer}
            placeholder="उदा: गहू / 50 किलो / ₹40 buy ₹50 sell…"
            autoStart={true}
          />
        </div>
      )}
    </div>
  );
}