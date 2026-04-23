import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useState } from "react";

const navItems = [
  { path: "/",          label: "मुख्यपृष्ठ",    icon: "⊞",  color: "#10d9a0", desc: "Dashboard" },
  { path: "/voice",     label: "आवाजाने बदला", icon: "◉",  color: "#4f9cf9", desc: "Voice" },
  { path: "/inventory", label: "मालाची यादी",   icon: "▦",  color: "#f5c842", desc: "Inventory" },
  { path: "/bill",      label: "बिल स्कॅन",     icon: "◈",  color: "#a78bfa", desc: "Bill Scan" },
  { path: "/alerts",    label: "सूचना",          icon: "◎",  color: "#f5455a", desc: "Alerts" },
];

export default function Layout() {
  const loc = useLocation();
  const active = navItems.find(n => n.path === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.path));

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg)", fontFamily: "'Noto Sans Devanagari', sans-serif", overflow: "hidden" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 230, flexShrink: 0,
        background: "var(--bg2)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
      }}>

        {/* Logo */}
        <div style={{ padding: "24px 22px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: "linear-gradient(135deg, #10d9a0, #4f9cf9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#000", flexShrink: 0,
            }}>D</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", letterSpacing: 0.3 }}>DukanAI</div>
              <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>Digital Munim</div>
            </div>
          </div>

          {/* Current page indicator */}
          {active && (
            <div style={{
              marginTop: 10, padding: "6px 10px",
              background: active.color + "15",
              border: `1px solid ${active.color}30`,
              borderRadius: 8, display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: active.color, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: active.color, fontWeight: 600 }}>{active.label}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ padding: "10px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"}
              style={({ isActive }) => ({
                display: "flex", alignItems: "center", gap: 11,
                padding: "10px 12px", textDecoration: "none",
                color: isActive ? item.color : "var(--text2)",
                background: isActive ? item.color + "14" : "transparent",
                borderRadius: 10,
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: "all 0.15s",
                position: "relative",
              })}>
              {({ isActive }) => <>
                {isActive && (
                  <span style={{
                    position: "absolute", left: 0, top: "20%", bottom: "20%",
                    width: 3, borderRadius: "0 3px 3px 0",
                    background: item.color,
                  }} />
                )}
                <span style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? item.color + "25" : "transparent",
                  fontSize: 15,
                  color: isActive ? item.color : "var(--text3)",
                  transition: "all 0.15s",
                }}>
                  {item.icon}
                </span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {isActive && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: item.color, opacity: 0.7 }} />
                )}
              </>}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-block", width: 7, height: 7, borderRadius: "50%",
              background: "#10d9a0",
              boxShadow: "0 0 6px #10d9a080",
            }} />
            <span style={{ fontSize: 11, color: "var(--text3)" }}>Backend Connected</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 5 }}>DukanAI</div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg)", position: "relative" }}>
        <Outlet />
      </main>
    </div>
  );
}