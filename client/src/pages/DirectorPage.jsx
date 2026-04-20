import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import ContractPicker from '../components/ContractPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// ── Group results by round then table ─────────────────────────
function groupResults(results) {
  const map = {};
  for (const r of results) {
    if (!map[r.round]) map[r.round] = {};
    const key = `${r.table_number}`;
    if (!map[r.round][key]) map[r.round][key] = [];
    map[r.round][key].push(r);
  }
  return map;
}

function pctComplete(results) {
  const played = results.filter(r => !r.is_bye);
  const done   = played.filter(r => r.entered_at);
  return played.length ? Math.round((done.length / played.length) * 100) : 0;
}

export default function DirectorPage() {
  const { id }      = useParams();
  const { apiFetch } = useAuth();
  const nav         = useNavigate();

  const [session,    setSession]    = useState(null);
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeResult, setActive]   = useState(null);  // result row being scored
  const [saving,     setSaving]     = useState(false);
  const [openRound,  setOpenRound]  = useState(null);

  // Load session + all result rows
  useEffect(() => {
    Promise.all([
      apiFetch(`/api/sessions/${id}`).then(r => r.json()),
      apiFetch(`/api/sessions/${id}/results`).then(r => r.json()),
    ])
    .then(([s, r]) => {
      setSession(s);
      setResults(r);
      // Open the first incomplete round automatically
      const firstIncomplete = [...new Set(r.map(x => x.round))].sort((a,b)=>a-b)
        .find(rnd => r.filter(x => x.round === rnd && !x.is_bye).some(x => !x.entered_at));
      setOpenRound(firstIncomplete ?? r[0]?.round ?? 1);
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, [id]);

  const grouped = useMemo(() => groupResults(results), [results]);
  const rounds  = Object.keys(grouped).map(Number).sort((a,b)=>a-b);
  const pct     = pctComplete(results);

  const handleSave = async (contract) => {
    if (!activeResult) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/sessions/${id}/results/${activeResult.id}`, {
        method: 'PUT',
        body: JSON.stringify(contract),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error ?? 'Save failed');

      // Update local state
      setResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      setActive(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title={session?.name ?? 'Director'} sessionId={id} backTo="/sessions" />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* Progress bar */}
        <div className="card-felt relative p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cream-400">Progress</span>
            <span className="text-sm font-mono text-gold-300">{pct}%</span>
          </div>
          <div className="h-2 bg-felt-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold-400 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          {pct === 100 && (
            <div className="mt-3 flex items-center gap-2 justify-between">
              <span className="text-green-400 text-sm flex items-center gap-1.5">
                <CheckCircle2 size={15} /> All boards scored!
              </span>
              <button
                onClick={() => nav(`/sessions/${id}/leaderboard`)}
                className="btn-gold text-sm py-1.5"
              >
                View Final Results →
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Rounds accordion */}
        {rounds.map(rnd => {
          const tables   = grouped[rnd] ?? {};
          const tableNums = Object.keys(tables).map(Number).sort((a,b)=>a-b);
          const roundDone = Object.values(tables).flat()
            .filter(r => !r.is_bye).every(r => r.entered_at);
          const isOpen = openRound === rnd;

          return (
            <div key={rnd} className="card-felt relative overflow-hidden">
              {/* Round header */}
              <button
                onClick={() => setOpenRound(isOpen ? null : rnd)}
                className="w-full flex items-center justify-between px-5 py-4
                           hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg text-cream-100">Round {rnd}</span>
                  {roundDone
                    ? <CheckCircle2 size={16} className="text-green-400" />
                    : <Clock size={16} className="text-cream-400" />
                  }
                </div>
                {isOpen ? <ChevronUp size={18} className="text-cream-400" /> : <ChevronDown size={18} className="text-cream-400" />}
              </button>

              {/* Tables */}
              {isOpen && (
                <div className="border-t border-gold-500/20">
                  {tableNums.map(tbl => {
                    const boards = tables[tbl] ?? [];
                    return (
                      <div key={tbl} className="border-b border-gold-500/10 last:border-0">
                        {/* Table label */}
                        <div className="px-5 py-2 bg-felt-900/40 text-xs text-cream-400 uppercase tracking-widest">
                          Table {tbl} — NS Pair {boards[0]?.ns_pair} · EW Pair {boards[0]?.ew_pair}
                        </div>

                        {/* Board rows */}
                        <div className="divide-y divide-gold-500/10">
                          {boards.filter(b => !b.is_bye).map(board => {
                            const done = !!board.entered_at;
                            const isActive = activeResult?.id === board.id;

                            return (
                              <div key={board.id}>
                                {/* Board row */}
                                <button
                                  onClick={() => setActive(isActive ? null : board)}
                                  className={`w-full px-5 py-3 flex items-center justify-between
                                             hover:bg-white/5 transition-colors text-left
                                             ${isActive ? 'bg-gold-400/5' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-full border flex items-center justify-center
                                                     text-xs font-mono flex-shrink-0
                                                     ${done ? 'border-green-500/50 bg-green-900/30 text-green-400'
                                                            : 'border-gold-500/30 text-cream-400'}`}>
                                      {board.board_number}
                                    </span>
                                    <span className="text-sm text-cream-300">Board {board.board_number}</span>
                                  </div>

                                  <div className="text-right">
                                    {done ? (
                                      <span className="text-xs font-mono text-green-400">
                                        {board.declarer}{board.level}{board.suit}
                                        {board.doubled !== 'none' ? (board.doubled === 'doubled' ? 'X' : 'XX') : ''}
                                        {' = '}{board.tricks}
                                        <span className={`ml-2 ${board.ns_score > 0 ? 'text-green-300' : board.ns_score < 0 ? 'text-red-400' : 'text-cream-400'}`}>
                                          {board.ns_score > 0 ? '+' : ''}{board.ns_score}
                                        </span>
                                      </span>
                                    ) : (
                                      <span className="text-xs text-cream-400/60">tap to enter</span>
                                    )}
                                  </div>
                                </button>

                                {/* Inline contract picker */}
                                {isActive && (
                                  <div className="px-5 py-5 bg-felt-900/60 border-t border-gold-500/20">
                                    <ContractPicker
                                      boardNumber={board.board_number}
                                      nsPair={board.ns_pair}
                                      ewPair={board.ew_pair}
                                      onSubmit={handleSave}
                                      loading={saving}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}
