export function Dashboard({ players, matches, onLogMatch }) {
  const topPlayer = players.length > 0
    ? [...players].sort((a, b) => b.elo - a.elo)[0]
    : null;

  const lastMatch = matches.length > 0 ? matches[matches.length - 1] : null;

  const recentMatches = matches.slice(-5).reverse();

  const getWinBadgeColor = (isWin) => {
    return isWin ? "text-squash-accent" : "text-gray-400";
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between py-4 border-b border-gray-700 mb-6">
        <h1 className="text-gray-100 font-bold text-sm tracking-widest">SQUASH ELO</h1>
        <a
          href="/api/export"
          className="text-gray-400 text-xs hover:text-gray-200 transition"
        >
          ↓ xlsx
        </a>
      </div>

      {/* Log Match CTA */}
      <button
        onClick={onLogMatch}
        className="btn-primary w-full text-base py-4 mb-6 shadow-lg hover:shadow-xl transition-shadow"
      >
        + LOG MATCH
      </button>

      {/* Stat Tiles */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="stat-tile border-l-2 border-squash-accent">
          <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">TOP RANKED</div>
          <div className="text-gray-100 text-sm font-bold">{topPlayer?.name || "—"}</div>
          <div className="text-squash-accent text-xs font-bold">{topPlayer?.elo.toFixed(0) || "—"} ELO</div>
        </div>

        {lastMatch && (
          <div className="stat-tile border-l-2 border-squash-blue">
            <div className="text-xs font-bold text-gray-400 tracking-widest mb-2">LAST MATCH</div>
            <div className="text-gray-100 text-xs font-bold">
              {lastMatch.p1} {lastMatch.s1}–{lastMatch.s2} {lastMatch.p2}
            </div>
            <div className="text-squash-accent text-xs mt-1">
              {lastMatch.elo_delta > 0 ? '+' : ''}{lastMatch.elo_delta.toFixed(0)} pts
            </div>
          </div>
        )}
      </div>

      {/* Recent Matches */}
      {recentMatches.length > 0 && (
        <div>
          <div className="text-xs font-bold text-gray-400 tracking-widest mb-3">RECENT</div>
          <div className="space-y-2">
            {recentMatches.map((match, idx) => {
              const isWin = match.winner === match.p1;
              const winnerIsP1 = match.s1 > match.s2;
              return (
                <div
                  key={idx}
                  className="card bg-gray-800 border border-gray-700 rounded p-3 flex justify-between items-center"
                >
                  <div>
                    <div className="text-xs text-gray-100 font-bold">{match.p1} vs {match.p2}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {match.s1}–{match.s2} · {new Date(match.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className={`text-xs font-bold px-2 py-1 rounded ${winnerIsP1 ? "bg-squash-accent/20 text-squash-accent" : "bg-gray-700 text-gray-300"}`}>
                    {winnerIsP1 ? "W" : "L"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recentMatches.length === 0 && (
        <div className="text-center text-gray-400 text-xs py-12">
          No matches yet. Start by logging one!
        </div>
      )}
    </div>
  );
}
