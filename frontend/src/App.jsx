import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "./lib/api";
import { useIsMobile } from "./hooks/useIsMobile";
import { BottomNav } from "./components/BottomNav";
import { Dashboard } from "./components/Dashboard";
import { LogMatchModal } from "./components/LogMatchModal";
import { Leaderboard } from "./components/Leaderboard";
import { PlayerStats } from "./components/PlayerStats";
import { HeadToHead } from "./components/HeadToHead";
import { AddPlayer } from "./components/AddPlayer";

export default function App() {
  const [tab, setTab] = useState("home");
  const isMobile = useIsMobile();
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLogModal, setShowLogModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
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

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const renderContent = () => {
    switch (tab) {
      case "home":
        return (
          <Dashboard
            players={players}
            matches={matches}
            onLogMatch={() => setShowLogModal(true)}
          />
        );
      case "leaderboard":
        return (
          <Leaderboard
            players={[...players].sort((a, b) => b.elo - a.elo)}
            loading={loading}
            error={error}
            onRetry={fetchAll}
          />
        );
      case "stats":
        return <PlayerStats players={players} matches={matches} />;
      case "h2h":
        return <HeadToHead players={players} matches={matches} />;
      case "players":
        return <AddPlayer onAdded={fetchAll} />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-squash-dark text-gray-200 min-h-screen font-mono">
      {renderContent()}
      {showLogModal && (
        <LogMatchModal
          players={players}
          onLogged={fetchAll}
          onClose={() => setShowLogModal(false)}
        />
      )}
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
