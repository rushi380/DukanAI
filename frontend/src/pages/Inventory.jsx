import { useEffect, useState } from "react";
import { itemsAPI } from "../utils/api";
import toast from "react-hot-toast";
import VoiceAddItem from "../components/VoiceAddItem";

const C = {
  bg: "#0f1117", card: "#1a1d27", border: "#2a2d3e",
  green: "#00c896", yellow: "#f5c842", red: "#f54255",
  blue: "#5b9cf6", text: "#e2e8f0", muted: "#6b7280",
};

const CATEGORIES = ["सामान्य","धान्य","तेल","मसाले","डाळी","पेय","साबण/तेल","नाश्ता","दुग्धजन्य"];
const UNITS = ["pcs","kg","litre","packet","bottle","dozen","gram"];
const emptyForm = { name:"", nameHindi:"", category:"सामान्य", quantity:"", unit:"pcs", buyPrice:"", sellPrice:"", lowStockThreshold:10 };

function badge(item) {
  if (item.quantity === 0)                         return { label:"संपले", bg:"#2a0a0a", color:C.red };
  if (item.quantity <= item.lowStockThreshold)     return { label:"कमी",   bg:"#2a1e00", color:C.yellow };
  return                                                  { label:"उपलब्ध",bg:"#0a2010", color:C.green };
}

function FL({ label, children }) {
  return <div><div style={{ fontSize:10, color:C.muted, marginBottom:4 }}>{label}</div>{children}</div>;
}

