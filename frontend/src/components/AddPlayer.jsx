import { useState } from "react";
import { apiFetch } from "../lib/api";

export function AddPlayer({ onAdded }) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/players", {
        method: "POST",
        body: JSON.stringify({ name: trimmed }),
      });
      setToast(`Added ${trimmed}`);
      setName("");
      setTimeout(() => setToast(""), 3000);
      onAdded?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pb-24">
      <h2 className="text-xs font-bold text-gray-400 tracking-widest mb-4">ADD PLAYER</h2>

      {toast && (
        <div className="card bg-gray-900 border border-blue-900/30 rounded mb-4 p-3 text-blue-400 text-xs">
          {toast}
        </div>
      )}

      {error && (
        <div className="card bg-gray-900 border border-red-900/30 rounded mb-4 p-3 text-red-400 text-xs">
          ✗ {error}
        </div>
      )}

      <div className="card bg-gray-800 border border-gray-700 rounded p-4">
        <label className="block text-xs font-bold text-gray-400 tracking-widest mb-3">PLAYER NAME</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={name}
            onChange={e => {
              setName(e.target.value);
              setError("");
            }}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="Enter name…"
            className="input-field flex-1"
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || submitting}
            className="btn-primary disabled:opacity-50 whitespace-nowrap"
          >
            {submitting ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
