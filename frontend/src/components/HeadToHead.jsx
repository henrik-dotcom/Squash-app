import { useState, useMemo } from "react";

function Badge({ type, label }) {
  const styles = {
    green: "bg-squash-accent/20 text-squash-accent",
    red: "bg-squash-red/20 text-squash-red",
    neutral: "bg-gray-700 text-gray-300",
  };
  return <span className={`text-xs font-bold px-2 py-1 rounded ${styles[type] || styles.neutral}`}>{label}</span>;
}

export function HeadToHead({ players, matches }) {
  const [pA, setPA] = useState("");
  const [pB, setPB] = useState("");
  const names = players.map(p => p.name).sort();

  const h2h = useMemo(() => {
    if (!pA || !pB || pA === pB) return null;
    const rel = matches.filter(m => (m.p1 === pA && m.p2 === pB) || (m.p1 === pB && m.p2 === pA));
    return {
      all: [...rel].reverse(),
      winsA: rel.filter(m => m.winner === pA).length,
      winsB: rel.filter(m => m.winner === pB).length,
    };
  }, [pA, pB, matches]);

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      <h2 className="text-xs font-bold text-gray-400 tracking-widest mb-4">HEAD-TO-HEAD</h2>

      <div className="card bg-gray-800 border border-gray-700 rounded p-4 mb-6">
        <div className="grid grid-cols-2 gap-3">
          {[
            { lbl: "Player A", val: pA, set: setPA, excl: pB },
            { lbl: "Player B", val: pB, set: setPB, excl: pA },
          ].map(({ lbl, val, set, excl }) => (
            <div key={lbl}>
              <label className="block text-xs font-bold text-gray-400 tracking-widest mb-2">{lbl}</label>
              <select
                value={val}
                onChange={e => set(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select…</option>
                {names.filter(n => n !== excl).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {h2h && (h2h.all.length === 0 ? (
        <div className="card bg-gray-800 border border-gray-700 rounded p-8 text-center text-gray-400 text-xs">
          No matches played between these two yet.
        </div>
      ) : (
        <>
          <div className="card bg-gray-800 border border-gray-700 rounded p-6 mb-6">
            <div className="flex items-center">
              {[
                [pA, h2h.winsA, h2h.winsA >= h2h.winsB],
                [pB, h2h.winsB, h2h.winsB > h2h.winsA],
              ].map(([name, wins, leading], idx) => (
                <div key={name} className={`flex-1 ${idx === 0 ? "text-left" : "text-right"}`}>
                  <div className="text-xs text-gray-400 mb-2">{name}</div>
                  <div className={`text-5xl font-bold ${leading ? "text-squash-accent" : "text-gray-100"}`}>
                    {wins}
                  </div>
                </div>
              ))}
              <div className="px-3 text-gray-600 font-bold text-sm">vs</div>
            </div>

            <div className="flex h-1 rounded overflow-hidden mt-6 gap-1">
              <div
                style={{ flex: h2h.winsA || 0.5, background: "#238636" }}
              />
              <div
                style={{ flex: h2h.winsB || 0.5, background: "#333" }}
              />
            </div>

            <div className="flex justify-between mt-4 text-xs text-gray-400">
              <span>{((h2h.winsA / h2h.all.length) * 100).toFixed(0)}%</span>
              <span>{h2h.all.length} match{h2h.all.length !== 1 ? "es" : ""}</span>
              <span>{((h2h.winsB / h2h.all.length) * 100).toFixed(0)}%</span>
            </div>
          </div>

          <div className="card bg-gray-800 border border-gray-700 rounded overflow-hidden">
            <div className="text-xs font-bold text-gray-400 tracking-widest p-4 border-b border-gray-700">MATCH HISTORY</div>
            {h2h.all.map((m, i) => {
              const aIsP1 = m.p1 === pA, aWon = m.winner === pA;
              const score = aIsP1 ? `${m.s1}–${m.s2}` : `${m.s2}–${m.s1}`;
              const preA = aIsP1 ? m.p1pre : m.p2pre, postA = aIsP1 ? m.p1post : m.p2post;
              const dA = postA - preA;
              return (
                <div
                  key={m.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== h2h.all.length - 1 ? "border-b border-gray-700" : ""}`}
                >
                  <Badge type={aWon ? "green" : "red"} label={m.winner} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-100">{pA} {score} {pB}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {pA}: {preA.toFixed(0)} →{" "}
                      <span className={dA >= 0 ? "text-squash-green font-bold" : "text-squash-red font-bold"}>
                        {postA?.toFixed(0)}
                      </span>
                      <span className={dA >= 0 ? "text-squash-green" : "text-squash-red"}>
                        {" "}({dA >= 0 ? "+" : ""}{dA.toFixed(1)})
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 flex-shrink-0">{m.date}</div>
                </div>
              );
            })}
          </div>
        </>
      ))}
    </div>
  );
}
