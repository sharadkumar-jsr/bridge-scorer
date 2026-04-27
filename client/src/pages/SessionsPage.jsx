import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, Archive, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SessionsPage() {
  const { apiFetch, logout } = useAuth();
  const nav                  = useNavigate();

  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [archiving, setArchiving] = useState(null); // session id being archived

  const load = () => {
    setLoading(true);
    apiFetch('/api/sessions')
      .then(r => r.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleArchive = async (e, id, name) => {
    e.stopPropagation(); // prevent navigating into the session
    if (!confirm(`Archive session "${name}"?\n\nYou can restore it later from Archived Sessions.`)) return;
    setArchiving(id);
    try {
      const res = await apiFetch(`/api/sessions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Archive failed'); }
      // Remove from list immediately
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) { setError(e.message); }
    finally { setArchiving(null); }
  };

  function statusColour(status) {
    if (status === 'active')    return 'bg-green-900/40 text-green-400 border-green-700/30';
    if (status === 'completed') return 'bg-blue-900/40 text-blue-400 border-blue-700/30';
    return 'bg-felt-700 text-cream-400 border-transparent';
  }

  function sessionRoute(s) {
    if (s.status === 'setup') return `/sessions/${s.id}/setup`;
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
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg mb-4 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-200 ml-4">✕</button>
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
            <div key={s.id}
              className="card-felt relative overflow-hidden">

              {/* Main clickable area */}
              <button onClick={() => nav(sessionRoute(s))}
                className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors text-left">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-display text-lg text-cream-100 truncate">{s.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${statusColour(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs text-cream-400 flex gap-3 flex-wrap">
                    <span>{s.date}</span>
                    <span>{s.tables_count} tables</span>
                    <span>{s.num_boards} boards</span>
                    <span>{s.movement_type}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="text-cream-400/50 flex-shrink-0" />
              </button>

              {/* Archive button — only shown for completed sessions */}
              {s.status === 'completed' && (
                <div className="border-t border-gold-500/10 px-5 py-2 flex items-center justify-between
                                bg-felt-900/30">
                  <span className="text-xs text-cream-400/60">
                    Results released · Ready to archive
                  </span>
                  <button
                    onClick={(e) => handleArchive(e, s.id, s.name)}
                    disabled={archiving === s.id}
                    className="flex items-center gap-1.5 text-xs text-cream-400 hover:text-gold-300
                               border border-gold-500/20 hover:border-gold-400/40
                               px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {archiving === s.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Archive size={11} />}
                    {archiving === s.id ? 'Archiving…' : 'Send to Archive'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