export default function Inventory() {
  const [items, setItems]         = useState([]);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("सर्व");
  const [mode, setMode]           = useState("none"); // none | voice | form
  const [form, setForm]           = useState(emptyForm);
  const [editId, setEditId]       = useState(null);
  const [loading, setLoading]     = useState(false);

  const load = () => itemsAPI.getAll({ search }).then(r => setItems(r.data.data)).catch(() => {});
  useEffect(() => { load(); }, [search]);

  const filtered = items.filter(i => {
    if (filter === "कमी")    return i.quantity > 0 && i.quantity <= i.lowStockThreshold;
    if (filter === "संपले")  return i.quantity === 0;
    if (filter === "उपलब्ध") return i.quantity > i.lowStockThreshold;
    return true;
  });

  async function handleSubmit(e) {
    e.preventDefault(); setLoading(true);
    try {
      const payload = { ...form, quantity: parseFloat(form.quantity)||0, buyPrice: parseFloat(form.buyPrice)||0, sellPrice: parseFloat(form.sellPrice)||0, lowStockThreshold: parseInt(form.lowStockThreshold)||10 };
      if (editId) { await itemsAPI.update(editId, payload); toast.success("माल अपडेट झाला!"); }
      else        { await itemsAPI.create(payload);         toast.success("नवीन माल जोडला!"); }
      setForm(emptyForm); setEditId(null); setMode("none"); load();
    } catch (err) { toast.error(err.response?.data?.message || "चूक झाली"); }
    setLoading(false);
  }

  function startEdit(item) {
    setForm({ name:item.name, nameHindi:item.nameHindi||"", category:item.category, quantity:item.quantity, unit:item.unit, buyPrice:item.buyPrice, sellPrice:item.sellPrice, lowStockThreshold:item.lowStockThreshold });
    setEditId(item._id); setMode("form");
    window.scrollTo({ top:0, behavior:"smooth" });
  }

  async function quickStock(item, change) {
    try {
      await itemsAPI.updateStock(item._id, { quantityChanged:change, action:change<0?"sale":"restock", source:"manual" });
      toast.success(`${item.name} ${change>0?"+"+change:change}`); load();
    } catch { toast.error("अपडेट झाले नाही"); }
  }

  async function del(id) {
    if (!confirm("खरंच काढायचं?")) return;
    await itemsAPI.delete(id); toast.success("काढले"); load();
  }

  const inp = (k, ph, type="text") => (
    <input type={type} placeholder={ph} value={form[k]} onChange={e => setForm({...form, [k]:e.target.value})}
      style={{ width:"100%", padding:"9px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontFamily:"inherit", outline:"none", boxSizing:"border-box" }} />
  );
  const sel = (k, opts) => (
    <select value={form[k]} onChange={e => setForm({...form,[k]:e.target.value})}
      style={{ width:"100%", padding:"9px 12px", background:C.bg, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontFamily:"inherit" }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div style={{ padding:24, background:C.bg, minHeight:"100vh", fontFamily:"'Noto Sans Devanagari', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:C.text, margin:0 }}>📦 मालाची यादी</h2>

        <div style={{ display:"flex", gap:8 }}>
          {/* Voice Add button */}
          <button onClick={() => { setMode(mode==="voice"?"none":"voice"); setEditId(null); setForm(emptyForm); }}
            style={{ padding:"9px 18px", background:mode==="voice"?C.green+"22":"transparent", border:`1px solid ${C.green}`, color:C.green, borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6 }}>
            🎤 {mode==="voice"?"बंद करा":"आवाजाने जोडा"}
          </button>

          {/* Manual form button */}
          <button onClick={() => { setMode(mode==="form"&&!editId?"none":"form"); setEditId(null); setForm(emptyForm); }}
            style={{ padding:"9px 18px", background:mode==="form"&&!editId?C.blue+"22":"transparent", border:`1px solid ${mode==="form"&&!editId?C.blue:C.border}`, color:mode==="form"&&!editId?C.blue:C.text, borderRadius:8, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
            {mode==="form"&&!editId?"बंद करा":"+ नवीन माल"}
          </button>
        </div>
      </div>

      {/* ── Voice Add Panel ── */}
      {mode==="voice" && (
        <div style={{ marginBottom:20 }}>
          <VoiceAddItem onItemAdded={() => { load(); }} onClose={() => setMode("none")} />
        </div>
      )}

      {/* ── Manual form ── */}
      {mode==="form" && (
        <form onSubmit={handleSubmit} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:600, color:C.text, marginBottom:16 }}>
            {editId ? "✏️ माल बदला" : "➕ नवीन माल जोडा"}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
            <FL label="नाव (English) *">{inp("name","Wheat")}</FL>
            <FL label="नाव (मराठी)">{inp("nameHindi","गहू")}</FL>
            <FL label="श्रेणी">{sel("category",CATEGORIES)}</FL>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:16 }}>
            <FL label="प्रमाण *">{inp("quantity","50","number")}</FL>
            <FL label="एकक">{sel("unit",UNITS)}</FL>
            <FL label="खरेदी ₹">{inp("buyPrice","40","number")}</FL>
            <FL label="विक्री ₹">{inp("sellPrice","50","number")}</FL>
            <FL label="कमी साठा">{inp("lowStockThreshold","10","number")}</FL>
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button type="submit" disabled={loading}
              style={{ padding:"10px 24px", background:loading?C.border:C.green, border:"none", borderRadius:8, color:"#000", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              {loading?"…":editId?"जतन करा":"जोडा"}
            </button>
            <button type="button" onClick={() => { setMode("none"); setEditId(null); setForm(emptyForm); }}
              style={{ padding:"10px 18px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:8, color:C.muted, cursor:"pointer", fontFamily:"inherit" }}>
              रद्द
            </button>
          </div>
        </form>
      )}

      {/* ── Search + Filter ── */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="शोधा…"
          style={{ flex:1, minWidth:180, padding:"9px 14px", background:C.card, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, fontSize:13, fontFamily:"inherit", outline:"none" }} />
        {["सर्व","उपलब्ध","कमी","संपले"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"9px 14px", background:filter===f?C.blue+"22":"transparent", border:`1px solid ${filter===f?C.blue:C.border}`, color:filter===f?C.blue:C.muted, borderRadius:8, fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ fontSize:12, color:C.muted, marginBottom:10 }}>{filtered.length} वस्तू</div>

      {/* ── Item list ── */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:"center", padding:40, color:C.muted }}>
          <div style={{ fontSize:32, marginBottom:10 }}>📦</div>
          <div>कोणताही माल सापडला नाही</div>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {filtered.map(item => {
            const b = badge(item);
            return (
              <div key={item._id}
                style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:12, padding:"13px 16px", display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ width:9, height:9, borderRadius:"50%", background:b.color, flexShrink:0 }} />

                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:C.text }}>{item.name}</div>
                  {item.nameHindi && <div style={{ fontSize:11, color:C.muted }}>{item.nameHindi} · {item.category}</div>}
                </div>

                <div style={{ textAlign:"center", minWidth:65 }}>
                  <div style={{ fontSize:18, fontWeight:700, color:b.color }}>{item.quantity}</div>
                  <div style={{ fontSize:11, color:C.muted }}>{item.unit}</div>
                </div>

                <div style={{ textAlign:"center", minWidth:72 }}>
                  <div style={{ fontSize:13, color:C.text }}>₹{item.sellPrice}</div>
                  {item.sellPrice > item.buyPrice && <div style={{ fontSize:11, color:C.green }}>+₹{item.sellPrice-item.buyPrice}</div>}
                </div>

                <div style={{ background:b.bg, color:b.color, fontSize:11, padding:"3px 9px", borderRadius:20, minWidth:52, textAlign:"center" }}>
                  {b.label}
                </div>

                {/* Quick ± */}
                <div style={{ display:"flex", gap:4 }}>
                  <button onClick={() => quickStock(item,-1)} title="एक विकले"
                    style={{ width:28, height:28, background:C.red+"22", border:`1px solid ${C.red}44`, borderRadius:6, color:C.red, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                  <button onClick={() => quickStock(item,1)} title="एक आले"
                    style={{ width:28, height:28, background:C.green+"22", border:`1px solid ${C.green}44`, borderRadius:6, color:C.green, cursor:"pointer", fontSize:15, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                </div>

                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={() => startEdit(item)}
                    style={{ padding:"5px 11px", background:"transparent", border:`1px solid ${C.border}`, borderRadius:6, color:C.muted, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>बदला</button>
                  <button onClick={() => del(item._id)}
                    style={{ padding:"5px 11px", background:"transparent", border:`1px solid ${C.red}44`, borderRadius:6, color:C.red, cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>काढा</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}