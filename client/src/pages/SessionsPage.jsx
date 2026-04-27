import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Archive, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SessionsPage() {
  const { apiFetch, logout } = useAuth();
  const nav                  = useNavigate();

  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    apiFetch('/api/sessions')
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function statusColour(status) {
    if (status === 'active')    return 'bg-green-900/40 text-green-400 border-green-700/30';
    if (status === 'completed') return 'bg-blue-900/40 text-blue-400 border-blue-700/30';
    return 'bg-felt-700 text-cream-400 border-transparent';
  }

  function sessionRoute(s) {
    if (s.status === 'setup')   return `/sessions/${s.id}/setup`;
    return `/sessions/${s.id}/director`;
  }

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title="Club Sessions" onLogout={logout} />

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-cream-100">Sessions</h2>
          <div className="flex gap-2">
            <button onClick={() => nav('/sessions/archived')}
              className="flex items-center gap-1.5 text-sm border border-gold-500/30
                         text-cream-400 hover:text-gold-300 hover:border-gold-400/50
                         px-3 py-2 rounded-lg transition-colors">
              <Archive size={14} /> Archived
            </button>
            <button onClick={() => nav('/sessions/new')}
              className="flex items-center gap-1.5 text-sm btn-gold px-4 py-2">
              <Plus size={14} /> New Session
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-gold-400" />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="card-felt relative p-10 text-center">
            <p className="text-cream-400 mb-4">No sessions yet.</p>
            <button onClick={() => nav('/sessions/new')} className="btn-gold">
              Create First Session
            </button>
          </div>
        )}

        <div className="space-y-3">
          {sessions.map(s => (
            <button key={s.id} onClick={() => nav(sessionRoute(s))}
              className="w-full card-felt relative p-5 flex items-center gap-4
                         hover:bg-white/5 transition-colors text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-lg text-cream-100 truncate">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColour(s.status)}`}>
                    {s.status}
                  </span>
                </div>
                <div className="text-xs text-cream-400 flex gap-3">
                  <span>{s.date}</span>
                  <span>{s.tables_count} tables</span>
                  <span>{s.num_boards} boards</span>
                  <span>{s.movement_type}</span>
                </div>
              </div>
              <ChevronRight size={18} className="text-cream-400/50 flex-shrink-0" />
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
