import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2, Eye, ChevronLeft, Archive } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ArchivedSessionsPage() {
  const { apiFetch } = useAuth();
  const nav          = useNavigate();

  const [sessions,  setSessions]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [deleting,  setDeleting]  = useState(null); // session id being deleted
  const [selected,  setSelected]  = useState(new Set()); // for bulk delete

  useEffect(() => {
    loadArchived();
  }, []);

  const loadArchived = async () => {
    try {
      const res  = await apiFetch('/api/sessions/archived');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load');
      setSessions(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete session "${name}"?\n\nThis will permanently delete all scores and results. This cannot be undone.`)) return;
    setDeleting(id);
    try {
      const res = await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Delete failed');
      }
      setSessions(prev => prev.filter(s => s.id !== id));
      setSelected(prev => { const n = new Set(prev); n.delete(id); return n; });
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected session(s)?\n\nThis will permanently delete all their scores and results. This cannot be undone.`)) return;

    const ids = [...selected];
    for (const id of ids) {
      try {
        await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' });
        setSessions(prev => prev.filter(s => s.id !== id));
      } catch (e) {
        setError(`Failed to delete some sessions: ${e.message}`);
      }
    }
    setSelected(new Set());
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const selectAll = () => {
    if (selected.size === sessions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sessions.map(s => s.id)));
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await apiFetch(`/api/sessions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title="Archived Sessions" backTo="/sessions" />

      <main className="max-w-3xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream-100 flex items-center gap-2">
              <Archive size={20} className="text-gold-400" />
              Archived Sessions
            </h2>
            <p className="text-cream-400 text-sm mt-0.5">
              View past sessions or delete incomplete ones
            </p>
          </div>
          {selected.size > 0 && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-2 bg-red-900/60 hover:bg-red-800/60
                         border border-red-700/50 text-red-300 text-sm px-4 py-2 rounded-lg transition-colors">
              <Trash2 size={14} />
              Delete {selected.size} selected
            </button>
          )}
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
            <Archive size={32} className="text-gold-500/30 mx-auto mb-3" />
            <p className="text-cream-400">No archived sessions yet.</p>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <>
            {/* Select all */}
            <div className="flex items-center gap-3 mb-3 px-1">
              <input
                type="checkbox"
                checked={selected.size === sessions.length && sessions.length > 0}
                onChange={selectAll}
                className="w-4 h-4 accent-gold-400 cursor-pointer"
              />
              <span className="text-cream-400 text-sm">
                {selected.size === 0
                  ? 'Select all to delete'
                  : `${selected.size} of ${sessions.length} selected`}
              </span>
            </div>

            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id}
                  className={`card-felt relative p-4 flex items-center gap-4 transition-colors
                    ${selected.has(s.id) ? 'border-red-700/40 bg-red-900/5' : ''}`}>

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleSelect(s.id)}
                    className="w-4 h-4 accent-gold-400 cursor-pointer flex-shrink-0"
                  />

                  {/* Session info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-display text-cream-100 truncate">{s.name}</span>
                      <span className="text-xs bg-felt-700 text-cream-400 px-2 py-0.5 rounded-full flex-shrink-0">
                        Archived
                      </span>
                    </div>
                    <div className="text-xs text-cream-400 flex gap-3">
                      <span>{s.date}</span>
                      <span>{s.tables_count} tables · {s.num_boards} boards</span>
                      <span>{s.movement_type}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* View results */}
                    <button
                      onClick={() => nav(`/sessions/${s.id}/archived-view`)}
                      className="flex items-center gap-1 text-xs text-cream-400
                                 hover:text-gold-300 transition-colors px-2 py-1.5
                                 border border-gold-500/20 rounded-lg hover:border-gold-400/40"
                      title="View results"
                    >
                      <Eye size={13} /> View
                    </button>

                    {/* Unarchive */}
                    <button
                      onClick={() => handleUnarchive(s.id)}
                      className="flex items-center gap-1 text-xs text-cream-400
                                 hover:text-gold-300 transition-colors px-2 py-1.5
                                 border border-gold-500/20 rounded-lg hover:border-gold-400/40"
                      title="Restore to completed"
                    >
                      <ChevronLeft size={13} /> Restore
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="flex items-center gap-1 text-xs text-red-400/70
                                 hover:text-red-300 transition-colors px-2 py-1.5
                                 border border-red-700/20 rounded-lg hover:border-red-600/40
                                 disabled:opacity-50"
                      title="Delete permanently"
                    >
                      {deleting === s.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <Trash2 size={13} />}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
