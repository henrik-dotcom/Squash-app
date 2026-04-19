function Sparkline({ history, w = 44, h = 22 }) {
  if (!history || history.length < 2) return null;
  const mn = Math.min(...history), mx = Math.max(...history), range = mx - mn || 1;
  const pts = history.map((v, i) => `${(i / (history.length - 1)) * w},${h - 2 - ((v - mn) / range) * (h - 4)}`).join(" ");
  const up = history[history.length - 1] >= history[history.length - 2];
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={up ? "#238636" : "#ff4455"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

function EloBar({ elo }) {
  const pct = Math.min(100, Math.max(0, ((elo - 800) / 600) * 100));
  const col = elo >= 1100 ? "#238636" : elo >= 1000 ? "#1f6feb" : "#ff8855";
  return (
    <div className="w-full h-1 bg-gray-700 rounded overflow-hidden mt-1">
      <div style={{ width: `${pct}%`, height: "100%", background: col, borderRadius: "2px" }} />
    </div>
  );
}

export function Leaderboard({ players, loading, error, onRetry }) {
  const medals = ["🥇", "🥈", "🥉"];

  if (loading) {
    return <div className="text-center text-gray-400 text-xs py-12">Loading…</div>;
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-red-900/30 rounded p-4 text-red-500 text-xs">
        ✗ {error}
        {onRetry && <button onClick={onRetry} className="ml-4 text-gray-400 hover:text-gray-200 transition">Retry</button>}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      <h2 className="text-xs font-bold text-gray-400 tracking-widest mb-4">LEADERBOARD</h2>
      <div className="card bg-gray-800 border border-gray-700 rounded overflow-hidden">
        {players.map((p, i) => (
          <div
            key={p.name}
            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-700 last:border-b-0 ${
              p.matches === 0 ? "opacity-40" : ""
            }`}
          >
            <div className="w-8 text-center flex-shrink-0 text-lg font-bold">
              {i < 3 ? medals[i] : <span className="text-xs text-gray-400">{i + 1}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-100 text-sm truncate">{p.name}</div>
              <EloBar elo={p.elo} />
            </div>
            <Sparkline history={p.history} />
            <div className="text-right flex-shrink-0">
              <div className={`text-sm font-bold ${
                p.elo >= 1100 ? "text-squash-accent" : p.elo >= 1000 ? "text-gray-100" : "text-orange-500"
              }`}>
                {p.elo.toFixed(0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                <span className="text-squash-green">{p.wins}W</span> · <span className="text-squash-red">{p.losses}L</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
