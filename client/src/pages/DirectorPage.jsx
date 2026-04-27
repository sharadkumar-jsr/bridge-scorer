import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Share2, Trophy, Archive, BarChart2, Copy, Check } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function DirectorPage() {
  const { id }       = useParams();
  const { apiFetch } = useAuth();
  const nav          = useNavigate();

  const [session,   setSession]   = useState(null);
  const [progress,  setProgress]  = useState([]);
  const [rounds,    setRounds]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [releasing, setReleasing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [openRound, setOpenRound] = useState(1);

  const load = useCallback(async () => {
    try {
      const [sessRes, progRes, roundsRes] = await Promise.all([
        apiFetch(`/api/sessions/${id}`),
        apiFetch(`/api/sessions/${id}/results/progress`),
        apiFetch(`/api/sessions/${id}/results`),
      ]);
      const [sessData, progData, roundsData] = await Promise.all([
        sessRes.json(), progRes.json(), roundsRes.json(),
      ]);
      if (!sessRes.ok) throw new Error(sessData.error);
      setSession(sessData);
      setProgress(progData);

      // Group results by round
      const roundMap = {};
      for (const r of roundsData) {
        if (!roundMap[r.round]) roundMap[r.round] = [];
        roundMap[r.round].push(r);
      }
      setRounds(Object.entries(roundMap)
        .map(([rnd, boards]) => ({ round: Number(rnd), boards }))
        .sort((a,b) => a.round - b.round));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll every 15 seconds
  useEffect(() => {
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  const handleRelease = async () => {
    if (!confirm('Release final results to all players?')) return;
    setReleasing(true);
    try {
      await apiFetch(`/api/sessions/${id}/release`, { method: 'PATCH' });
      await load();
    } catch (e) { setError(e.message); }
    finally { setReleasing(false); }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this session? Players will no longer be able to enter scores.')) return;
    setArchiving(true);
    try {
      await apiFetch(`/api/sessions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived' }),
      });
      nav('/sessions');
    } catch (e) { setError(e.message); setArchiving(false); }
  };

  const copyInviteLink = () => {
    if (!session?.invite_token) return;
    const url = `${window.location.origin}/play/${session.invite_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareWhatsApp = () => {
    if (!session?.invite_token) return;
    const url  = `${window.location.origin}/play/${session.invite_token}`;
    const text = `Join our Bridge session "${session.name}"!\nClick to enter your scores: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  const totalBoards   = progress.reduce((s, p) => s + p.total, 0);
  const enteredBoards = progress.reduce((s, p) => s + p.entered, 0);
  const pct           = totalBoards ? Math.round((enteredBoards / totalBoards) * 100) : 0;

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title={session?.name ?? 'Director'} backTo="/sessions" />

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Session info */}
        <div className="card-felt relative p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl text-cream-100">{session?.name}</h2>
              <p className="text-cream-400 text-sm mt-1">
                {session?.date} · {session?.tables_count} tables ·
                {session?.num_boards} boards · {session?.num_rounds} rounds ·
                {session?.movement_type}
              </p>
            </div>
            <span className={`text-xs px-3 py-1 rounded-full font-medium flex-shrink-0
              ${session?.status === 'active'    ? 'bg-green-900/40 text-green-400 border border-green-700/30' :
                session?.status === 'completed' ? 'bg-blue-900/40 text-blue-400 border border-blue-700/30'   :
                                                  'bg-felt-700 text-cream-400'}`}>
              {session?.status}
            </span>
          </div>
        </div>

        {/* Invite link */}
        {session?.invite_token && (
          <div className="card-felt relative p-4">
            <p className="text-xs text-cream-400 mb-3 uppercase tracking-widest">
              Player Invite Link
            </p>
            <div className="flex gap-2">
              <button onClick={shareWhatsApp}
                className="flex items-center gap-2 bg-green-700/40 hover:bg-green-700/60
                           border border-green-600/30 text-green-300 text-sm px-4 py-2.5
                           rounded-lg transition-colors flex-1 justify-center">
                <Share2 size={14} /> Share via WhatsApp
              </button>
              <button onClick={copyInviteLink}
                className="flex items-center gap-2 border border-gold-500/30 text-cream-400
                           hover:text-gold-300 hover:border-gold-400/50 text-sm px-4 py-2.5
                           rounded-lg transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}

        {/* Overall progress */}
        <div className="card-felt relative p-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-cream-400">Overall Progress</span>
            <span className="font-mono text-gold-300">{enteredBoards}/{totalBoards} boards</span>
          </div>
          <div className="h-2.5 bg-felt-700 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-gold-400 rounded-full transition-all duration-700"
                 style={{ width: `${pct}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {progress.map(p => (
              <div key={p.pair_number} className={`text-xs flex items-center justify-between
                px-3 py-2 rounded-lg border
                ${p.entered === p.total
                  ? 'bg-green-900/20 border-green-700/30 text-green-400'
                  : 'border-gold-500/20 text-cream-400'}`}>
                <span>Pair {p.pair_number}</span>
                <span className="font-mono">{p.entered}/{p.total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">

          {/* Full Results */}
          <button onClick={() => nav(`/sessions/${id}/full-results`)}
            className="flex items-center justify-center gap-2 border border-gold-500/30
                       text-cream-300 hover:text-gold-300 hover:border-gold-400/50
                       text-sm px-4 py-3 rounded-xl transition-colors">
            <BarChart2 size={16} /> Full Results & Travellers
          </button>

          {/* Leaderboard */}
          <button onClick={() => nav(`/sessions/${id}/leaderboard`)}
            className="flex items-center justify-center gap-2 border border-gold-500/30
                       text-cream-300 hover:text-gold-300 hover:border-gold-400/50
                       text-sm px-4 py-3 rounded-xl transition-colors">
            <Trophy size={16} /> Live Leaderboard
          </button>

          {/* Release results */}
          {!session?.results_released ? (
            <button onClick={handleRelease} disabled={releasing}
              className="col-span-2 btn-gold flex items-center justify-center gap-2 py-3">
              {releasing ? <Loader2 size={16} className="animate-spin" /> : <Trophy size={16} />}
              {releasing ? 'Releasing…' : 'Release Final Results'}
            </button>
          ) : (
            <div className="col-span-2 bg-green-900/30 border border-green-700/30
                            text-green-400 text-sm text-center py-3 rounded-xl">
              ✅ Results released to players
            </div>
          )}

          {/* Archive */}
          <button onClick={handleArchive} disabled={archiving}
            className="col-span-2 flex items-center justify-center gap-2 border
                       border-gold-500/20 text-cream-400/60 hover:text-cream-300
                       hover:border-gold-500/40 text-sm px-4 py-2.5 rounded-xl transition-colors">
            {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
            {archiving ? 'Archiving…' : 'Archive Session'}
          </button>
        </div>

        {/* Rounds */}
        <div className="space-y-3">
          {rounds.map(({ round, boards }) => {
            const isOpen    = openRound === round;
            const rndTotal  = boards.filter(b => !b.is_bye).length;
            const rndEntered = boards.filter(b => !b.is_bye && b.entered_at).length;

            return (
              <div key={round} className="card-felt relative overflow-hidden">
                <button onClick={() => setOpenRound(isOpen ? null : round)}
                  className="w-full flex items-center justify-between px-5 py-3
                             hover:bg-white/5 transition-colors">
                  <span className="font-display text-lg text-cream-100">Round {round}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-cream-400">
                      {rndEntered}/{rndTotal}
                    </span>
                    <span className="text-cream-400 text-sm">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gold-500/20">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-felt-900/40 text-cream-400">
                          <th className="px-4 py-2 text-left">Board</th>
                          <th className="px-4 py-2 text-center">NS</th>
                          <th className="px-4 py-2 text-center">EW</th>
                          <th className="px-4 py-2 text-center">Contract</th>
                          <th className="px-4 py-2 text-right">Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gold-500/10">
                        {boards.map(b => {
                          if (b.is_bye) return (
                            <tr key={b.id} className="opacity-50">
                              <td className="px-4 py-2 font-mono text-cream-400">{b.board_number}</td>
                              <td className="px-4 py-2 text-center text-cream-400">{b.ns_pair}</td>
                              <td className="px-4 py-2 text-center text-cream-400">{b.ew_pair}</td>
                              <td colSpan="2" className="px-4 py-2 text-center text-amber-400/70">BYE</td>
                            </tr>
                          );
                          const contract = b.entered_at && b.level != null
                            ? `${b.declarer}${b.level}${b.suit}${b.doubled==='doubled'?'X':b.doubled==='redoubled'?'XX':''}=${b.tricks}`
                            : '—';
                          const score = b.ns_score;
                          return (
                            <tr key={b.id}>
                              <td className="px-4 py-2 font-mono text-cream-300">{b.board_number}</td>
                              <td className="px-4 py-2 text-center text-cream-200">{b.ns_pair}</td>
                              <td className="px-4 py-2 text-center text-cream-200">{b.ew_pair}</td>
                              <td className="px-4 py-2 text-center font-mono text-cream-200">{contract}</td>
                              <td className={`px-4 py-2 text-right font-mono font-bold
                                ${score>0?'text-green-400':score<0?'text-red-400':'text-cream-400'}`}>
                                {b.entered_at && score!=null?(score>0?`+${score}`:score):'—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
