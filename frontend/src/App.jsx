import { useState, useMemo, useEffect, useCallback } from "react";
import ChallengeMode from "./ChallengeMode";

// ─── API ──────────────────────────────────────────────────────────────────────
// For unified deployment (FastAPI serves frontend), leave VITE_API_URL unset.
// For separate deployment (e.g. Netlify), set VITE_API_URL to your Railway URL.
const API = import.meta.env.VITE_API_URL ?? "";

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API}/api${path}`, {
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
function calcEloPreview(rA, rB, won, mc, sA, sB) {
  const k = rA >= 2000 ? 10 : mc >= 30 ? 20 : 40;
  const exp = 1 / (1 + Math.pow(10, (rB - rA) / 400));
  const multiplier = 1 + Math.abs(sA - sB) / Math.max(sA, sB);
  return +(rA + k * multiplier * ((won ? 1 : 0) - exp)).toFixed(1);
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
  bg: "#2C2C2A", surface: "#1E1E1C", surfaceHi: "#252523",
  border: "rgba(255,255,255,0.1)", borderHi: "rgba(255,255,255,0.15)",
  text: "#ffffff", muted: "#9C9A92", tertiary: "#6B6A63",
  accent: "#88aaff", green: "#44ff77", red: "#ff4455", orange: "#ff8855", blue: "#4488ff",
};
const FONT = "'DM Mono','Courier New',monospace";

const S = {
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 12 },
  label: { display: "block", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: C.tertiary, marginBottom: 6, fontWeight: 700 },
  input: { background: "#252523", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "13px 14px", color: C.text, fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box", fontFamily: FONT, WebkitAppearance: "none" },
  select: { background: "#252523", border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: "13px 38px 13px 14px", color: C.text, fontSize: 16, width: "100%", outline: "none", boxSizing: "border-box", cursor: "pointer", fontFamily: FONT, WebkitAppearance: "none", appearance: "none", backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B6A63' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" },
  btn: { background: C.accent, color: "#0a0a0f", border: "none", borderRadius: 8, padding: "14px 24px", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", letterSpacing: "0.04em", touchAction: "manipulation" },
  btnSmall: { background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: "pointer", touchAction: "manipulation" },
  btnGhost: { background: "transparent", color: C.red, border: `1px solid ${C.red}`, borderRadius: 8, padding: "14px 20px", fontSize: 14, fontWeight: 700, fontFamily: FONT, cursor: "pointer", touchAction: "manipulation" },
  sectionHead: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.tertiary, marginBottom: 14, fontWeight: 700 },
  pageHead: { fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: C.accent, marginBottom: 14, fontWeight: 700 },
  row: (last) => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }),
};

function badge(type) {
  const m = { green: [C.green, "#1a3a1a", "#2a5a2a"], red: [C.red, "#3a1a1a", "#5a2a2a"], neutral: ["#888", C.surface, C.borderHi] };
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
      <polyline points={pts} fill="none" stroke={up ? C.accent : C.red} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function EloBar({ elo }) {
  const pct = Math.min(100, Math.max(0, ((elo - 800) / 600) * 100));
  const col = elo >= 1100 ? "#E0A84B" : elo >= 1000 ? C.accent : elo >= 900 ? C.muted : C.red;
  return (
    <div style={{ width: "100%", height: 3, background: C.border, borderRadius: 2, overflow: "hidden", marginTop: 5 }}>
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
    <div style={{ ...S.card, borderColor: "#6a2a2a", background: "#2e1010", color: C.red, fontSize: 13 }}>
      ✗ {msg}
      {onRetry && <button onClick={onRetry} style={{ marginLeft: 12, background: "none", border: "none", color: C.accent, cursor: "pointer", fontFamily: FONT, fontSize: 13 }}>Retry</button>}
    </div>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// MATCH PREVIEW
// ════════════════════════════════════════════════════════════════════════════════
function MatchPreview({ p1, p2, playerMap, matches, onBack, onLogged }) {
  const pd1 = playerMap[p1] ?? { elo: 1000, matches: 0 };
  const pd2 = playerMap[p2] ?? { elo: 1000, matches: 0 };
  const r1 = pd1.elo, r2 = pd2.elo;
  const m1 = pd1.matches, m2 = pd2.matches;

  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [matchDate, setMatchDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState("");
  const entered = s1 !== "" && s2 !== "";
  const scoreOk = entered && validateScore(s1, s2);

  async function submit() {
    if (!scoreOk || submitting) return;
    setSubmitting(true); setApiError("");
    try {
      await apiFetch("/matches", { method: "POST", body: JSON.stringify({ p1, p2, s1: parseInt(s1), s2: parseInt(s2), date: matchDate }) });
      onLogged();
    } catch (e) {
      setApiError(e.message);
      setSubmitting(false);
    }
  }

  const expP1 = 1 / (1 + Math.pow(10, (r2 - r1) / 400));
  const pctP1 = Math.round(expP1 * 100), pctP2 = 100 - pctP1;

  const eloDiff = Math.abs(r1 - r2);
  const underdogName = eloDiff >= 150 ? (r1 < r2 ? p1 : p2) : null;

  const h2hAll = matches.filter(m => m.valid && ((m.p1 === p1 && m.p2 === p2) || (m.p1 === p2 && m.p2 === p1)));
  const winsP1 = h2hAll.filter(m => m.winner === p1).length;
  const winsP2 = h2hAll.filter(m => m.winner === p2).length;

  let streak = 0, streakWinner = null;
  for (const m of [...h2hAll].reverse()) {
    if (!streakWinner) streakWinner = m.winner;
    if (m.winner === streakWinner) streak++; else break;
  }

  const form = name => matches.filter(m => m.valid && (m.p1 === name || m.p2 === name)).slice(-5).map(m => m.winner === name ? "W" : "L");
  const formP1 = form(p1), formP2 = form(p2);

  const getK = (elo, mc) => elo >= 2000 ? 10 : mc >= 30 ? 20 : 40;
  const maxStake = Math.max(Math.round(getK(r1, m1) * 2 * (1 - expP1)), Math.round(getK(r2, m2) * 2 * expP1));

  const initials = name => name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const underdogH2hNote = (() => {
    if (!underdogName) return null;
    const favName = underdogName === p1 ? p2 : p1;
    const uWins = underdogName === p1 ? winsP1 : winsP2;
    const fWins = underdogName === p1 ? winsP2 : winsP1;
    const total = uWins + fWins;
    if (total === 0) return null;
    return `${underdogName} is ${uWins}–${fWins} vs ${favName} all time`;
  })();

  const divider = <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "14px 0" }} />;

  return (
    <div style={S.card}>
      <div style={{ ...S.sectionHead, marginBottom: 18 }}>Match Preview</div>

      {/* Players VS row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "flex-start", marginBottom: 20, gap: 8 }}>
        {[{ name: p1, elo: r1, av: "#E6F1FB", avText: "#0C447C" }, { name: p2, elo: r2, av: "#E1F5EE", avText: "#085041" }].map(({ name, elo, av, avText }) => (
          <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: av, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: avText }}>
              {initials(name)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, textAlign: "center", color: C.text }}>{name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>{elo.toFixed(0)} ELO</div>
            {name === underdogName && (
              <div style={{ background: "#FAEEDA", color: "#633806", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.05em" }}>Underdog</div>
            )}
          </div>
        ))}
        {/* VS — sits in the middle column, pushed down to name level */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 60, fontSize: 15, fontWeight: 500, color: C.muted, gridRow: 1, gridColumn: 2 }}>vs</div>
      </div>

      {/* Win probability bar */}
      <div style={{ ...S.label, marginBottom: 7 }}>Win Probability</div>
      <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 28, marginBottom: 4 }}>
        <div style={{ flex: pctP1, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#0C447C" }}>
          {pctP1 > 15 ? `${pctP1}%` : ""}
        </div>
        <div style={{ flex: pctP2, background: "#FAEEDA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#633806" }}>
          {pctP2 > 15 ? `${pctP2}%` : ""}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.muted, marginBottom: 2 }}>
        <span>{p1} {pctP1}%</span><span>{p2} {pctP2}%</span>
      </div>

      {divider}

      {/* H2H */}
      <div style={{ ...S.label, marginBottom: 10 }}>Head to Head</div>
      {h2hAll.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "8px 0" }}>No matches played yet — first time facing each other!</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{winsP1}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{p1} wins</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>{h2hAll.length} played</div>
              {streakWinner && streak >= 2 && (
                <div style={{ background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                  {streakWinner} +{streak} streak
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: C.text }}>{winsP2}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{p2} wins</div>
            </div>
          </div>
          {underdogH2hNote && (
            <div style={{ fontSize: 11, color: C.muted, textAlign: "center", marginTop: 8 }}>{underdogH2hNote}</div>
          )}
        </>
      )}

      {divider}

      {/* Form */}
      <div style={{ ...S.label, marginBottom: 10 }}>Recent Form (last 5)</div>
      {[{ name: p1, form: formP1 }, { name: p2, form: formP2 }].map(({ name, form: f }) => (
        <div key={name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: C.muted, width: 60, flexShrink: 0 }}>{name}</div>
          <div style={{ display: "flex", gap: 4 }}>
            {f.length === 0
              ? <span style={{ fontSize: 11, color: C.muted }}>No matches yet</span>
              : f.map((r, i) => (
                <div key={i} style={{ width: 22, height: 22, borderRadius: "50%", background: r === "W" ? "#EAF3DE" : "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: r === "W" ? "#27500A" : "#791F1F" }}>
                  {r}
                </div>
              ))
            }
          </div>
        </div>
      ))}

      {divider}

      {/* Stakes */}
      <div style={{ background: C.surfaceHi, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.muted }}>ELO on the line</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>up to ±{maxStake} pts</div>
      </div>

      {/* Score entry */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        {[{ lbl: p1, val: s1, set: setS1, ph: "11" }, { lbl: p2, val: s2, set: setS2, ph: "7" }].map(({ lbl, val, set, ph }) => (
          <div key={lbl}>
            <label style={S.label}>{lbl} Score</label>
            <input style={{ ...S.input, borderColor: entered && !scoreOk ? C.red : C.borderHi }} type="number" inputMode="numeric" min={0} max={50} value={val} onChange={e => set(e.target.value)} placeholder={ph} />
          </div>
        ))}
      </div>
      {entered && !scoreOk && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>✗ Win by 2 with ≥11 pts (e.g. 11–7, 12–10)</div>}

      <div style={{ marginBottom: 10 }}>
        <label style={S.label}>Match Date</label>
        <input
          style={{ ...S.input }}
          type="date"
          value={matchDate}
          onChange={e => setMatchDate(e.target.value)}
        />
      </div>
      {apiError && <ErrorBanner msg={apiError} />}

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button onClick={onBack} style={{ ...S.btnGhost, color: C.muted, borderColor: C.borderHi, padding: "14px 16px" }}>←</button>
        <button onClick={submit} disabled={!scoreOk || submitting} style={{ ...S.btn, flex: 1, opacity: scoreOk && !submitting ? 1 : 0.3, cursor: scoreOk && !submitting ? "pointer" : "not-allowed" }}>
          {submitting ? "Logging…" : "Submit Result"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// LOG MATCH
// ════════════════════════════════════════════════════════════════════════════════
function LogMatch({ players, matches, onLogged, preselect, onClearPreselect }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [step, setStep] = useState("select"); // "select" | "preview"
  const [toast, setToast] = useState("");

  const names = players.map(p => p.name).sort();
  const playerMap = useMemo(() => Object.fromEntries(players.map(p => [p.name, p])), [players]);

  useEffect(() => {
    if (preselect) {
      setP1(preselect.challenger);
      setP2(preselect.challenged);
      if (onClearPreselect) onClearPreselect();
    }
  }, [preselect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (p1 && p2 && p1 !== p2) setStep("preview");
    else setStep("select");
  }, [p1, p2]);

  function handleLogged() {
    setToast("✓ Match logged!");
    setP1(""); setP2(""); setStep("select");
    setTimeout(() => setToast(""), 4000);
    onLogged();
  }

  return (
    <>
      <div style={S.pageHead}>Match</div>
      {toast && <div style={{ ...S.card, borderColor: "#2a6a2a", background: "#102010", color: C.green, fontSize: 13 }}>{toast}</div>}

      {step === "select" && (
        <div style={S.card}>
          <div style={{ marginBottom: 2 }}>
            <label style={S.label}>Who played?</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
              {(() => {
                const pairs = [];
                for (let i = 0; i < names.length; i++)
                  for (let j = i + 1; j < names.length; j++)
                    pairs.push([names[i], names[j]]);
                return pairs.map(([a, b]) => {
                  const selected = (p1 === a && p2 === b) || (p1 === b && p2 === a);
                  return (
                    <button key={`${a}-${b}`}
                      style={{ ...S.btn, flex: 1, minWidth: 100, background: selected ? C.accent : C.surface, opacity: selected ? 1 : 0.6, border: `1px solid ${selected ? C.accent : C.border}` }}
                      onClick={() => { setP1(a); setP2(b); }}>
                      {a} vs {b}
                    </button>
                  );
                });
              })()}
            </div>
          </div>
          {players.length < 2 && <div style={{ marginTop: 12, fontSize: 12, color: C.muted }}>Add at least 2 players on the Board tab first.</div>}
        </div>
      )}

      {step === "preview" && (
        <MatchPreview
          p1={p1} p2={p2}
          playerMap={playerMap}
          matches={matches}
          onBack={() => setStep("select")}
          onLogged={handleLogged}
        />
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PLAYERS PAGE (roster + add player)
// ════════════════════════════════════════════════════════════════════════════════
function PlayersPage({ players, loading, error, onRetry, onAdded, lastMatch, identity }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [apiError, setApiError] = useState("");
  const medals = ["🥇", "🥈", "🥉"];

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true); setApiError("");
    try {
      await apiFetch("/players", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setToast(`Added ${trimmed}`);
      setName("");
      setTimeout(() => setToast(""), 3000);
      onAdded();
    } catch (e) {
      setApiError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div style={S.pageHead}>Leaderboard</div>
      {lastMatch && (
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, letterSpacing: "0.04em" }}>
          Last match{" "}
          <span style={{ color: C.text }}>
            {lastMatch.days === 0 ? "today" : lastMatch.days === 1 ? "yesterday" : `${lastMatch.days} days ago`}
          </span>
          {" · "}
          <span style={{ color: C.tertiary }}>{lastMatch.p1} vs {lastMatch.p2}</span>
        </div>
      )}
      {loading && <Spinner />}
      {error && <ErrorBanner msg={error} onRetry={onRetry} />}
      {!loading && !error && (
        <div style={S.card}>
          {players.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>No players yet — add one below.</div>}
          {players.map((p, i) => {
            const isMe = p.name === identity && identity && identity !== "__guest__";
            return (
            <div key={p.name} style={{ ...S.row(i === players.length - 1), ...(isMe && { background: "rgba(136,170,255,0.06)", borderLeft: `3px solid ${C.accent}`, paddingLeft: 11, marginLeft: -16, marginRight: -16, paddingRight: 16 }) }}>
              <div style={{ width: 26, textAlign: "center", flexShrink: 0, fontSize: i < 3 ? 18 : 13, color: i >= 3 ? C.muted : undefined, fontWeight: 700 }}>
                {i < 3 ? medals[i] : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: C.text }}>{p.name}</div>
                <EloBar elo={p.elo} />
              </div>
              <Sparkline history={p.history} />
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 5, justifyContent: "flex-end" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{p.elo.toFixed(0)}</div>
                  {p.history && p.history.length >= 2 && (() => {
                    const delta = Math.round(p.history[p.history.length - 1] - p.history[p.history.length - 2]);
                    if (delta === 0) return null;
                    return (
                      <div style={{ fontSize: 11, fontWeight: 700, color: delta > 0 ? C.green : C.red }}>
                        {delta > 0 ? `+${delta}` : delta}
                      </div>
                    );
                  })()}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                  <span style={{ color: C.green }}>{p.wins}W</span>
                  {" · "}
                  <span style={{ color: C.red }}>{p.losses}L</span>
                  {" · "}
                  <span>{p.matches > 0 ? `${(p.wins / p.matches * 100).toFixed(0)}%` : "—"}</span>
                </div>
              </div>
            </div>
          );})}
        </div>
      )}

      <div style={S.sectionHead}>Add Player</div>
      {toast && <div style={{ ...S.card, borderColor: "#2a4a6a", background: "#101828", color: C.accent, fontSize: 13 }}>{toast}</div>}
      {apiError && <ErrorBanner msg={apiError} />}
      <div style={S.card}>
        <label style={S.label}>Player Name</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            style={S.input}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setApiError(""); }}
            placeholder="Enter name…"
            onKeyDown={e => e.key === "Enter" && submit()}
          />
          <button
            style={{ ...S.btn, opacity: name.trim() && !submitting ? 1 : 0.3, cursor: name.trim() && !submitting ? "pointer" : "not-allowed", whiteSpace: "nowrap" }}
            onClick={submit}
            disabled={!name.trim() || submitting}
          >
            {submitting ? "Adding…" : "Add"}
          </button>
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
  const [hoverBack, setHoverBack] = useState(false);
  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const medals = ["🥇", "🥈", "🥉"];
  const p = sel ? players.find(x => x.name === sel) : null;
  const recent = p ? matches.filter(m => m.valid && (m.p1 === sel || m.p2 === sel)).slice(-5).reverse() : [];

  const playerMatches = p ? matches.filter(m => (m.p1 === sel || m.p2 === sel) && m.valid) : [];
  const winMatches  = playerMatches.filter(m => m.winner === sel);
  const lossMatches = playerMatches.filter(m => m.winner && m.winner !== sel);
  const avgWinMargin  = winMatches.length === 0  ? "—" : `+${(winMatches.reduce((s, m)  => s + Math.abs(m.s1 - m.s2), 0) / winMatches.length).toFixed(1)}`;
  const avgLossMargin = lossMatches.length === 0 ? "—" : `-${(lossMatches.reduce((s, m) => s + Math.abs(m.s1 - m.s2), 0) / lossMatches.length).toFixed(1)}`;

  if (!sel) return (
    <>
      <div style={S.pageHead}>Stats</div>
      <div style={S.card}>
        {sorted.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>No players yet.</div>}
        {sorted.map((pl, i) => (
          <div key={pl.name} onClick={() => setSel(pl.name)}
            style={{ ...S.row(i === sorted.length - 1), cursor: "pointer" }}>
            <div style={{ width: 26, textAlign: "center", flexShrink: 0, fontSize: i < 3 ? 18 : 13, color: i >= 3 ? C.muted : undefined, fontWeight: 700 }}>
              {i < 3 ? medals[i] : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{pl.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                <span style={{ color: C.green }}>{pl.wins}W</span>
                {" · "}
                <span style={{ color: C.red }}>{pl.losses}L</span>
                {" · "}
                <span>{pl.matches > 0 ? `${(pl.wins / pl.matches * 100).toFixed(0)}%` : "—"}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{pl.elo.toFixed(0)}</div>
              <div style={{ fontSize: 10, color: C.muted }}>ELO</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setSel("")}
        style={{ ...S.btnSmall, marginBottom: 14, fontSize: 12, padding: "7px 14px", ...(hoverBack && { background: "rgba(136,170,255,0.12)", borderColor: "#88aaff" }) }}
        onMouseEnter={() => setHoverBack(true)}
        onMouseLeave={() => setHoverBack(false)}
      >← Back</button>

      {p && <>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <StatTile label="ELO"    val={p.elo.toFixed(1)}  color={C.text} />
          <StatTile label="Peak"   val={p.peak.toFixed(0)} color={C.green} />
          <StatTile label="Low"    val={p.low.toFixed(0)}  color={C.orange} />
          <StatTile label="Played" val={p.matches} />
          <StatTile label="Wins"   val={p.wins}   color={C.green} />
          <StatTile label="Losses" val={p.losses} color={C.red} />
          <StatTile label="Win %"      val={p.matches > 0 ? `${(p.wins / p.matches * 100).toFixed(0)}%` : "—"} />
          <StatTile label="Win Margin"  val={avgWinMargin}  color={avgWinMargin  === "—" ? C.muted : C.green} />
          <StatTile label="Loss Margin" val={avgLossMargin} color={avgLossMargin === "—" ? C.muted : C.red} />
          <StatTile label="K"           val={p.elo >= 2000 ? 10 : p.matches >= 30 ? 20 : 40} color={C.muted} />
        </div>

        <div style={S.card}>
          <div style={S.label}>ELO History</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52 }}>
            {p.history.map((v, i) => {
              const mn = Math.min(...p.history), mx = Math.max(...p.history);
              const h = Math.max(4, ((v - mn) / (mx - mn || 1)) * 44 + 4);
              const up = i === 0 || v >= p.history[i - 1];
              return <div key={i} style={{ flex: 1, height: h, background: up ? C.accent : C.red, borderRadius: "2px 2px 0 0", opacity: 0.82, minWidth: 4, maxWidth: 32 }} />;
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
      </>}
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
      <div style={S.pageHead}>Head-to-Head</div>
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
                  <div style={{ fontSize: 52, fontWeight: 700, lineHeight: 1, color: leading ? C.accent : C.text }}>{wins}</div>
                </div>
              ))}
              <div style={{ color: "#333", fontSize: 16, fontWeight: 700, padding: "0 12px" }}>vs</div>
            </div>
            <div style={{ display: "flex", height: 4, borderRadius: 3, overflow: "hidden", marginTop: 16, gap: 1 }}>
              <div style={{ flex: h2h.winsA || 0.5, background: C.accent }} />
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
// ════════════════════════════════════════════════════════════════════════════════
// MATCH HISTORY
// ════════════════════════════════════════════════════════════════════════════════
function MatchHistory({ matches, onDeleted, isAdmin, adminToken }) {
  const [deleting, setDeleting] = useState(null);

  async function del(id) {
    setDeleting(id);
    try {
      await apiFetch(`/matches/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` } });
      onDeleted();
    } catch (e) {
      alert(e.message);
    } finally {
      setDeleting(null);
    }
  }

  const valid = [...matches].filter(m => m.valid).reverse();

  return (
    <>
      <div style={S.pageHead}>Match History</div>
      {valid.length === 0 && (
        <div style={{ ...S.card, color: C.muted, textAlign: "center", padding: 36, fontSize: 13 }}>No matches logged yet.</div>
      )}
      {valid.length > 0 && (
        <div style={S.card}>
          {valid.map((m, i) => {
            const score = `${Math.max(m.s1, m.s2)}–${Math.min(m.s1, m.s2)}`;
            const winnerIsP1 = m.winner === m.p1;
            return (
              <div key={m.id} style={{ ...S.row(i === valid.length - 1), gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: winnerIsP1 ? C.text : C.muted }}>{m.p1}</span>
                    <span style={{ fontSize: 12, color: C.muted }}>vs</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: !winnerIsP1 ? C.text : C.muted }}>{m.p2}</span>
                    <span style={{ ...badge("neutral"), fontSize: 12 }}>{score}</span>
                    <span style={{ ...badge("green"), fontSize: 11 }}>W: {m.winner}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{m.date}</div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => del(m.id)}
                    disabled={deleting === m.id}
                    style={{ background: "transparent", border: `1px solid ${C.borderHi}`, borderRadius: 6, color: C.muted, cursor: "pointer", fontSize: 12, padding: "5px 10px", fontFamily: FONT, flexShrink: 0, opacity: deleting === m.id ? 0.4 : 1 }}
                  >
                    {deleting === m.id ? "…" : "✕"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MENTAL EDGE
// ════════════════════════════════════════════════════════════════════════════════
function MentalEdge({ players, matches }) {
  const [sel, setSel] = useState("");
  const [hoverBack, setHoverBack] = useState(false);
  const names = players.map(p => p.name).sort();
  const initials = name => name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const AVATAR_COLORS = [
    ["#1e3a5f", "#88aaff"], ["#1e3a2e", "#44cc88"], ["#3a1e2e", "#ff88aa"],
    ["#2e1e3a", "#aa88ff"], ["#3a2e1e", "#ffaa44"],
  ];
  const avatarColor = name => {
    const idx = names.indexOf(name) % AVATAR_COLORS.length;
    return AVATAR_COLORS[Math.max(0, idx)];
  };

  // ── Bar helpers ──
  const barColor = wr => wr === null ? C.muted : wr >= 0.65 ? "#1D9E75" : wr >= 0.45 ? "#EF9F27" : "#C94040";
  const tagStyle = wr => {
    if (wr === null) return { background: C.surfaceHi, color: C.muted };
    if (wr >= 0.65) return { background: "#EAF3DE", color: "#27500A" };
    if (wr >= 0.45) return { background: "#FAEEDA", color: "#633806" };
    return { background: "#FCEBEB", color: "#791F1F" };
  };

  const PILL_STYLES = {
    "Clutch Player":        { background: "#E6F1FB", color: "#0C447C" },
    "Underdog Specialist":  { background: "#FAEEDA", color: "#633806" },
    "Bouncer":              { background: "#EAF3DE", color: "#27500A" },
    "Streaky":              { background: "#EEEDFE", color: "#3C3489" },
    "Consistent":           { background: C.surfaceHi, color: C.muted },
  };

  // ── Per-player stats computation ──
  const stats = useMemo(() => {
    if (!sel) return null;

    const won = m => m.winner === sel;
    const myPre  = m => m.p1 === sel ? m.p1pre : m.p2pre;
    const oppPre = m => m.p1 === sel ? m.p2pre : m.p1pre;
    const myMatches = matches.filter(m => m.valid && (m.p1 === sel || m.p2 === sel));

    const isFav      = m => myPre(m) > oppPre(m) + 100;
    const isUnderdog = m => oppPre(m) > myPre(m) + 100;
    const isClose    = m => Math.abs(myPre(m) - oppPre(m)) <= 50;

    const winRate = ms => ms.length === 0 ? null : ms.filter(won).length / ms.length;

    const overall      = winRate(myMatches);
    const favWR        = winRate(myMatches.filter(isFav));
    const underdogWR   = winRate(myMatches.filter(isUnderdog));
    const closeWR      = winRate(myMatches.filter(isClose));

    // Pressure win rate = close match win rate (most meaningful "pressure" metric)
    const pressureWR = closeWR;

    // Bounce-back: for each loss, was the *next* match a win?
    const bounceBackResults = [];
    for (let i = 0; i < myMatches.length - 1; i++) {
      if (!won(myMatches[i])) bounceBackResults.push(myMatches[i + 1]);
    }
    const bounceWR = winRate(bounceBackResults);

    // Streak behaviour: win rate when entering match on a 4+ win streak
    const streakTestResults = [];
    let curStreak = 0, longestStreak = 0;
    for (const m of myMatches) {
      if (curStreak >= 4) streakTestResults.push(m);
      curStreak = won(m) ? curStreak + 1 : 0;
      longestStreak = Math.max(longestStreak, curStreak);
    }
    const streakWR = winRate(streakTestResults);

    // Opponent breakdown (4+ matches)
    const oppNames = [...new Set(myMatches.map(m => m.p1 === sel ? m.p2 : m.p1))];
    const oppData = oppNames.map(opp => {
      const vs = myMatches.filter(m => (m.p1 === sel ? m.p2 : m.p1) === opp);
      if (vs.length < 4) return null;
      const last5 = vs.slice(-5);
      const recent3 = vs.slice(-3);
      const r3wins = recent3.filter(won).length;
      const trend = r3wins >= 2 ? "improving" : (3 - r3wins) >= 2 ? "declining" : "holding steady";
      return { opp, total: vs.length, wr: winRate(vs), last5, trend };
    }).filter(Boolean).sort((a, b) => b.total - a.total);

    // Group averages (for comparison callouts)
    const allNames = players.map(p => p.name);
    const groupClose = [], groupBounce = [];
    for (const n of allNames) {
      const wonN = m => m.winner === n;
      const ms = matches.filter(m => m.valid && (m.p1 === n || m.p2 === n));
      const myPreN  = m => m.p1 === n ? m.p1pre : m.p2pre;
      const oppPreN = m => m.p1 === n ? m.p2pre : m.p1pre;
      const cWR = winRate(ms.filter(m => Math.abs(myPreN(m) - oppPreN(m)) <= 50));
      if (cWR !== null) groupClose.push(cWR);
      const bbR = [];
      for (let i = 0; i < ms.length - 1; i++) {
        if (!wonN(ms[i])) bbR.push(ms[i + 1]);
      }
      const bWR = winRate(bbR);
      if (bWR !== null) groupBounce.push(bWR);
    }
    const groupCloseWR  = groupClose.length  ? groupClose.reduce((a, b) => a + b) / groupClose.length   : null;
    const groupBounceWR = groupBounce.length ? groupBounce.reduce((a, b) => a + b) / groupBounce.length : null;

    // Identity label
    let label = "Consistent";
    if (closeWR !== null && closeWR > 0.55 && (groupCloseWR === null || closeWR > groupCloseWR + 0.05)) label = "Clutch Player";
    else if (underdogWR !== null && underdogWR > 0.4) label = "Underdog Specialist";
    else if (bounceWR !== null && bounceWR > 0.65 && (groupBounceWR === null || bounceWR > groupBounceWR + 0.1)) label = "Bouncer";
    else if (longestStreak >= 4) label = "Streaky";

    return { myMatches, overall, favWR, underdogWR, closeWR, pressureWR, bounceWR,
             bounceBackResults, streakWR, streakTestResults, longestStreak,
             oppData, groupCloseWR, groupBounceWR, label };
  }, [sel, players, matches]);

  // ── Sub-components ──
  function StatRow({ label: rowLabel, matches: ms, wr, groupWR, note }) {
    if (ms !== undefined && ms.length === 0) return null; // hide empty buckets
    const pct = wr === null ? null : Math.round(wr * 100);
    const ts = tagStyle(wr);
    return (
      <div style={{ ...S.card, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: wr !== null ? 8 : 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{rowLabel}</div>
          <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 20, ...ts }}>
            {pct !== null ? `${pct}% win rate` : "—"}
          </div>
        </div>
        {wr !== null && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, color: C.muted, width: 64, flexShrink: 0 }}>{ms !== undefined ? `${ms.length} match${ms.length !== 1 ? "es" : ""}` : ""}</div>
              <div style={{ flex: 1, height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: barColor(wr), borderRadius: 3, transition: "width 0.6s ease" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, minWidth: 32, textAlign: "right", color: barColor(wr) }}>{pct}%</div>
            </div>
            {note && <div style={{ fontSize: 11, color: C.muted, marginTop: 7 }}>{note}</div>}
          </>
        )}
      </div>
    );
  }

  const divider = <div style={{ borderTop: `1px solid ${C.border}`, margin: "14px 0" }} />;

  const sorted = [...players].sort((a, b) => b.elo - a.elo);
  const medals = ["🥇", "🥈", "🥉"];

  if (!sel) return (
    <>
      <div style={S.pageHead}>Mental Edge</div>
      <div style={S.card}>
        {sorted.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", padding: 24 }}>No players yet.</div>}
        {sorted.map((pl, i) => (
          <div key={pl.name} onClick={() => setSel(pl.name)}
            style={{ ...S.row(i === sorted.length - 1), cursor: "pointer" }}>
            <div style={{ width: 26, textAlign: "center", flexShrink: 0, fontSize: i < 3 ? 18 : 13, color: i >= 3 ? C.muted : undefined, fontWeight: 700 }}>
              {i < 3 ? medals[i] : i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: C.text }}>{pl.name}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                <span style={{ color: C.green }}>{pl.wins}W</span>
                {" · "}
                <span style={{ color: C.red }}>{pl.losses}L</span>
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>View →</div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <button
        onClick={() => setSel("")}
        style={{ ...S.btnSmall, marginBottom: 14, fontSize: 12, padding: "7px 14px", ...(hoverBack && { background: "rgba(136,170,255,0.12)", borderColor: "#88aaff" }) }}
        onMouseEnter={() => setHoverBack(true)}
        onMouseLeave={() => setHoverBack(false)}
      >← Back</button>

      {!stats && <Spinner />}

      {stats && (() => {
        const { myMatches, overall, favWR, underdogWR, closeWR, pressureWR, bounceWR,
                bounceBackResults, streakWR, streakTestResults, longestStreak,
                oppData, groupCloseWR, groupBounceWR, label } = stats;
        const [avBg, avText] = avatarColor(sel);
        const pctOverall   = overall   !== null ? Math.round(overall * 100)   : null;
        const pctPressure  = pressureWR !== null ? Math.round(pressureWR * 100) : null;
        const pctBounce    = bounceWR  !== null ? Math.round(bounceWR * 100)  : null;

        // Close match comparison note
        const closeNote = (() => {
          if (closeWR === null || groupCloseWR === null) return null;
          const diff = Math.round((closeWR - groupCloseWR) * 100);
          if (diff > 0) return `You thrive in tight matches — ${diff}% above group average`;
          if (diff < 0) return `Close matches are your weakness — ${Math.abs(diff)}% below group average`;
          return null;
        })();

        const bounceNote = (() => {
          if (bounceWR === null || groupBounceWR === null) return null;
          const groupPct = Math.round(groupBounceWR * 100);
          const diff = Math.round((bounceWR - groupBounceWR) * 100);
          const sign = diff >= 0 ? "+" : "";
          return `Group avg: ${groupPct}% · You're ${sign}${diff}pts vs average`;
        })();

        const streakNote = streakWR !== null
          ? (streakWR < 0.5 ? "Win rate drops after 4+ game streaks — watch the complacency dip" : "You stay sharp even on long win streaks")
          : null;

        return (
          <>
            {/* Player header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: avBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: avText, flexShrink: 0 }}>
                {initials(sel)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{sel}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, ...PILL_STYLES[label] }}>{label}</span>
                </div>
                <div style={{ fontSize: 12, color: C.tertiary, marginTop: 2 }}>Based on {myMatches.length} match{myMatches.length !== 1 ? "es" : ""} · all time</div>
              </div>
            </div>

            {/* Overview tiles */}
            <div style={S.label}>Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 20 }}>
              {[
                { label: "Overall win rate", val: pctOverall !== null ? `${pctOverall}%` : "—", sub: `${myMatches.filter(m => m.winner === sel).length}W · ${myMatches.filter(m => m.winner !== sel).length}L` },
                { label: "Pressure win rate", val: pctPressure !== null ? `${pctPressure}%` : "—", sub: "vs. close rivals", color: pctPressure !== null ? barColor(pressureWR) : C.muted },
                { label: "Bounce-back rate",  val: pctBounce  !== null ? `${pctBounce}%` : "—",  sub: "win after a loss", color: pctBounce !== null ? barColor(bounceWR) : C.muted },
              ].map(({ label: tl, val, sub, color }) => (
                <div key={tl} style={{ background: C.surfaceHi, borderRadius: 8, padding: "12px 10px" }}>
                  <div style={{ fontSize: 10, color: C.muted, marginBottom: 4, lineHeight: 1.3 }}>{tl}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: color || C.text, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 10, color: C.tertiary, marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* Pressure performance */}
            <div style={S.sectionHead}>Pressure Performance</div>
            <StatRow label="As favourite (100+ ELO gap)" ms={stats.myMatches.filter(m => m.p1 === sel ? m.p1pre > m.p2pre + 100 : m.p2pre > m.p1pre + 100)} wr={favWR} />
            <StatRow label="As underdog (100+ ELO gap)"  ms={stats.myMatches.filter(m => m.p1 === sel ? m.p2pre > m.p1pre + 100 : m.p1pre > m.p2pre + 100)} wr={underdogWR} />
            <StatRow label="Close matches (within 50 ELO)" ms={stats.myMatches.filter(m => Math.abs(m.p1pre - m.p2pre) <= 50)} wr={closeWR} note={closeNote} />

            {divider}

            {/* Streak behaviour */}
            <div style={S.sectionHead}>Streak Behaviour</div>
            <StatRow label="After a loss"                ms={bounceBackResults}  wr={bounceWR}  note={bounceNote} />
            <StatRow label="During a win streak (4+)"   ms={streakTestResults}  wr={streakWR}  note={streakNote} />

            {divider}

            {/* Opponent breakdown */}
            {oppData.length > 0 && (
              <>
                <div style={S.sectionHead}>Opponent Breakdown</div>
                <div style={S.card}>
                  {oppData.map((o, i) => {
                    const [bg, tx] = avatarColor(o.opp);
                    const trendIcon = o.trend === "improving" ? "↑" : o.trend === "declining" ? "↓" : "→";
                    const trendColor = o.trend === "improving" ? C.green : o.trend === "declining" ? C.red : C.muted;
                    const oPct = Math.round(o.wr * 100);
                    return (
                      <div key={o.opp} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: i === oppData.length - 1 ? "none" : `1px solid ${C.border}` }}>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: tx, flexShrink: 0 }}>
                          {initials(o.opp)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700 }}>{o.opp}</div>
                          <div style={{ fontSize: 11, color: C.tertiary, marginTop: 1 }}>
                            {o.total} matches · <span style={{ color: trendColor }}>{trendIcon} {o.trend}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                          {o.last5.map((m, j) => {
                            const w = m.winner === sel;
                            return (
                              <div key={j} style={{ width: 16, height: 16, borderRadius: "50%", background: w ? "#EAF3DE" : "#FCEBEB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: w ? "#27500A" : "#791F1F" }}>
                                {w ? "W" : "L"}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: barColor(o.wr), minWidth: 32, textAlign: "right" }}>{oPct}%</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {myMatches.length < 5 && (
              <div style={{ fontSize: 12, color: C.tertiary, textAlign: "center", padding: "12px 0" }}>
                More patterns will emerge with additional matches.
              </div>
            )}
          </>
        );
      })()}
    </>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// SEASON PAGE
// ════════════════════════════════════════════════════════════════════════════════
function SeasonPage() {
  const [subTab, setSubTab] = useState("standings");
  const [seasons, setSeasons] = useState([]);
  const [selectedSid, setSelectedSid] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/seasons")
      .then(data => {
        setSeasons(data);
        if (data.length > 0) setSelectedSid(data[0].season_id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedSid) return;
    setDetailLoading(true);
    apiFetch(`/seasons/${selectedSid}`)
      .then(setDetail)
      .catch(e => setError(e.message))
      .finally(() => setDetailLoading(false));
  }, [selectedSid]);

  const initials = name => name.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const AVATAR_COLORS = [
    ["#1e3a5f", "#88aaff"], ["#1e3a2e", "#44cc88"], ["#3a1e2e", "#ff88aa"],
    ["#2e1e3a", "#aa88ff"], ["#3a2e1e", "#ffaa44"],
  ];

  const fmtDate = d => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(m)-1]} ${parseInt(day)}`;
  };

  const subTabStyle = (id) => ({
    flex: 1, textAlign: "center", fontSize: 12, padding: "7px 0", borderRadius: 8,
    cursor: "pointer", fontFamily: FONT,
    background: subTab === id ? C.surfaceHi : "transparent",
    color: subTab === id ? C.text : C.muted,
    fontWeight: subTab === id ? 700 : 400,
    border: subTab === id ? `1px solid ${C.border}` : "1px solid transparent",
    letterSpacing: "0.04em",
  });

  const AWARD_DOTS = {
    champion:      "#BA7517",
    most_improved: "#44ff77",
    most_active:   "#7F77DD",
    giant_killer:  "#ff8855",
  };
  const AWARD_LABELS = {
    champion: "Champion", most_improved: "Most Improved",
    most_active: "Most Active", giant_killer: "Giant Killer",
  };

  if (loading) return <><div style={S.pageHead}>Season</div><Spinner /></>;
  if (error) return <><div style={S.pageHead}>Season</div><ErrorBanner msg={error} /></>;
  if (seasons.length === 0) return (
    <>
      <div style={S.pageHead}>Season</div>
      <div style={{ ...S.card, color: C.muted, textAlign: "center", padding: 36, fontSize: 13 }}>
        No matches logged yet — play some games to start the season!
      </div>
    </>
  );

  const currentSeason = seasons.find(s => s.is_current) || seasons[0];
  const pastSeasons = seasons.filter(s => !s.is_current && s.match_count > 0);

  return (
    <>
      <div style={S.pageHead}>Season</div>

      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 4, background: C.surface, borderRadius: 10, padding: 3, marginBottom: 16, border: `1px solid ${C.border}` }}>
        {["standings", "hof", "awards"].map(id => (
          <button key={id} onClick={() => setSubTab(id)} style={subTabStyle(id)}>
            {id === "standings" ? "Standings" : id === "hof" ? "Hall of Fame" : "Awards"}
          </button>
        ))}
      </div>

      {/* STANDINGS */}
      {subTab === "standings" && (
        <>
          {detailLoading && <Spinner />}
          {detail && (
            <>
              {/* Season header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{detail.name}</div>
                  <div style={{ fontSize: 11, color: C.tertiary, marginTop: 2 }}>
                    {fmtDate(detail.start)} – {fmtDate(detail.end)} · {detail.match_count} match{detail.match_count !== 1 ? "es" : ""}
                  </div>
                </div>
                <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, color: C.muted }}>
                  {detail.is_current
                    ? <><span style={{ fontWeight: 700, color: C.text }}>{detail.days_remaining}</span> days left</>
                    : "Completed"}
                </div>
              </div>

              {/* Standings list */}
              {detail.standings.length === 0 ? (
                <div style={{ ...S.card, color: C.muted, textAlign: "center", padding: 28, fontSize: 13 }}>
                  No matches this season yet.
                </div>
              ) : (
                <div style={S.card}>
                  {detail.standings.map((p, i) => {
                    const [avBg, avText] = AVATAR_COLORS[i % AVATAR_COLORS.length];
                    const streak = p.streak;
                    const streakStr = streak > 0 ? `↑${streak}` : streak < 0 ? `↓${Math.abs(streak)}` : "–";
                    const streakColor = streak > 0 ? C.green : streak < 0 ? C.red : C.muted;
                    return (
                      <div key={p.name} style={S.row(i === detail.standings.length - 1)}>
                        <div style={{ width: 20, textAlign: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: i === 0 ? "#BA7517" : C.muted }}>{i + 1}</div>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: avBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: avText, flexShrink: 0 }}>
                          {initials(p.name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                            <span style={{ color: C.green }}>{p.wins}W</span>
                            {" · "}
                            <span style={{ color: C.red }}>{p.losses}L</span>
                            {" · "}
                            <span
                              style={{ color: streakColor, cursor: "default" }}
                              title={
                                streak > 0
                                  ? `Moved up ${streak} place${streak !== 1 ? "s" : ""} this season`
                                  : streak < 0
                                  ? `Moved down ${Math.abs(streak)} place${Math.abs(streak) !== 1 ? "s" : ""} this season`
                                  : "No position change this season"
                              }
                            >{streakStr}</span>
                          </div>
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.elo.toFixed(0)}</div>
                          <div style={{ fontSize: 11, marginTop: 2, color: p.delta >= 0 ? C.green : C.red }}>
                            {p.delta >= 0 ? "+" : ""}{p.delta.toFixed(0)} this season
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* HALL OF FAME */}
      {subTab === "hof" && (
        <>
          {pastSeasons.length === 0 ? (
            <div style={{ ...S.card, color: C.muted, textAlign: "center", padding: 36, fontSize: 13 }}>
              No completed seasons yet — the Hall of Fame will fill up after the first season closes.
            </div>
          ) : (
            pastSeasons.map(s => (
              <div key={s.season_id}
                onClick={() => { setSelectedSid(s.season_id); setSubTab("standings"); }}
                style={{ ...S.card, display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                {/* Trophy */}
                <div style={{ width: 36, height: 36, borderRadius: 8, background: "#3a2a10", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>
                  🏆
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: C.tertiary, marginBottom: 2 }}>{s.name}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{s.champion || "—"}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{s.match_count} matches played</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 11, color: C.muted }}>Tap to view</div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* AWARDS */}
      {subTab === "awards" && (
        <>
          {detailLoading && <Spinner />}
          {detail && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 4 }}>{detail.name} — end of season awards</div>
              <div style={{ fontSize: 11, color: C.tertiary, marginBottom: 14 }}>
                {detail.is_current ? `Awarded when season closes ${fmtDate(detail.end)}` : "Final awards"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(detail.awards).map(([key, award]) => (
                  <div key={key} style={{ background: C.surfaceHi, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: AWARD_DOTS[key], flexShrink: 0 }} />
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}>{AWARD_LABELS[key]}</div>
                    </div>
                    {award ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{award.name}</div>
                        <div style={{ fontSize: 11, color: C.tertiary, marginTop: 2 }}>{award.detail}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: C.muted }}>—</div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}


// ════════════════════════════════════════════════════════════════════════════════
// PLAYER HOME
// ════════════════════════════════════════════════════════════════════════════════
function PlayerHome({ player, matches, loading, rank, onLogMatch }) {
  if (loading || !player) return <Spinner />;

  const myMatches = matches.filter(m => m.valid && (m.p1 === player.name || m.p2 === player.name));
  const recent = [...myMatches].reverse().slice(0, 5);

  return (
    <>
      <div style={S.pageHead}>Home</div>

      {/* Greeting card */}
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#1e3a5f", color: C.accent, fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {player.name.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Hey, {player.name}</div>
            <div style={{ fontSize: 12, color: C.muted }}>Rank #{rank}</div>
          </div>
          <Sparkline history={player.history} w={60} h={28} />
        </div>
        <div style={{ fontSize: 28, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          {player.elo.toFixed(0)}
          <span style={{ fontSize: 12, color: C.muted, fontWeight: 400, marginLeft: 6 }}>ELO</span>
        </div>
        <EloBar elo={player.elo} />
      </div>

      {/* 2×2 stat grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <StatTile label="Wins"   val={player.wins}    color={C.green} />
        <StatTile label="Losses" val={player.losses}  color={C.red} />
        <StatTile label="Win %"  val={player.matches > 0 ? `${(player.wins / player.matches * 100).toFixed(0)}%` : "—"} />
        <StatTile label="Played" val={player.matches} />
      </div>

      {/* Recent form */}
      {recent.length > 0 && (
        <div style={S.card}>
          <div style={S.sectionHead}>Recent Form</div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[...Array(5)].map((_, i) => {
              const m = recent[i];
              const won = m ? m.winner === player.name : null;
              return (
                <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  background: won === true ? "#1a3a1a" : won === false ? "#3a1a1a" : C.surfaceHi,
                  color: won === true ? C.green : won === false ? C.red : C.border,
                  border: `1px solid ${won === true ? "#2a5a2a" : won === false ? "#5a2a2a" : C.border}` }}>
                  {m ? (won ? "W" : "L") : ""}
                </div>
              );
            })}
          </div>
          {recent.slice(0, 3).map((m, i) => {
            const opp = m.p1 === player.name ? m.p2 : m.p1;
            const won = m.winner === player.name;
            return (
              <div key={m.id} style={S.row(i === Math.min(2, recent.length - 1))}>
                <span style={badge(won ? "green" : "red")}>{won ? "W" : "L"}</span>
                <div style={{ flex: 1, fontSize: 13 }}>vs <span style={{ color: C.accent }}>{opp}</span></div>
                <div style={{ fontSize: 11, color: C.muted }}>{m.date}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* CTA */}
      <button onClick={onLogMatch} style={{ ...S.btn, width: "100%", marginTop: 4 }}>
        + Log a Match
      </button>
    </>
  );
}

const BASE_TABS = [
  { id: "log",     icon: "+", label: "Match"     },
  { id: "players", icon: "⬡", label: "Board"     },
  { id: "season",  icon: "⚑", label: "Season"    },
  { id: "edge",    icon: "◈", label: "Edge"      },
  { id: "history", icon: "≡", label: "Match Log" },
  { id: "rivals",  icon: "⚔", label: "Rivals"   },
];

export default function App() {
  const [tab, setTab] = useState(() => {
    const id = localStorage.getItem("squashIdentity");
    return (id && id !== "__guest__") ? "home" : "log";
  });
  const isMobile = useIsMobile();

  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  // ─── Admin auth ───────────────────────────────────────────────────────────
  const [adminToken, setAdminToken] = useState(() => localStorage.getItem("adminToken") || "");
  const [showLogin, setShowLogin] = useState(false);
  const [loginPw, setLoginPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [hoverXlsx, setHoverXlsx] = useState(false);
  const isAdmin = !!adminToken;

  // ─── Player identity (localStorage, no auth) ──────────────────────────────
  const [identity, setIdentity] = useState(() => localStorage.getItem("squashIdentity"));
  const [showSwitchSheet, setShowSwitchSheet] = useState(false);

  function chooseIdentity(name) {
    const val = name || "__guest__";
    localStorage.setItem("squashIdentity", val);
    setIdentity(val);
    setTab(name ? "home" : "log");
  }
  // ──────────────────────────────────────────────────────────────────────────

  async function handleLogin() {
    setLoginLoading(true); setLoginErr("");
    try {
      const res = await apiFetch("/admin/login", { method: "POST", body: JSON.stringify({ password: loginPw }) });
      localStorage.setItem("adminToken", res.token);
      setAdminToken(res.token);
      setShowLogin(false);
      setLoginPw("");
    } catch (e) {
      setLoginErr("Wrong password");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("adminToken");
    setAdminToken("");
  }
  // ──────────────────────────────────────────────────────────────────────────

  const [matchLogPreselect, setMatchLogPreselect] = useState(null);

  function handleLogMatch(challenger, challenged) {
    setMatchLogPreselect({ challenger, challenged });
    setTab("log");
  }

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

  const lastMatch = useMemo(() => {
    const valid = matches.filter(m => m.valid && m.date);
    if (valid.length === 0) return null;
    const m = valid.reduce((a, b) => (a.date >= b.date ? a : b));
    const days = Math.max(0, Math.floor((new Date() - new Date(m.date)) / 86400000));
    return { p1: m.p1, p2: m.p2, days };
  }, [matches]);

  const tabs = useMemo(() =>
    identity && identity !== "__guest__"
      ? [{ id: "home", icon: "⌂", label: "Home" }, ...BASE_TABS]
      : BASE_TABS,
    [identity]
  );

  const content = () => {
    if (tab === "home") {
      const rank = [...players].sort((a, b) => b.elo - a.elo).findIndex(p => p.name === identity) + 1;
      return <PlayerHome
        player={players.find(p => p.name === identity)}
        matches={matches}
        loading={loading}
        rank={rank}
        onLogMatch={() => { setMatchLogPreselect({ challenger: identity, challenged: "" }); setTab("log"); }}
      />;
    }
    if (tab === "log")     return <LogMatch players={players} matches={matches} onLogged={fetchAll} preselect={matchLogPreselect} onClearPreselect={() => setMatchLogPreselect(null)} />;
    if (tab === "players") return <PlayersPage players={players} loading={loading} error={error} onRetry={fetchAll} onAdded={fetchAll} lastMatch={lastMatch} identity={identity} />;
    if (tab === "history") return <MatchHistory matches={matches} onDeleted={fetchAll} isAdmin={isAdmin} adminToken={adminToken} />;
    if (tab === "stats")   return <PlayerStats players={players} matches={matches} />;
    if (tab === "h2h")     return <HeadToHead players={players} matches={matches} />;
    if (tab === "season")  return <SeasonPage />;
    if (tab === "edge")    return <MentalEdge players={players} matches={matches} />;
    if (tab === "rivals")  return <ChallengeMode players={players.map(p => p.name)} onLogMatch={handleLogMatch} adminToken={adminToken} />;
  };

  return (
    <div style={{ fontFamily: FONT, background: C.bg, minHeight: "100vh", color: C.text, paddingBottom: isMobile ? 72 : 0 }}>

      {/* Admin login modal */}
      {showLogin && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setShowLogin(false); }}>
          <div style={{ background: C.surface, border: `1px solid ${C.borderHi}`, borderRadius: 12, padding: 28, width: 320, fontFamily: FONT }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Admin Login</div>
            <input
              autoFocus
              type="password"
              placeholder="Password"
              value={loginPw}
              onChange={e => { setLoginPw(e.target.value); setLoginErr(""); }}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              style={{ ...S.input, marginBottom: 10 }}
            />
            {loginErr && <div style={{ color: C.red, fontSize: 12, marginBottom: 10 }}>{loginErr}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleLogin} disabled={loginLoading} style={{ ...S.btn, flex: 1, opacity: loginLoading ? 0.5 : 1 }}>
                {loginLoading ? "…" : "Login"}
              </button>
              <button onClick={() => setShowLogin(false)} style={{ ...S.btnGhost, padding: "14px 16px" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#1A1A18", borderBottom: `1px solid ${C.border}`, padding: isMobile ? "13px 16px" : "13px 24px", display: "flex", alignItems: "center", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 700, color: C.text, letterSpacing: "-0.5px" }}>SQUASH ELO</div>
        {!isMobile && (
          <nav style={{ display: "flex", gap: 4, marginLeft: 16 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "7px 16px", fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", border: tab === t.id ? `1px solid ${C.accent}` : `1px solid ${C.borderHi}`, background: tab === t.id ? C.accent : "transparent", color: tab === t.id ? "#12121f" : C.muted, cursor: "pointer", borderRadius: 6, fontFamily: FONT, fontWeight: tab === t.id ? 700 : 400 }}>
                {t.label}
              </button>
            ))}
          </nav>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {identity && identity !== "__guest__" && (
            <button onClick={() => setShowSwitchSheet(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(136,170,255,0.1)", border: "1px solid rgba(136,170,255,0.25)", borderRadius: 20, padding: "4px 10px 4px 6px", cursor: "pointer", fontFamily: FONT, marginRight: 4 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#1e3a5f", color: C.accent, fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {identity.slice(0, 2).toUpperCase()}
              </div>
              {!isMobile && <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{identity}</span>}
            </button>
          )}
          <a
            href={`${API}/api/export`}
            style={{ fontSize: 11, color: hoverXlsx ? C.text : C.muted, textDecoration: "none", letterSpacing: "0.08em", padding: "5px 10px" }}
            onMouseEnter={() => setHoverXlsx(true)}
            onMouseLeave={() => setHoverXlsx(false)}
          >
            ↓ xlsx
          </a>
          <div style={{ width: 1, height: 18, background: "rgba(255,255,255,0.12)", alignSelf: "center" }} />
          {isAdmin
            ? <button onClick={handleLogout} title="Logout" style={{ background: "transparent", border: `1px solid ${C.borderHi}`, borderRadius: 5, color: C.accent, cursor: "pointer", fontSize: 14, padding: "4px 9px", fontFamily: FONT }}>🔓</button>
            : <button onClick={() => setShowLogin(true)} title="Admin login" style={{ background: "transparent", border: `1px solid ${C.borderHi}`, borderRadius: 5, color: C.muted, cursor: "pointer", fontSize: 14, padding: "4px 9px", fontFamily: FONT }}>🔒</button>
          }
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: isMobile ? "16px 14px" : "28px 24px", maxWidth: 960, margin: "0 auto", minHeight: isMobile ? "calc(100vh - 56px - 72px)" : "calc(100vh - 56px)" }}>
        {content()}
      </div>

      {/* Mobile bottom nav */}
      {isMobile && (
        <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 20, background: "#1A1A18", borderTop: `1px solid ${C.border}`, display: "flex", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {tabs.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "10px 0 8px", border: "none", background: "transparent", color: active ? C.accent : C.tertiary, cursor: "pointer", fontFamily: FONT, touchAction: "manipulation" }}>
                <span style={{ fontSize: 19, lineHeight: 1 }}>{t.icon}</span>
                <span style={{ fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: active ? 700 : 400 }}>{t.label}</span>
                {active && <div style={{ width: 18, height: 2, background: C.accent, borderRadius: 1 }} />}
              </button>
            );
          })}
        </nav>
      )}

      {/* Switch identity sheet */}
      {showSwitchSheet && (
        <>
          <div onClick={() => setShowSwitchSheet(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 50 }} />
          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "14px 14px 0 0", padding: "16px 16px 32px", zIndex: 51, fontFamily: FONT }}>
            <div style={{ width: 40, height: 4, background: "#3A3A38", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={S.sectionHead}>Playing as</div>
            {players.map(p => (
              <button key={p.name} onClick={() => { chooseIdentity(p.name); setShowSwitchSheet(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: p.name === identity ? "rgba(136,170,255,0.08)" : C.surfaceHi, border: `1px solid ${p.name === identity ? C.accent : C.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 8, cursor: "pointer", fontFamily: FONT }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#1e3a5f", color: C.accent, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.text, textAlign: "left" }}>{p.name}</span>
                {p.name === identity && <span style={{ color: C.accent, fontSize: 14 }}>✓</span>}
              </button>
            ))}
            <div style={{ height: 1, background: C.border, margin: "4px 0 8px" }} />
            <button onClick={() => { chooseIdentity(null); setShowSwitchSheet(false); }}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
              View as guest
            </button>
          </div>
        </>
      )}

      {/* Identity selection overlay (first visit) */}
      {identity === null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 28, width: "100%", maxWidth: 360, fontFamily: FONT }}>
            <div style={S.sectionHead}>Squash ELO</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.text, marginBottom: 6 }}>Who are you?</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 24 }}>Pick your name to personalise the app.</div>
            {loading && [0, 1, 2].map(i => (
              <div key={i} style={{ height: 64, borderRadius: 10, background: C.surfaceHi, marginBottom: 8, opacity: 0.6 }} />
            ))}
            {!loading && players.length === 0 && (
              <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: "16px 0 8px" }}>No players yet — ask the admin to add players.</div>
            )}
            {!loading && players.map(p => (
              <button key={p.name} onClick={() => chooseIdentity(p.name)}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 8, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#1e3a5f", color: C.accent, fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {p.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.muted }}>{p.elo.toFixed(0)} ELO</div>
                </div>
              </button>
            ))}
            <div style={{ height: 1, background: C.border, margin: "8px 0 12px" }} />
            <button onClick={() => chooseIdentity(null)}
              style={{ width: "100%", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 16px", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: FONT, textAlign: "left" }}>
              View as guest →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
