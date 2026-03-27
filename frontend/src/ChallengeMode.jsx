import { useState, useEffect, useCallback } from "react";

// ─── Shared tokens (mirrors App.jsx) ─────────────────────────────────────────
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

function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

const C = {
  bg: "#2C2C2A", surface: "#1E1E1C", surfaceHi: "#252523",
  border: "rgba(255,255,255,0.1)", borderHi: "rgba(255,255,255,0.15)",
  text: "#ffffff", muted: "#9C9A92", tertiary: "#6B6A63",
  accent: "#88aaff", green: "#44ff77", red: "#ff4455",
  orange: "#ff8855", yellow: "#ffdd44", blue: "#4488ff",
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
};

function badge(type) {
  const m = { green: [C.green, "#1a3a1a", "#2a5a2a"], red: [C.red, "#3a1a1a", "#5a2a2a"], neutral: ["#888", C.surface, C.borderHi] };
  const [color, bg, border] = m[type] || m.neutral;
  return { display: "inline-block", padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color, background: bg, border: `1px solid ${border}` };
}

function Spinner() {
  return <div style={{ color: C.muted, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading…</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function ChallengeMode({ players, onLogMatch, adminToken }) {
  const isMobile = useIsMobile();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [resolvedExpanded, setResolvedExpanded] = useState(false);
  const [withdrawConfirm, setWithdrawConfirm] = useState(null);

  // modal form state
  const [form, setForm] = useState({ challenger: "", challenged: "", required_wins: 2, deadline_days: 7 });
  const [modalError, setModalError] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSuccess, setModalSuccess] = useState(false);
  const [hoverFormat, setHoverFormat] = useState(null);
  const [hoverClose, setHoverClose] = useState(false);
  const [hoverIssue, setHoverIssue] = useState(false);

  const fetchChallenges = useCallback(async () => {
    setLoading(true); setError(null);
    try { setChallenges(await apiFetch("/challenges")); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const active = challenges.filter(c => c.status === "open");
  const resolved = challenges.filter(c => c.status !== "open");

  function renderDots(wins, required) {
    return Array.from({ length: required }, (_, i) => i < wins ? "●" : "○").join(" ");
  }

  function deadlineLabel(days_remaining) {
    if (days_remaining === null || days_remaining === undefined) return "No deadline";
    if (days_remaining <= 0) return <span style={{ color: C.yellow }}>Expires today</span>;
    return `${days_remaining} days left`;
  }

  async function handleWithdraw(id) {
    try {
      await apiFetch(`/challenges/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${adminToken}` } });
      setWithdrawConfirm(null);
      fetchChallenges();
    } catch (e) {
      alert(e.message);
    }
  }

  async function handleSubmitChallenge(e) {
    e.preventDefault();
    if (!form.challenger || !form.challenged) return;
    setModalLoading(true); setModalError(null);
    try {
      await apiFetch("/challenges", {
        method: "POST",
        body: JSON.stringify({
          challenger: form.challenger,
          challenged: form.challenged,
          required_wins: form.required_wins,
          deadline_days: form.deadline_days,
        }),
      });
      setModalSuccess(true);
      fetchChallenges();
    } catch (e) {
      setModalError(e.message);
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setShowModal(false); setModalSuccess(false);
    setModalError(null);
    setForm({ challenger: "", challenged: "", required_wins: 2, deadline_days: 7 });
  }

  // ─── Challenge card ───────────────────────────────────────────────────────
  function ChallengeCard({ c }) {
    const isWithdrawing = withdrawConfirm === c.id;
    return (
      <div style={{ ...S.card, marginBottom: 10 }}>
        {/* Badge row */}
        <div style={{ marginBottom: 10 }}>
          <span style={badge("neutral")}>PENDING</span>
        </div>

        {/* Players + score */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.accent }}>{c.challenger}</div>
          <div style={{ fontWeight: 700, fontSize: 18, textAlign: "center", color: C.text }}>
            {c.challenger_wins} – {c.challenged_wins}
          </div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.accent, textAlign: "right" }}>{c.challenged}</div>
        </div>

        {/* Win dots */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em" }}>
            {renderDots(c.challenger_wins, c.required_wins)}
          </div>
          <div style={{ fontSize: 11, color: C.tertiary, textAlign: "center" }}>vs</div>
          <div style={{ fontSize: 13, color: C.muted, letterSpacing: "0.15em", textAlign: "right" }}>
            {renderDots(c.challenged_wins, c.required_wins)}
          </div>
        </div>

        {/* Format + deadline */}
        <div style={{ fontSize: 11, color: C.tertiary, letterSpacing: "0.08em", marginBottom: 14 }}>
          FIRST TO {c.required_wins} · {deadlineLabel(c.days_remaining)}
        </div>

        {/* Action buttons or withdraw confirm */}
        {isWithdrawing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: C.muted }}>Are you sure?</span>
            <button
              onClick={() => handleWithdraw(c.id)}
              style={{ ...S.btnGhost, padding: "8px 14px", fontSize: 12 }}
            >
              Yes, Withdraw
            </button>
            <button
              onClick={() => setWithdrawConfirm(null)}
              style={{ ...S.btnSmall, padding: "8px 14px", fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => onLogMatch(c.challenger, c.challenged)}
              style={{ ...S.btn, flex: 1, minWidth: 140, fontSize: 13, padding: "11px 16px" }}
            >
              Log Match Result
            </button>
            <button
              onClick={() => setWithdrawConfirm(c.id)}
              style={{ ...S.btnGhost, fontSize: 13, padding: "11px 16px" }}
            >
              Withdraw
            </button>
          </div>
        )}
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Section header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={S.pageHead}>Active Challenges</div>
        {active.length > 0 && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              ...S.btnSmall, fontSize: 12, padding: "7px 14px",
              ...(hoverIssue && { background: "rgba(136,170,255,0.12)", borderColor: "#88aaff" }),
            }}
            onMouseEnter={() => setHoverIssue(true)}
            onMouseLeave={() => setHoverIssue(false)}
          >
            + Issue
          </button>
        )}
      </div>

      {/* Body */}
      {loading && <Spinner />}
      {error && (
        <div style={{ ...S.card, borderColor: "#6a2a2a", background: "#2e1010", color: C.red, fontSize: 13 }}>
          ✗ {error}
        </div>
      )}
      {!loading && !error && active.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚔</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>No active challenges.</div>
          <button onClick={() => setShowModal(true)} style={S.btn}>
            Issue a Challenge
          </button>
        </div>
      )}
      {!loading && !error && active.map(c => <ChallengeCard key={c.id} c={c} />)}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setResolvedExpanded(v => !v)}
            style={{ background: "none", border: "none", color: C.tertiary, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer", fontFamily: FONT, padding: "6px 0", marginBottom: 8 }}
          >
            PAST CHALLENGES {resolvedExpanded ? "▼" : "▶"}
          </button>
          {resolvedExpanded && resolved.map(c => (
            <div key={c.id} style={{ ...S.card, padding: "10px 14px", marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{c.challenger}</span>
                <span style={{ fontSize: 12, color: C.muted }}>{c.challenger_wins}–{c.challenged_wins}</span>
                <span style={{ fontWeight: 700, fontSize: 13, color: C.text }}>{c.challenged}</span>
                <span style={badge(c.status === "resolved" ? "green" : c.status === "expired" ? "yellow" : "neutral")}>{c.status}</span>
                <span style={{ fontSize: 11, color: C.tertiary, marginLeft: "auto" }}>{c.created?.split(" ")[0]}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Challenge creation modal */}
      {showModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div style={{ background: C.surface, border: `1px solid ${C.borderHi}`, borderRadius: 14, padding: 24, maxWidth: 420, width: isMobile ? "95%" : "90%", fontFamily: FONT, maxHeight: "90vh", overflowY: "auto" }}>

            {modalSuccess ? (
              // Success state
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <div style={{ fontSize: 32, color: C.green, marginBottom: 10 }}>✓</div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Challenge Issued!</div>
                <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>
                  {form.challenger} ⚔ {form.challenged}
                </div>
                <div style={{ fontSize: 12, color: C.tertiary, marginBottom: 24 }}>
                  First to {form.required_wins}
                  {form.deadline_days !== null ? ` · ${form.deadline_days} days to complete` : ""}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={closeModal}
                    style={{ ...S.btnSmall, flex: 1, ...(hoverClose && { background: "rgba(136,170,255,0.12)", borderColor: "#88aaff" }) }}
                    onMouseEnter={() => setHoverClose(true)}
                    onMouseLeave={() => setHoverClose(false)}
                  >Close</button>
                  <button onClick={closeModal} style={{ ...S.btn, flex: 1 }}>View Challenges</button>
                </div>
              </div>
            ) : (
              // Form state
              <>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 18 }}>Issue a Challenge</div>

                <form onSubmit={handleSubmitChallenge}>
                  {/* Challenger */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>Challenger</label>
                    <select
                      style={S.select}
                      value={form.challenger}
                      onChange={e => setForm(f => ({ ...f, challenger: e.target.value, challenged: f.challenged === e.target.value ? "" : f.challenged }))}
                    >
                      <option value="">-- Select challenger --</option>
                      {players.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Challenged */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>Opponent</label>
                    <select
                      style={S.select}
                      value={form.challenged}
                      onChange={e => setForm(f => ({ ...f, challenged: e.target.value }))}
                    >
                      <option value="">-- Select opponent --</option>
                      {players.filter(n => n !== form.challenger).map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Format toggle */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={S.label}>Format</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {[2, 3].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, required_wins: n }))}
                          style={{
                            flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                            fontFamily: FONT, cursor: "pointer", touchAction: "manipulation",
                            border: `1px solid ${form.required_wins === n ? C.accent : hoverFormat === n ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)"}`,
                            background: form.required_wins === n ? "rgba(136,170,255,0.15)" : hoverFormat === n ? "rgba(255,255,255,0.05)" : "transparent",
                            color: form.required_wins === n ? C.accent : hoverFormat === n ? "#ffffff" : C.muted,
                          }}
                          onMouseEnter={() => setHoverFormat(n)}
                          onMouseLeave={() => setHoverFormat(null)}
                        >
                          First to {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Expiry */}
                  <div style={{ marginBottom: 18 }}>
                    <label style={S.label}>Expires in</label>
                    <select
                      style={S.select}
                      value={form.deadline_days === null ? "null" : String(form.deadline_days)}
                      onChange={e => setForm(f => ({ ...f, deadline_days: e.target.value === "null" ? null : parseInt(e.target.value) }))}
                    >
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                      <option value="30">30 days</option>
                      <option value="null">Never</option>
                    </select>
                  </div>

                  {modalError && (
                    <div style={{ color: C.red, fontSize: 12, marginBottom: 12 }}>✗ {modalError}</div>
                  )}

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={closeModal}
                      style={{ ...S.btnGhost, color: C.muted, borderColor: C.borderHi, padding: "14px 16px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!form.challenger || !form.challenged || modalLoading}
                      style={{ ...S.btn, flex: 1, opacity: form.challenger && form.challenged && !modalLoading ? 1 : 0.35, cursor: form.challenger && form.challenged && !modalLoading ? "pointer" : "not-allowed" }}
                    >
                      {modalLoading ? "Sending…" : "Send Challenge"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
