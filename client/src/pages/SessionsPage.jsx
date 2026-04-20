import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, Users, ChevronRight, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function statusBadge(s) {
  if (s === 'active')    return <span className="badge-active">● Live</span>;
  if (s === 'completed') return <span className="badge-completed">✓ Done</span>;
  return <span className="badge-setup">Setup</span>;
}

export default function SessionsPage() {
  const { apiFetch } = useAuth();
  const nav = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    apiFetch('/api/sessions')
      .then(r => r.json())
      .then(setSessions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title="Sessions" />

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream-100">Club Sessions</h2>
            <p className="text-cream-400 text-sm mt-0.5">Select a session to manage or score</p>
          </div>
          <Link to="/sessions/new" className="btn-gold flex items-center gap-2">
            <Plus size={17} /> New Session
          </Link>
        </div>

        {/* List */}
        {loading && (
          <div className="flex justify-center py-20 text-cream-400">
            <Loader2 size={28} className="animate-spin" />
          </div>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}

        {!loading && sessions.length === 0 && (
          <div className="card-felt relative p-10 text-center">
            <div className="text-4xl text-gold-500/30 mb-3 select-none">♠ ♥ ♦ ♣</div>
            <p className="text-cream-400">No sessions yet. Create your first one.</p>
            <Link to="/sessions/new" className="btn-gold inline-flex items-center gap-2 mt-5">
              <Plus size={16} /> Create Session
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {sessions.map(s => (
            <div
              key={s.id}
              className="card-felt relative p-5 flex items-center gap-4 cursor-pointer
                         hover:border-gold-400/60 transition-colors group"
              onClick={() => {
                if (s.status === 'setup') nav(`/sessions/${s.id}/setup`);
                else nav(`/sessions/${s.id}/director`);
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-lg text-cream-100 truncate">{s.name}</span>
                  {statusBadge(s.status)}
                </div>
                <div className="flex gap-4 text-xs text-cream-400">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={12} /> {s.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {s.tables_count} tables · {s.num_boards} boards
                  </span>
                </div>
              </div>
              <ChevronRight size={18} className="text-cream-400/40 group-hover:text-gold-400 transition-colors" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
