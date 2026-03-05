import { useState, useMemo, useEffect, useCallback } from "react";

// ─── API ──────────────────────────────────────────────────────────────────────
// After deploying to Railway, replace the empty string with your Railway URL.
// Example: const API = "https://squash-elo-production.up.railway.app"
const API = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ─── Local ELO engine (for instant preview only) ──────────────────────────────
function validateScore(s1, s2) {
  const n1 = parseInt(s1), n2 = parseInt(s2);
  if (isNaN(n1) || isNaN(n2) || n1 < 0 || n2 < 0) return false;
  return Math.max(n1, n2) >= 11 && Math.abs(n1 - n2) >= 2;
}
function calcEloPreview(rA, rB, won, mc) {
  const k = rA >= 2000 ? 10 : mc >= 30 ? 20 : 40;
  const exp = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  return +(rA + k * ((won ? 1 : 0) - exp)).toFixed(1);
}

// ─── useIsMobile ──────────────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#0a0a0f", surface: "#111120", surfaceHi: "#161628",
  border: "#1e1e2e", borderHi: "#2a2a3e",
  text: "#e8e8f0", muted: "#555",
  lime: "#c8ff00", green: "#44ff77", red: "#ff4455", orange: "#ff8855", blue: "#4488ff",
};
const FONT = "'DM Mono','Courier New',monospace";

