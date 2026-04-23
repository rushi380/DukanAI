import { useState, useCallback, useRef } from "react";
import { useVoice } from "../hooks/useVoice";
import { voiceAPI, itemsAPI } from "../utils/api";
import toast from "react-hot-toast";

const C = {
  bg: "#0f1117", card: "#1a1d27", border: "#2a2d3e",
  green: "#00c896", yellow: "#f5c842", red: "#f54255",
  blue: "#5b9cf6", purple: "#a78bfa", text: "#e2e8f0", muted: "#6b7280",
};

// ── Small reusable components ──────────────────────────────
function MicButton({ listening, onClick, disabled }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <div style={{ position: "relative" }}>
        {listening && <>
          <span style={{ position: "absolute", inset: -18, borderRadius: "50%", border: `2px solid ${C.red}40`, animation: "ring 1.4s infinite" }} />
          <span style={{ position: "absolute", inset: -9, borderRadius: "50%", border: `2px solid ${C.red}60`, animation: "ring 1.4s 0.5s infinite" }} />
        </>}
        <button onClick={onClick} disabled={disabled}
          style={{
            width: 88, height: 88, borderRadius: "50%", border: "none",
            background: listening ? C.red : C.green,
            fontSize: 30, cursor: disabled ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: listening ? `0 0 28px ${C.red}66` : `0 0 18px ${C.green}44`,
            transition: "all 0.2s",
          }}>
          {listening ? "⏹" : "🎤"}
        </button>
      </div>
      <div style={{ fontSize: 13, color: listening ? C.red : C.muted, fontWeight: 500 }}>
        {listening ? "ऐकतोय… बोला" : "माइक दाबा"}
      </div>
    </div>
  );
}

function LiveText({ transcript, interim, listening }) {
  if (!transcript && !interim && !listening) return null;
  return (
    <div style={{ background: C.card, border: `1px solid ${listening ? C.red + "66" : C.border}`, borderRadius: 12, padding: "14px 18px", textAlign: "center", transition: "border-color 0.3s" }}>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 6, letterSpacing: 1, textTransform: "uppercase" }}>तुम्ही म्हणालात</div>
      <div style={{ fontSize: 18, color: C.text, minHeight: 28 }}>
        {transcript && <span>{transcript} </span>}
        {interim && <span style={{ color: C.muted }}>{interim}</span>}
        {!transcript && !interim && <span style={{ color: C.muted }}>…</span>}
      </div>
    </div>
  );
}

