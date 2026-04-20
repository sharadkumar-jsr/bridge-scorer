import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Trophy, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { disconnectSocket } from '../socket.js';

export default function Navbar({ title, sessionId, backTo }) {
  const { auth, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    disconnectSocket();
    await logout();
    nav('/login');
  };

  return (
    <header className="border-b border-gold-500/20 bg-felt-900/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Back arrow */}
        {backTo && (
          <Link to={backTo} className="text-cream-400 hover:text-gold-300 transition-colors">
            <ChevronLeft size={22} />
          </Link>
        )}

        {/* Logo / Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-gold-400 text-xl select-none">♠♥♦♣</span>
          <span className="font-display text-gold-300 text-lg truncate">
            {title ?? 'Bridge Scorer'}
          </span>
        </div>

        {/* Session actions */}
        {sessionId && (
          <Link
            to={`/sessions/${sessionId}/leaderboard`}
            className="flex items-center gap-1.5 text-sm text-cream-400 hover:text-gold-300 transition-colors"
          >
            <Trophy size={15} />
            Standings
          </Link>
        )}

        {/* User + logout */}
        {auth && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-cream-400 hidden sm:block">
              {auth.user?.displayName ?? auth.user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-cream-400 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={17} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