const S = {
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  label: { display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 6, fontWeight: 700 },
  input: { background: "#0d0d18", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "13px 14px", color: C.text, fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box", fontFamily: FONT, WebkitAppearance: "none" },
  select: { background: "#0d0d18", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "13px 38px 13px 14px", color: C.text, fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23555' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" },
  btn: { background: C.lime, color: "#0a0a0f", border: "none", borderRadius: 8, padding: "14px 24px", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", letterSpacing: "0.04em", touchAction: "manipulation" },
  btnGhost: { background: "transparent", color: C.red, border: `1px solid ${C.red}`, borderRadius: 8, padding: "14px 20px", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", touchAction: "manipulation" },
  sectionHead: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.lime, marginBottom: 14, fontWeight: 700 },
  row: (last) => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }),
};

function badge(type) {
  const m = { green: [C.green, "#0d2e0d", "#1a4a1a"], red: [C.red, "#2e0d0d", "#4a1a1a"], neutral: ["#888", "#1a1a2e", C.borderHi] };
  const [color, bg, border] = m[type] || m.neutral;
  return { display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color, background: bg, border: `1px solid ${border}` };
}

// ─── Mini components ──────────────────────────────────────────────────────────
function Sparkline({ history, w = 44, h = 22 }) {
  if (!history || history.length < 2) return null;
  const mn = Math.min(...history), mx = Math.max(...history), range = mx - mn || 1;
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * w},${h - 2 - ((v - mn) / range) * (h - 4)}`).join(" ");
  const up = history[history.length - 1] >= history[history.length - 2];
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={up ? C.lime : C.red} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function EloBar({ elo }) {
  const pct = Math.min(100, Math.max(0, ((elo - 800) / 600) * 100));
  const col = elo >= 1100 ? C.lime : elo >= 1000 ? C.blue : C.red;
  return (
    <div style={{ width: "100%", height: 3, background: "#1a1a2e", borderRadius: 2, overflow: "hidden", marginTop: 5 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: 2 }} />
    </div>
  );
}

function StatTile({ label, val, color = C.text }) {
  return (
    <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", flex: "1 1 80px" }}>
      <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
    </div>
  );
}

function Spinner() {
  return <div style={{ color: C.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading…</div>;
}

function ErrorBanner({ msg, onRetry }) {
  return (
    <div style={{ ...S.card, borderColor: "#4a1a1a", background: "#1a0808", color: C.red, fontSize: 13 }}>
      ✗ {msg}
      {onRetry && <button onClick={onRetry} style={{ marginLeft: 12, background: "none", border: "none", color: C.lime, cursor: "pointer", fontFamily: FONT, fontSize: 13 }}>Retry</button>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// LEADERBOARD
// ════════════════════════════════════════════════════════════════════════════════
function Leaderboard({ players, loading, error, onRetry }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <>
      <div style={S.sectionHead}>Leaderboard</div>
      {loading && <Spinner />}
      {error && <ErrorBanner msg={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div style={S.card}>
          {players.map((p, i) => (
            <div key={p.name} style={{ ...S.row(i === players.length - 1), opacity: p.matches === 0 ? 0.38 : 1 }}>
              <div style={{ width: 26, textAlign: "center", flexShrink: 0, fontSize: i < 3 ? 18 : 13, color: i >= 3 ? C.muted : undefined, fontWeight: 700 }}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <EloBar elo={p.elo} />
              </div>
              <Sparkline history={p.history} />
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: p.elo >= 1100 ? C.lime : p.elo >= 1000 ? C.text : C.orange }}>{p.elo.toFixed(0)}</div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  <span style={{ color: C.green }}>{p.wins}W</span> · <span style={{ color: C.red }}>{p.losses}L</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// LOG MATCH
// ════════════════════════════════════════════════════════════════════════════════
function LogMatch({ players, onLogged }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [apiError, setApiError] = useState("");

  const names = players.map(p => p.name).sort();
  const entered = s1 !== "" && s2 !== "";
  const scoreOk = entered && validateScore(s1, s2);
  const ready = p1 && p2 && p1 !== p2 && scoreOk && !submitting;

  const playerMap = useMemo(() => Object.fromEntries(players.map(p => [p.name, p])), [players]);

  const preview = useMemo(() => {
    if (!ready) return null;
    const r1 = playerMap[p1]?.elo ?? 1000, r2 = playerMap[p2]?.elo ?? 1000;
    const m1 = playerMap[p1]?.matches ?? 0, m2 = playerMap[p2]?.matches ?? 0;
    const p1wins = parseInt(s1) > parseInt(s2);
    const expP1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
    return { r1, r2, p1wins, expP1, p1post: calcEloPreview(r1, r2, p1wins, m1), p2post: calcEloPreview(r2, r1, !p1wins, m2) };
  }, [p1, p2, s1, s2, ready, playerMap]);

  async function submit() {
    if (!ready) return;
    setSubmitting(true); setApiError("");
    try {
      const result = await apiFetch("/matches", {
        method: "POST",
        body: JSON.stringify({ p1, p2, s1: parseInt(s1), s2: parseInt(s2) }),
      });
      setToast(`✓ Logged — ${result.winner} won ${Math.max(result.s1,result.s2)}–${Math.min(result.s1,result.s2)}`);
      setP1(""); setP2(""); setS1(""); setS2("");
      setTimeout(() => setToast(""), 4000);
      onLogged();
    } catch (e) {
      setApiError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={S.sectionHead}>Log Match</div>
      {toast && <div style={{ ...S.card, borderColor: "#1a4a1a", background: "#081408", color: C.green, fontSize: 13 }}>{toast}</div>}
      {apiError && <ErrorBanner msg={apiError} />}

      <div style={S.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          {[{ lbl: "Player 1", val: p1, set: setP1, excl: p2 }, { lbl: "Player 2", val: p2, set: setP2, excl: p1 }].map(({ lbl, val, set, excl }) => (
            <div key={lbl}>
              <label style={S.label}>{lbl}</label>
              <select style={S.select} value={val} onChange={e => { set(e.target.value); setApiError(""); }}>
                <option value="">Select…</option>
                {names.filter(n => n !== excl).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ lbl: p1 || "P1", val: s1, set: setS1, ph: "11" }, { lbl: p2 || "P2", val: s2, set: setS2, ph: "7" }].map(({ lbl, val, set, ph }) => (
            <div key={lbl}>
              <label style={S.label}>{lbl} Score</label>
              <input style={{ ...S.input, borderColor: entered && !scoreOk ? C.red : C.borderHi }} type="number" inputMode="numeric" min={0} max={50} value={val} onChange={e => set(e.target.value)} placeholder={ph} />
            </div>
          ))}
        </div>

        {entered && !scoreOk && <div style={{ marginTop: 10, fontSize: 12, color: C.red, lineHeight: 1.5 }}>✗ Invalid — win by 2 with ≥11 pts (e.g. 11–7, 12–10, 15–13)</div>}

        {preview && (
          <div style={{ marginTop: 14, padding: 14, background: "#0d0d18", borderRadius: 8, border: `1px solid ${C.border}` }}>
            <div style={{ ...S.label, marginBottom: 10 }}>ELO Preview</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[{ name: p1, pre: preview.r1, post: preview.p1post, exp: preview.expP1 }, { name: p2, pre: preview.r2, post: preview.p2post, exp: 1 - preview.expP1 }].map(({ name, pre, post, exp }) => {
                const d = post - pre;
                return (
                  <div key={name} style={{ background: C.surface, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{name}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: C.muted }}>{pre.toFixed(0)} →</span>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.lime }}>{post.toFixed(1)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: d >= 0 ? C.green : C.red }}>{d >= 0 ? "+" : ""}{d.toFixed(1)}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#444", marginTop: 5 }}>{(exp * 100).toFixed(0)}% win prob</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 12, color: "#888" }}>Winner: <span style={{ color: C.lime, fontWeight: 700 }}>{preview.p1wins ? p1 : p2}</span></div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button style={{ ...S.btn, flex: 1, opacity: ready ? 1 : 0.3, cursor: ready ? "pointer" : "not-allowed" }} onClick={submit} disabled={!ready}>
            {submitting ? "Logging…" : "Log Match"}
          </button>
          <button style={S.btnGhost} onClick={() => { setP1(""); setP2(""); setS1(""); setS2(""); setApiError(""); }}>Clear</button>
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLAYER STATS
// ════════════════════════════════════════════════════════════════════════════════
function PlayerStats({ players, matches }) {
  const [sel, setSel] = useState("");
  const names = players.map(p => p.name).sort();
  const p = sel ? players.find(x => x.name === sel) : null;
  const recent = p ? matches.filter(m => m.valid && (m.p1 === sel || m.p2 === sel)).slice(-5).reverse() : [];

  return (
    <>
      <div style={S.sectionHead}>Player Stats</div>
      <div style={S.card}>
        <label style={S.label}>Select Player</label>
        <select style={S.select} value={sel} onChange={e => setSel(e.target.value)}>
          <option value="">— choose —</option>
          {names.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {p && (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            <StatTile label="ELO"    val={p.elo.toFixed(1)}  color={C.lime} />
            <StatTile label="Peak"   val={p.peak.toFixed(0)} color={C.green} />
            <StatTile label="Low"    val={p.low.toFixed(0)}  color={C.orange} />
            <StatTile label="Played" val={p.matches} />
            <StatTile label="Wins"   val={p.wins}   color={C.green} />
            <StatTile label="Losses" val={p.losses} color={C.red} />
            <StatTile label="Win %"  val={p.matches > 0 ? `${(p.wins / p.matches * 100).toFixed(0)}%` : "—"} />
            <StatTile label="K"      val={p.elo >= 2000 ? 10 : p.matches >= 30 ? 20 : 40} color={C.muted} />
          </div>

          <div style={S.card}>
            <div style={S.label}>ELO History</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
              {p.history.map((v, i) => {
                const mn = Math.min(...p.history), mx = Math.max(...p.history);
                const h = Math.max(4, ((v - mn) / (mx - mn || 1)) * 44 + 4);
                const up = i === 0 || v >= p.history[i - 1];
                return <div key={i} style={{ flex: 1, height: h, background: up ? C.lime : C.red, borderRadius: "2px 2px 0 0", opacity: 0.82, minWidth: 4, maxWidth: 32 }} />;
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "#333" }}>
              <span>Start · 1000</span><span>Now · {p.elo.toFixed(0)}</span>
            </div>
          </div>

          {recent.length > 0 && (
            <div style={S.card}>
              <div style={S.label}>Recent Matches</div>
              {recent.map((m, i) => {
                const isP1 = m.p1 === sel, opp = isP1 ? m.p2 : m.p1, won = m.winner === sel;
                const myPost = isP1 ? m.p1post : m.p2post, myPre = isP1 ? m.p1pre : m.p2pre;
                const d = myPost - myPre, score = isP1 ? `${m.s1}–${m.s2}` : `${m.s2}–${m.s1}`;
                return (
                  <div key={m.id} style={S.row(i === recent.length - 1)}>
                    <span style={badge(won ? "green" : "red")}>{won ? "W" : "L"}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>vs {opp}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{score} · {m.date}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: d >= 0 ? C.green : C.red }}>{d >= 0 ? "+" : ""}{d.toFixed(1)}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{myPost?.toFixed(0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// HEAD-TO-HEAD
// ════════════════════════════════════════════════════════════════════════════════
function HeadToHead({ players, matches }) {
  const [pA, setPA] = useState(""), [pB, setPB] = useState("");
  const names = players.map(p => p.name).sort();

  const h2h = useMemo(() => {
    if (!pA || !pB || pA === pB) return null;
    const rel = matches.filter(m => m.valid && ((m.p1 === pA && m.p2 === pB) || (m.p1 === pB && m.p2 === pA)));
    return { all: [...rel].reverse(), winsA: rel.filter(m => m.winner === pA).length, winsB: rel.filter(m => m.winner === pB).length };
  }, [pA, pB, matches]);

  return (
    <>
      <div style={S.sectionHead}>Head-to-Head</div>
      <div style={S.card}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[{ lbl: "Player A", val: pA, set: setPA, excl: pB }, { lbl: "Player B", val: pB, set: setPB, excl: pA }].map(({ lbl, val, set, excl }) => (
            <div key={lbl}>
              <label style={S.label}>{lbl}</label>
              <select style={S.select} value={val} onChange={e => set(e.target.value)}>
                <option value="">Select…</option>
                {names.filter(n => n !== excl).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {h2h && (h2h.all.length === 0
        ? <div style={{ ...S.card, color: C.muted, textAlign: "center", padding: 36, fontSize: 13 }}>No matches played between these two yet.</div>
        : <>
          <div style={S.card}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {[[pA, h2h.winsA, h2h.winsA >= h2h.winsB], [pB, h2h.winsB, h2h.winsB > h2h.winsA]].map(([name, wins, leading], idx) => (
                <div key={name} style={{ flex: 1, textAlign: idx === 0 ? "left" : "right" }}>
                  <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{name}</div>
                  <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: leading ? C.lime : C.text }}>{wins}</div>
                </div>
              ))}
              <div style={{ color: "#333", fontSize: 16, fontWeight: 700, padding: "0 12px" }}>vs</div>
            </div>
            <div style={{ display: "flex", height: 4, borderRadius: 3, overflow: "hidden", marginTop: 16, gap: 1 }}>
              <div style={{ flex: h2h.winsA || 0.5, background: C.lime }} />
              <div style={{ flex: h2h.winsB || 0.5, background: C.borderHi }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: C.muted }}>
              <span>{((h2h.winsA / h2h.all.length) * 100).toFixed(0)}%</span>
              <span>{h2h.all.length} match{h2h.all.length !== 1 ? "es" : ""}</span>
              <span>{((h2h.winsB / h2h.all.length) * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.label}>Match History</div>
            {h2h.all.map((m, i) => {
              const aIsP1 = m.p1 === pA, aWon = m.winner === pA;
              const score = aIsP1 ? `${m.s1}–${m.s2}` : `${m.s2}–${m.s1}`;
              const preA = aIsP1 ? m.p1pre : m.p2pre, postA = aIsP1 ? m.p1post : m.p2post;
              const dA = postA - preA;
              return (
                <div key={m.id} style={S.row(i === h2h.all.length - 1)}>
                  <span style={badge(aWon ? "green" : "red")}>{m.winner}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{pA} {score} {pB}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                      {pA}: {preA.toFixed(0)} → <span style={{ color: dA >= 0 ? C.green : C.red, fontWeight: 700 }}>{postA?.toFixed(0)}</span>
                      <span style={{ color: dA >= 0 ? C.green : C.red }}> ({dA >= 0 ? "+" : ""}{dA.toFixed(1)})</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{m.date}</div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// APP
// ════════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "leaderboard", icon: "⬡", label: "Board" },
  { id: "log",         icon: "+",  label: "Log"   },
  { id: "stats",       icon: "◎",  label: "Stats" },
  { id: "h2h",         icon: "⇄",  label: "H2H"   },
];

export default function App() {
  const [tab, setTab] = useState("leaderboard");
  const isMobile = useIsMobile();

  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  const fetchAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiFetch("/stats");
      setPlayers(data.players);
      setMatches(data.matches);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const content = () => {
    if (tab === "leaderboard") return <Leaderboard players={players} loading={loading} error={error} onRetry={fetchAll} />;
    if (tab === "log")         return <LogMatch players={players} onLogged={fetchAll} />;
    if (tab === "stats")       return <PlayerStats players={players} matches={matches} />;
    if (tab === "h2h")         return <HeadToHead players={players} matches={matches} />;
  };

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: isMobile ? 72 : 0 }}>

      {/* Header */}
      <div style={{ background: "#0d0d18", borderBottom: `1px solid ${C.border}`, padding: isMobile ? "13px 16px" : "13px 24px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: C.lime, letterSpacing: "-0.5px" }}>◈ SQUASH ELO</div>
        {/* Export button */}
        <a href={`${API}/export`} style={{ marginLeft: isMobile ? "auto" : 16, fontSize: 11, color: C.muted, textDecoration: "none", letterSpacing: "0.08em", padding: "5px 10px", border: `1px solid ${C.borderHi}`, borderRadius: 5 }}>
          ↓ xlsx
        </a>
        {!isMobile && (
          <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "7px 16px", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", border: tab === t.id ? `1px solid ${C.lime}` : `1px solid ${C.borderHi}`, background: tab === t.id ? C.lime : "transparent", color: tab === t.id ? "#0a0a0f" : "#888", cursor: "pointer", borderRadius: 6, fontFamily: FONT, fontWeight: tab === t.id ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: isMobile ? "16px 14px" : "28px 24px", maxWidth: 960, margin: "0 auto" }}>
        {content()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, background: "#0d0d18", borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "10px 0 8px", border: "none", background: "transparent", color: active ? C.lime : "#444", cursor: "pointer", fontFamily: FONT, touchAction: "manipulation" }}>
                <span style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: active ? 700 : 400 }}>{t.label}</span>
                {active && <div style={{ width: 18, height: 2, background: C.lime, borderRadius: 1 }} />}
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
}
