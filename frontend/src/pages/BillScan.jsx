import { useState, useRef } from "react";
import { billAPI, itemsAPI } from "../utils/api";
import toast from "react-hot-toast";

export default function BillScan() {
  const [preview, setPreview]       = useState(null);
  const [file, setFile]             = useState(null);
  const [scanning, setScanning]     = useState(false);
  const [scannedItems, setScannedItems] = useState([]);
  const [applying, setApplying]     = useState(false);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef();

  function handleFile(f) {
    if (!f) return;
    setFile(f); setScannedItems([]);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(f);
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  async function scanBill() {
    if (!file) return;
    setScanning(true);
    try {
      const form = new FormData();
      form.append("bill", file);
      const res = await billAPI.scan(form);
      setScannedItems(res.data.data.map(i => ({ ...i, selected: true, editing: false })));
      toast.success(`${res.data.count} माल सापडला!`);
    } catch { toast.error("बिल वाचण्यात अडचण. स्पष्ट फोटो घ्या."); }
    setScanning(false);
  }

  function toggle(idx) {
    setScannedItems(p => p.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
  }

  function updateQty(idx, val) {
    setScannedItems(p => p.map((it, i) => i === idx ? { ...it, quantity: parseFloat(val) || it.quantity } : it));
  }

  async function applyToStock() {
    const sel = scannedItems.filter(i => i.selected);
    if (!sel.length) return;
    setApplying(true);
    let success = 0;
    for (const item of sel) {
      try {
        const res = await itemsAPI.getAll({ search: item.name });
        const match = res.data.data[0];
        if (match) {
          await itemsAPI.updateStock(match._id, {
            quantityChanged: item.quantity, action: "restock",
            source: "bill", note: `बिल स्कॅन: ${item.name}`,
          });
          success++;
        }
      } catch {}
    }
    toast.success(`${success}/${sel.length} माल साठ्यात जोडला!`);
    setApplying(false); setScannedItems([]); setPreview(null); setFile(null);
  }

  function reset() { setFile(null); setPreview(null); setScannedItems([]); }

  const selectedCount = scannedItems.filter(i => i.selected).length;

  return (
    <div style={{ padding: 24, minHeight: "100vh", background: "var(--bg)" }} className="fade-in">

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>📄 बिल स्कॅन</h2>
        <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
          पुरवठादाराचे बिल फोटो काढा — AI सर्व माल आपोआप वाचेल
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: scannedItems.length ? "1fr 1fr" : "1fr", gap: 20, maxWidth: scannedItems.length ? "100%" : 560 }}>

        {/* Upload zone */}
        <div>
          <div
            onClick={() => !file && fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            style={{
              border: `2px dashed ${dragOver ? "var(--blue)" : preview ? "var(--green)" : "var(--border2)"}`,
              borderRadius: 16, padding: preview ? 0 : 48, textAlign: "center",
              cursor: preview ? "default" : "pointer",
              background: dragOver ? "#4f9cf910" : preview ? "var(--card)" : "var(--card)",
              transition: "all 0.2s", overflow: "hidden", marginBottom: 16,
            }}>
            {preview ? (
              <img src={preview} alt="bill" style={{ width: "100%", maxHeight: 340, objectFit: "contain", display: "block" }} />
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 14, opacity: 0.4 }}>◈</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>बिल इथे टाका</div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
                  क्लिक करा किंवा drag & drop करा<br />
                  JPG · PNG · Camera
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={e => handleFile(e.target.files[0])} style={{ display: "none" }} />
          </div>

          {/* Actions */}
          {file && !scannedItems.length && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={scanBill} disabled={scanning}
                style={{ flex: 1, padding: "13px", background: "var(--blue)", border: "none", borderRadius: 10, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                {scanning ? (
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>◌</span>
                    बिल वाचतोय…
                  </span>
                ) : "AI ने बिल वाचा →"}
              </button>
              <button onClick={reset}
                style={{ padding: "13px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", fontSize: 13 }}>
                रद्द
              </button>
            </div>
          )}

          {!file && (
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", marginBottom: 10 }}>कसे वापरायचे?</div>
              {[
                "पुरवठादाराचे बिल / invoice फोटो काढा",
                "AI सर्व items आणि quantities वाचेल",
                "हवे ते items निवडा — साठ्यात जोडा",
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, fontSize: 12, color: "var(--text3)" }}>
                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: "var(--blue)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>{i+1}</span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Scanned items */}
        {scannedItems.length > 0 && (
          <div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                  {scannedItems.length} माल सापडला
                </span>
                <button onClick={() => setScannedItems(p => p.map(i => ({ ...i, selected: selectedCount < scannedItems.length })))}
                  style={{ fontSize: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--text2)", padding: "4px 10px", borderRadius: 7 }}>
                  {selectedCount < scannedItems.length ? "सर्व निवडा" : "सर्व काढा"}
                </button>
              </div>

              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {scannedItems.map((item, idx) => (
                  <div key={idx}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: "1px solid var(--border)", background: item.selected ? "var(--green-glow)" : "transparent", transition: "background 0.15s" }}>
                    <input type="checkbox" checked={item.selected} onChange={() => toggle(idx)}
                      style={{ width: 16, height: 16, accentColor: "var(--green)", cursor: "pointer", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{item.name}</div>
                      {item.nameHindi && <div style={{ fontSize: 11, color: "var(--text3)" }}>{item.nameHindi}</div>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="number" value={item.quantity} onChange={e => updateQty(idx, e.target.value)}
                        style={{ width: 60, padding: "4px 8px", textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--green)" }} />
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>{item.unit || "pcs"}</span>
                    </div>
                    {item.buyPrice && (
                      <span style={{ fontSize: 11, color: "var(--text3)" }}>₹{item.buyPrice}</span>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 10 }}>
                <button onClick={applyToStock} disabled={applying || !selectedCount}
                  style={{ flex: 1, padding: "12px", background: !selectedCount ? "var(--border)" : "var(--green)", border: "none", borderRadius: 10, color: "#000", fontSize: 14, fontWeight: 700 }}>
                  {applying ? "जोडतोय…" : `${selectedCount} माल साठ्यात जोडा →`}
                </button>
                <button onClick={reset}
                  style={{ padding: "12px 16px", background: "transparent", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", fontSize: 13 }}>
                  रीसेट
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}