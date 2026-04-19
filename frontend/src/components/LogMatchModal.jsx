import { useState, useMemo } from "react";
import { apiFetch } from "../lib/api";
import { validateScore, calcEloPreview } from "../lib/elo";

export function LogMatchModal({ players, onLogged, onClose }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [s1, setS1] = useState("");
  const [s2, setS2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const p1Data = players.find(p => p.name === p1);
  const p2Data = players.find(p => p.name === p2);
  const validScore = validateScore(s1, s2);
  const canSubmit = p1Data && p2Data && p1 !== p2 && validScore;

  const preview = useMemo(() => {
    if (!canSubmit) return null;
    const s1Int = parseInt(s1), s2Int = parseInt(s2);
    const won = s1Int > s2Int;
    const newR1 = calcEloPreview(p1Data.elo, p2Data.elo, won, p1Data.match_count);
    const newR2 = calcEloPreview(p2Data.elo, p1Data.elo, !won, p2Data.match_count);
    return {
      p1: { old: p1Data.elo, new: newR1, delta: newR1 - p1Data.elo },
      p2: { old: p2Data.elo, new: newR2, delta: newR2 - p2Data.elo },
    };
  }, [p1Data, p2Data, s1, s2, validScore, canSubmit]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/matches", {
        method: "POST",
        body: JSON.stringify({ p1, p2, s1: parseInt(s1), s2: parseInt(s2) }),
      });
      setP1("");
      setP2("");
      setS1("");
      setS2("");
      onLogged?.();
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const availablePlayers = players.filter(p => p.name !== p2);
  const availablePlayers2 = players.filter(p => p.name !== p1);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full bg-gray-800 rounded-t-2xl border-t border-gray-600 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center mb-4">
          <div className="w-8 h-1 bg-gray-600 rounded-full" />
        </div>

        <h2 className="text-gray-100 font-bold text-sm tracking-widest mb-6">Log a Match</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-400 tracking-widest mb-2">PLAYER 1</label>
            <select
              value={p1}
              onChange={e => setP1(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select player</option>
              {availablePlayers.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 tracking-widest mb-2">PLAYER 2</label>
            <select
              value={p2}
              onChange={e => setP2(e.target.value)}
              className="input-field w-full"
            >
              <option value="">Select player</option>
              {availablePlayers2.map(p => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-400 tracking-widest mb-2">SCORE P1</label>
              <input
                type="number"
                value={s1}
                onChange={e => setS1(e.target.value)}
                className="input-field"
                min="0"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 tracking-widest mb-2">SCORE P2</label>
              <input
                type="number"
                value={s2}
                onChange={e => setS2(e.target.value)}
                className="input-field"
                min="0"
              />
            </div>
          </div>

          {preview && (
            <div className="bg-squash-darker border border-squash-accent rounded p-4 space-y-2">
              <div className="text-xs font-bold text-gray-400 tracking-widest">ELO PREVIEW</div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-200">{p1}</span>
                <span className={preview.p1.delta >= 0 ? "text-squash-accent" : "text-squash-red"}>
                  {preview.p1.old} → {preview.p1.new.toFixed(0)} ({preview.p1.delta > 0 ? '+' : ''}{preview.p1.delta.toFixed(0)})
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-200">{p2}</span>
                <span className={preview.p2.delta >= 0 ? "text-squash-accent" : "text-squash-red"}>
                  {preview.p2.old} → {preview.p2.new.toFixed(0)} ({preview.p2.delta > 0 ? '+' : ''}{preview.p2.delta.toFixed(0)})
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-squash-red/20 border border-squash-red rounded p-3 text-xs text-squash-red">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary w-full disabled:opacity-50"
          >
            {submitting ? "SUBMITTING..." : "SUBMIT MATCH"}
          </button>
        </form>
      </div>
    </div>
  );
}
