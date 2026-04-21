import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Clock, ChevronDown, ChevronUp,
         Share2, Archive, Trophy, AlertTriangle, Copy, Check } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import ContractPicker from '../components/ContractPicker.jsx';
import { useAuth } from '../context/AuthContext.jsx';

function groupResults(results) {
  const map = {};
  for (const r of results) {
    if (!map[r.round]) map[r.round] = {};
    if (!map[r.round][r.table_number]) map[r.round][r.table_number] = [];
    map[r.round][r.table_number].push(r);
  }
  return map;
}

export default function DirectorPage() {
  const { id }       = useParams();
  const { apiFetch } = useAuth();
  const nav          = useNavigate();

  const [session,    setSession]    = useState(null);
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [activeResult, setActive]   = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [openRound,  setOpenRound]  = useState(null);
  const [releasing,  setReleasing]  = useState(false);
  const [archiving,  setArchiving]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [releaseErr, setReleaseErr] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch(`/api/sessions/${id}`).then(r => r.json()),
      apiFetch(`/api/sessions/${id}/results`).then(r => r.json()),
    ])
    .then(([s, r]) => {
      setSession(s);
      setResults(r);
      const firstIncomplete = [...new Set(r.map(x => x.round))].sort((a,b)=>a-b)
        .find(rnd => r.filter(x => x.round === rnd && !x.is_bye).some(x => !x.entered_at));
      setOpenRound(firstIncomplete ?? r[0]?.round ?? 1);
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, [id]);

  const grouped = useMemo(() => groupResults(results), [results]);
  const rounds  = Object.keys(grouped).map(Number).sort((a,b)=>a-b);

  const played  = results.filter(r => !r.is_bye);
  const entered = played.filter(r => r.entered_at);
  const pct     = played.length ? Math.round((entered.length / played.length) * 100) : 0;
  const allDone = entered.length === played.length && played.length > 0;

  // Per-pair completion for director overview
  const pairCompletion = useMemo(() => {
    const map = {};
    for (const r of played) {
      for (const p of [r.ns_pair, r.ew_pair]) {
        if (!map[p]) map[p] = { total: 0, done: 0 };
        map[p].total++;
        if (r.entered_at) map[p].done++;
      }
    }
    return map;
  }, [results]);

  const handleSave = async (contract) => {
    if (!activeResult) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/sessions/${id}/results/${activeResult.id}`, {
        method: 'PUT', body: JSON.stringify(contract),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error ?? 'Save failed');
      setResults(prev => prev.map(r => r.id === updated.id ? updated : r));
      setActive(null);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleRelease = async () => {
    setReleaseErr(''); setReleasing(true);
    try {
      const res  = await apiFetch(`/api/sessions/${id}/release`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(s => ({ ...s, results_released: true, status: 'completed' }));
    } catch (err) { setReleaseErr(err.message); }
    finally { setReleasing(false); }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this session? It will be hidden from the main list but all data is kept.')) return;
    setArchiving(true);
    try {
      await apiFetch(`/api/sessions/${id}/archive`, { method: 'POST' });
      nav('/sessions');
    } catch (err) { setError(err.message); setArchiving(false); }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(session?.inviteUrl ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const whatsappShare = () => {
    const text = encodeURIComponent(
      `🃏 *${session?.name}*\nJoin our bridge session and enter your scores:\n${session?.inviteUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
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

        {/* Invite Link card */}
        <div className="card-felt relative p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-cream-100 flex items-center gap-1.5">
              <Share2 size={14} className="text-gold-400" /> Player Invite Link
            </span>
            <button
              onClick={() => setShowInvite(s => !s)}
              className="text-xs text-cream-400 hover:text-gold-300"
            >
              {showInvite ? 'Hide' : 'Show'}
            </button>
          </div>
          {showInvite && session?.inviteUrl && (
            <div className="space-y-2">
              <div className="bg-felt-700 rounded-lg px-3 py-2 font-mono text-xs text-cream-300 break-all">
                {session.inviteUrl}
              </div>
              <div className="flex gap-2">
                <button onClick={copyInviteLink} className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-sm py-2">
                  {copied ? <><Check size={14} className="text-green-400" /> Copied!</> : <><Copy size={14} /> Copy Link</>}
                </button>
                <button onClick={whatsappShare} className="flex-1 text-sm py-2 rounded-lg bg-green-700 hover:bg-green-600 text-white font-semibold transition-colors">
                  📱 Share on WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="card-felt relative p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-cream-400">Overall Progress</span>
            <span className="text-sm font-mono text-gold-300">{entered.length}/{played.length} boards</span>
          </div>
          <div className="h-2 bg-felt-700 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gold-400 rounded-full transition-all duration-500"
                 style={{ width: `${pct}%` }} />
          </div>

          {/* Per-pair completion */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {Object.entries(pairCompletion).map(([pNum, { total, done }]) => (
              <div key={pNum} className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs
                ${done === total ? 'bg-green-900/30 border border-green-700/30' : 'bg-felt-700'}`}>
                <span className="text-cream-300">Pair {pNum}</span>
                <span className={done === total ? 'text-green-400 font-mono' : 'text-cream-400 font-mono'}>
                  {done}/{total}
                </span>
              </div>
            ))}
          </div>

          {/* Release / Archive actions */}
          {session?.results_released ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <CheckCircle2 size={15} /> Results released to all players
              </div>
              <button onClick={handleArchive} disabled={archiving}
                className="btn-ghost w-full flex items-center justify-center gap-2 text-sm py-2">
                <Archive size={14} /> {archiving ? 'Archiving…' : 'Archive Session'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {releaseErr && (
                <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-3 py-2 rounded-lg flex items-start gap-2">
                  <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                  {releaseErr}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleRelease}
                  disabled={releasing}
                  className="btn-gold flex-1 flex items-center justify-center gap-2"
                >
                  <Trophy size={15} />
                  {releasing ? 'Releasing…' : 'Release Final Results'}
                </button>
                <button onClick={handleArchive} disabled={archiving}
                  className="btn-ghost px-3" title="Archive session">
                  <Archive size={16} />
                </button>
              </div>
              {!allDone && (
                <p className="text-xs text-cream-400/60 text-center">
                  {played.length - entered.length} boards not yet entered — you can still release, but missing boards won't count
                </p>
              )}
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
          const tables    = grouped[rnd] ?? {};
          const tableNums = Object.keys(tables).map(Number).sort((a,b)=>a-b);
          const roundDone = Object.values(tables).flat().filter(r => !r.is_bye).every(r => r.entered_at);
          const isOpen    = openRound === rnd;

          return (
            <div key={rnd} className="card-felt relative overflow-hidden">
              <button
                onClick={() => setOpenRound(isOpen ? null : rnd)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg text-cream-100">Round {rnd}</span>
                  {roundDone
                    ? <CheckCircle2 size={16} className="text-green-400" />
                    : <Clock size={16} className="text-cream-400" />}
                </div>
                {isOpen ? <ChevronUp size={18} className="text-cream-400" /> : <ChevronDown size={18} className="text-cream-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-gold-500/20">
                  {tableNums.map(tbl => {
                    const boards = tables[tbl] ?? [];
                    return (
                      <div key={tbl} className="border-b border-gold-500/10 last:border-0">
                        <div className="px-5 py-2 bg-felt-900/40 text-xs text-cream-400 uppercase tracking-widest">
                          Table {tbl} — NS Pair {boards[0]?.ns_pair} · EW Pair {boards[0]?.ew_pair}
                        </div>
                        <div className="divide-y divide-gold-500/10">
                          {boards.filter(b => !b.is_bye).map(board => {
                            const isActiveBoard = activeResult?.id === board.id;
                            return (
                              <div key={board.id}>
                                <button
                                  onClick={() => setActive(isActiveBoard ? null : board)}
                                  className={`w-full px-5 py-3 flex items-center justify-between
                                             hover:bg-white/5 transition-colors text-left
                                             ${isActiveBoard ? 'bg-gold-400/5' : ''}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`w-7 h-7 rounded-full border flex items-center justify-center
                                                     text-xs font-mono flex-shrink-0
                                                     ${board.entered_at
                                                       ? 'border-green-500/50 bg-green-900/30 text-green-400'
                                                       : 'border-gold-500/30 text-cream-400'}`}>
                                      {board.board_number}
                                    </span>
                                    <span className="text-sm text-cream-300">Board {board.board_number}</span>
                                  </div>
                                  <div className="text-right">
                                    {board.entered_at ? (
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
                                {isActiveBoard && (
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
