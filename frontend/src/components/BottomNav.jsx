export function BottomNav({ active, onChange }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: '🏠' },
    { id: 'leaderboard', label: 'Board', icon: '🏆' },
    { id: 'stats', label: 'Stats', icon: '📊' },
    { id: 'h2h', label: 'H2H', icon: '⚔️' },
    { id: 'players', label: 'Players', icon: '👤' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-squash-darker border-t border-gray-700 flex justify-around py-2 z-40" style={{ paddingBottom: `max(8px, env(safe-area-inset-bottom))` }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex flex-col items-center gap-1 py-1 px-3 transition ${
            active === tab.id
              ? 'text-squash-accent'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="text-xs font-bold tracking-wide">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