function ClarificationBubble({ question, onVoiceAnswer, onTextAnswer }) {
  const [answer, setAnswer] = useState("");
  const { listening, transcript, interimTranscript, startListening, stopListening } = useVoice({
    onResult: onVoiceAnswer, lang: "mr-IN"
  });

  return (
    <div style={{ background: "#1a1f35", border: `1px solid ${C.blue}66`, borderRadius: 12, padding: 18 }}>
      <div style={{ fontSize: 13, color: C.blue, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span>{question}</span>
      </div>

      {/* Voice answer */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button onClick={listening ? stopListening : startListening}
          style={{ padding: "8px 16px", background: listening ? C.red : C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
          {listening ? "⏹ थांबा" : "🎤 बोला"}
        </button>
        {(transcript || interimTranscript) && (
          <span style={{ color: C.text, fontSize: 13, alignSelf: "center" }}>
            {transcript || interimTranscript}
          </span>
        )}
      </div>

      {/* Text answer */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          onKeyDown={e => e.key === "Enter" && answer.trim() && onTextAnswer(answer)}
          placeholder="किंवा टाइप करा…"
          style={{ flex: 1, padding: "8px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}
        />
        <button onClick={() => answer.trim() && onTextAnswer(answer)}
          style={{ padding: "8px 14px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer" }}>
          →
        </button>
      </div>
    </div>
  );
}

// ── Editable field for the confirm card ───────────────────
function EditableField({ label, value, onChange, type = "text", options }) {
  if (options) return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: "100%", padding: "7px 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, fontFamily: "inherit" }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value ?? ""} onChange={e => onChange(type === "number" ? parseFloat(e.target.value) || "" : e.target.value)}
        style={{ width: "100%", padding: "7px 10px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 7, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
const UNITS = ["pcs", "kg", "litre", "packet", "bottle", "dozen", "gram"];
const ACTIONS = ["sale", "restock", "manual_update"];
const ACTION_LABEL = { sale: "विकले ↓", restock: "आले ↑", manual_update: "बदलले" };
const ACTION_COLOR = { sale: C.red, restock: C.green, manual_update: C.blue };

const TIPS = [
  '"दहा किलो गहू आला"',
  '"पाच मॅगी विकल्या"',
  '"तांदूळ वीस किलो आणला"',
  '"तीन डझन अंडी गेली"',
  '"fifty biscuit sold"',
];

export default function VoiceInput() {
  // Result state
  const [parsed, setParsed]         = useState(null);
  const [matchedItem, setMatchedItem] = useState(null);
  const [candidates, setCandidates] = useState([]);   // ambiguous matches
  const [editForm, setEditForm]     = useState({});   // user-editable copy
  const [rawText, setRawText]       = useState("");

  // Flow state
  const [phase, setPhase]   = useState("idle"); // idle | loading | clarify | confirm | done
  const [clarifyQ, setClarifyQ] = useState(null);
  const [convHistory, setConvHistory] = useState([]); // for follow-up context
  const [manualText, setManualText] = useState("");

  const lastRawRef = useRef("");

  // ── Send text to AI ───────────────────────────────────
  const processText = useCallback(async (text, isFollowUp = false) => {
    if (!text?.trim()) return;
    const clean = text.trim();
    lastRawRef.current = clean;
    setRawText(clean);
    setPhase("loading");
    setClarifyQ(null);
    if (!isFollowUp) {
      setParsed(null);
      setMatchedItem(null);
      setCandidates([]);
    }

    // Build conversation history for follow-ups
    const history = isFollowUp
      ? [...convHistory, { role: "owner", text: clean }]
      : [{ role: "owner", text: clean }];
    setConvHistory(history);

    try {
      const res = await voiceAPI.parse(clean, history);
      const { parsed: p, matchedItem: mi, candidates: cands } = res.data;

      setParsed(p);
      setMatchedItem(mi);
      setCandidates(cands || []);

      // Pre-fill editable form
      setEditForm({
        action: p.action || "sale",
        quantity: p.quantity ?? "",
        unit: p.unit || "pcs",
        selectedItemId: mi?._id || "",
        selectedItemName: mi?.name || p.itemName || "",
        selectedItemUnit: mi?.unit || p.unit || "pcs",
        selectedItemQty: mi?.quantity ?? 0,
      });

      if (p.needsClarification && p.clarificationQuestion) {
        setPhase("clarify");
        setClarifyQ(p.clarificationQuestion);
        setConvHistory([...history, { role: "ai", text: p.clarificationQuestion }]);
      } else {
        setPhase("confirm");
      }
    } catch (err) {
      toast.error("सर्व्हरशी संपर्क होत नाही");
      setPhase("idle");
    }
  }, [convHistory]);

  // Voice hook — passes raw text straight to processText
  const { listening, transcript, interimTranscript, error, isSupported, startListening, stopListening, reset } = useVoice({
    onResult: (rawText) => processText(rawText),
    lang: "mr-IN",
  });

  // User picks one of the candidate items
  function pickCandidate(item) {
    setMatchedItem(item);
    setCandidates([]);
    setEditForm(f => ({
      ...f,
      selectedItemId: item._id,
      selectedItemName: item.name,
      selectedItemUnit: item.unit,
      selectedItemQty: item.quantity,
      unit: item.unit,
    }));
    setPhase("confirm");
  }

  // Confirm & update stock
  async function confirmUpdate() {
    if (!matchedItem && !editForm.selectedItemId) {
      toast.error("माल निवडा");
      return;
    }
    const qty = Number(editForm.quantity);
    if (!qty || isNaN(qty)) {
      toast.error("प्रमाण (quantity) भरा");
      return;
    }

    setPhase("loading");
    try {
      const finalQty = editForm.action === "sale" ? -Math.abs(qty) : Math.abs(qty);
      const itemId = editForm.selectedItemId || matchedItem?._id;

      await itemsAPI.updateStock(itemId, {
        quantityChanged: finalQty,
        action: editForm.action,
        source: "voice",
        rawVoiceText: lastRawRef.current,
      });

      toast.success(`✅ ${editForm.selectedItemName} — अपडेट झाले!`);
      setPhase("done");
    } catch (err) {
      toast.error("अपडेट झाले नाही: " + (err.response?.data?.message || err.message));
      setPhase("confirm");
    }
  }

  function resetAll() {
    reset();
    setParsed(null); setMatchedItem(null); setCandidates([]);
    setEditForm({}); setRawText(""); setManualText("");
    setPhase("idle"); setClarifyQ(null); setConvHistory([]);
  }

  const liveText = transcript + (interimTranscript ? " " + interimTranscript : "");
  const actionColor = ACTION_COLOR[editForm.action] || C.green;

  return (
    <div style={{ padding: 24, background: C.bg, minHeight: "100vh", fontFamily: "'Noto Sans Devanagari', sans-serif", maxWidth: 680, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: "0 0 4px" }}>🎤 आवाजाने साठा बदला</h2>
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>बोला — AI समजेल, तुम्ही confirm करा</p>
      </div>

      {/* Browser warning */}
      {!isSupported && (
        <div style={{ background: "#1f1500", border: `1px solid ${C.yellow}`, borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: C.yellow, fontSize: 13 }}>
          ⚠️ Voice साठी <strong>Google Chrome</strong> वापरा
        </div>
      )}

      {/* ─── IDLE / LISTENING phase ─── */}
      {(phase === "idle" || phase === "loading") && (
        <>
          {/* Mic */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <MicButton
              listening={listening}
              disabled={!isSupported || phase === "loading"}
              onClick={listening ? stopListening : startListening}
            />
          </div>

          {/* Live transcript */}
          {(liveText || listening) && (
            <div style={{ marginBottom: 16 }}>
              <LiveText transcript={transcript} interim={interimTranscript} listening={listening} />
            </div>
          )}

          {/* Loading indicator */}
          {phase === "loading" && (
            <div style={{ textAlign: "center", color: C.muted, fontSize: 14, padding: 16 }}>
              <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⌛</span>
              {" "}AI समजून घेतोय…
            </div>
          )}

          {/* Manual input */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>किंवा टाइप करा:</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={manualText} onChange={e => setManualText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && phase === "idle" && manualText.trim() && processText(manualText)}
                placeholder="उदा: 10 kg गहू आला, 5 मॅगी विकल्या…"
                style={{ flex: 1, padding: "10px 14px", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 14, fontFamily: "inherit", outline: "none" }}
              />
              <button onClick={() => manualText.trim() && processText(manualText)}
                disabled={phase === "loading" || !manualText.trim()}
                style={{ padding: "10px 20px", background: C.blue, border: "none", borderRadius: 8, color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                →
              </button>
            </div>
          </div>

          {/* Example tips */}
          <div>
            <div style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>उदाहरणे (क्लिक करा):</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIPS.map((tip, i) => (
                <button key={i} onClick={() => processText(tip.replace(/"/g, ""))}
                  style={{ padding: "4px 12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 20, color: C.muted, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                  {tip}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ─── CLARIFY phase ─── */}
      {phase === "clarify" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* What we heard so far */}
          {rawText && (
            <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>तुम्ही म्हणालात</div>
              <div style={{ fontSize: 14, color: C.text }}>{rawText}</div>
            </div>
          )}

          {/* What AI understood so far */}
          {parsed?.marathiSummary && (
            <div style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>💬 {parsed.marathiSummary}</div>
          )}

          {/* Clarification question with voice/text answer */}
          <ClarificationBubble
            question={clarifyQ}
            onVoiceAnswer={(ans) => processText(ans, true)}
            onTextAnswer={(ans) => processText(ans, true)}
          />

          <button onClick={resetAll} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, color: C.muted, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
            सुरुवातीला जा
          </button>
        </div>
      )}

      {/* ─── CONFIRM phase ─── */}
      {phase === "confirm" && parsed && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* What was heard */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 16px" }}>
            <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>तुम्ही म्हणालात</div>
            <div style={{ fontSize: 14, color: C.text }}>{rawText}</div>
          </div>

          {/* AI summary */}
          {parsed.marathiSummary && (
            <div style={{ fontSize: 13, color: C.blue, fontStyle: "italic", padding: "0 4px" }}>
              🤖 "{parsed.marathiSummary}"
            </div>
          )}

          {/* ── Editable confirm card ── */}
          <div style={{ background: C.card, border: `1px solid ${actionColor}44`, borderRadius: 14, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>
              तपासा आणि हवे तर बदला:
            </div>

            {/* Action selector */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {ACTIONS.map(a => (
                <button key={a} onClick={() => setEditForm(f => ({ ...f, action: a }))}
                  style={{ flex: 1, padding: "8px 4px", border: `1px solid ${editForm.action === a ? ACTION_COLOR[a] : C.border}`, borderRadius: 8, background: editForm.action === a ? ACTION_COLOR[a] + "22" : "transparent", color: editForm.action === a ? ACTION_COLOR[a] : C.muted, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: editForm.action === a ? 700 : 400 }}>
                  {ACTION_LABEL[a]}
                </button>
              ))}
            </div>

            {/* Item selector */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>माल</div>

              {/* Matched item display */}
              {matchedItem && !candidates.length ? (
                <div style={{ background: C.green + "11", border: `1px solid ${C.green}44`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{matchedItem.name}</div>
                    <div style={{ fontSize: 12, color: C.muted }}>सध्या: {matchedItem.quantity} {matchedItem.unit}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: actionColor }}>
                    {editForm.action === "sale"
                      ? Math.max(0, matchedItem.quantity - (Number(editForm.quantity) || 0))
                      : matchedItem.quantity + (Number(editForm.quantity) || 0)
                    } {matchedItem.unit}
                  </div>
                </div>
              ) : (
                <div style={{ background: C.yellow + "11", border: `1px solid ${C.yellow}44`, borderRadius: 8, padding: "10px 14px", color: C.yellow, fontSize: 13 }}>
                  ⚠️ "{parsed.itemName}" — यादीत सापडला नाही
                </div>
              )}

              {/* Candidate list — user picks correct one */}
              {candidates.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>हा माल meant होता का?</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {candidates.map(item => (
                      <button key={item._id} onClick={() => pickCandidate(item)}
                        style={{ padding: "10px 14px", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, cursor: "pointer", fontFamily: "inherit", fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          {item.nameHindi && <span style={{ color: C.muted }}> / {item.nameHindi}</span>}
                        </div>
                        <span style={{ color: C.muted, fontSize: 12 }}>{item.quantity} {item.unit}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quantity + Unit */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 6 }}>
              <EditableField
                label="प्रमाण (Quantity) *"
                value={editForm.quantity}
                onChange={v => setEditForm(f => ({ ...f, quantity: v }))}
                type="number"
              />
              <EditableField
                label="एकक (Unit)"
                value={editForm.unit}
                onChange={v => setEditForm(f => ({ ...f, unit: v }))}
                options={UNITS}
              />
            </div>
          </div>

          {/* Confirm buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={confirmUpdate}
              disabled={!matchedItem && !editForm.selectedItemId || !editForm.quantity}
              style={{
                flex: 1, padding: "14px", border: "none", borderRadius: 10,
                background: (!matchedItem && !editForm.selectedItemId) || !editForm.quantity ? C.border : actionColor,
                color: "#000", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
              }}>
              ✅ हो, अपडेट करा
            </button>
            <button onClick={resetAll}
              style={{ padding: "14px 18px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, color: C.muted, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              रद्द
            </button>
          </div>

          {/* Ask again */}
          <button onClick={resetAll}
            style={{ background: "transparent", border: "none", color: C.blue, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            🎤 पुन्हा बोला
          </button>
        </div>
      )}

      {/* ─── DONE phase ─── */}
      {phase === "done" && (
        <div style={{ textAlign: "center", padding: 32, background: C.card, border: `1px solid ${C.green}44`, borderRadius: 14 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: C.green, marginBottom: 6 }}>साठा अपडेट झाला!</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>
            {editForm.selectedItemName} — {ACTION_LABEL[editForm.action]} {editForm.quantity} {editForm.unit}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={resetAll}
              style={{ padding: "10px 28px", background: C.green, border: "none", borderRadius: 8, color: "#000", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              🎤 पुन्हा बोला
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop: 16, background: "#2a0a0a", border: `1px solid ${C.red}`, borderRadius: 8, padding: "10px 14px", color: C.red, fontSize: 13 }}>
          {error}
        </div>
      )}

      <style>{`
        @keyframes ring { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(1.6);opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}