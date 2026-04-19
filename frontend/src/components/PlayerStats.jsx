import { useState } from "react";

function StatTile({ label, val, color = "text-gray-100" }) {
  return (
    <div className="stat-tile bg-gray-800 border-l-2 border-squash-accent rounded p-3 flex-1 min-w-20">
      <div className="text-xs font-bold text-gray-400 tracking-widest mb-1">{label}</div>
      <div className={`text-lg font-bold ${color}`}>{val}</div>
    </div>
  );
}

export function PlayerStats({ players, matches }) {
  const [sel, setSel] = useState("");
  const names = players.map(p => p.name).sort();
  const p = sel ? players.find(x => x.name === sel) : null;
  const recent = p ? matches.filter(m => (m.p1 === sel || m.p2 === sel)).slice(-5).reverse() : [];

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      <h2 className="text-xs font-bold text-gray-400 tracking-widest mb-4">PLAYER STATS</h2>

      <div className="card bg-gray-800 border border-gray-700 rounded p-4 mb-6">
        <label className="block text-xs font-bold text-gray-400 tracking-widest mb-3">SELECT PLAYER</label>
        <select
          value={sel}
          onChange={e => setSel(e.target.value)}
          className="input-field w-full"
        >
          <option value="">— choose —</option>
          {names.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>

      {p && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            <StatTile label="ELO" val={p.elo.toFixed(1)} />
            <StatTile label="Peak" val={p.peak.toFixed(0)} color="text-squash-green" />
            <StatTile label="Low" val={p.low.toFixed(0)} color="text-orange-500" />
            <StatTile label="Played" val={p.matches} />
            <StatTile label="Wins" val={p.wins} color="text-squash-green" />
            <StatTile label="Losses" val={p.losses} color="text-squash-red" />
            <StatTile label="Win %" val={p.matches > 0 ? `${(p.wins / p.matches * 100).toFixed(0)}%` : "—"} />
            <StatTile label="K" val={p.elo >= 2000 ? 10 : p.matches >= 30 ? 20 : 40} color="text-gray-400" />
          </div>

          <div className="card bg-gray-800 border border-gray-700 rounded p-4 mb-6">
            <div className="text-xs font-bold text-gray-400 tracking-widest mb-4">ELO HISTORY</div>
            <div className="flex items-end gap-1 h-16">
              {p.history.map((v, i) => {
                const mn = Math.min(...p.history), mx = Math.max(...p.history);
                const h = Math.max(4, ((v - mn) / (mx - mn || 1)) * 52 + 4);
                const up = i === 0 || v >= p.history[i - 1];
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: h,
                      background: up ? "#238636" : "#ff4455",
                      borderRadius: "2px 2px 0 0",
                      opacity: 0.82,
                      minWidth: 4,
                      maxWidth: 32,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-3 text-xs text-gray-600">
              <span>Start · 1000</span>
              <span>Now · {p.elo.toFixed(0)}</span>
            </div>
          </div>

          {recent.length > 0 && (
            <div className="card bg-gray-800 border border-gray-700 rounded overflow-hidden">
              <div className="text-xs font-bold text-gray-400 tracking-widest p-4 border-b border-gray-700">RECENT MATCHES</div>
              {recent.map((m, i) => {
                const isP1 = m.p1 === sel, opp = isP1 ? m.p2 : m.p1, won = m.winner === sel;
                const myPost = isP1 ? m.p1post : m.p2post, myPre = isP1 ? m.p1pre : m.p2pre;
                const d = myPost - myPre, score = isP1 ? `${m.s1}–${m.s2}` : `${m.s2}–${m.s1}`;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i !== recent.length - 1 ? "border-b border-gray-700" : ""}`}
                  >
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      won ? "bg-squash-accent/20 text-squash-accent" : "bg-squash-red/20 text-squash-red"
                    }`}>
                      {won ? "W" : "L"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-gray-100">vs {opp}</div>
                      <div className="text-xs text-gray-400 mt-1">{score} · {m.date}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-xs font-bold ${d >= 0 ? "text-squash-green" : "text-squash-red"}`}>
                        {d >= 0 ? "+" : ""}{d.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-400">{myPost?.toFixed(0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
