import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Download, ArrowLeft, Trophy } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function PlayerResults() {
  const { token }              = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                    = useNavigate();

  const [standings,  setStandings]  = useState([]);
  const [myResults,  setMyResults]  = useState([]);
  const [session,    setSession]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [tab,        setTab]        = useState('standings'); // 'standings' | 'myboards'

  useEffect(() => {
    if (!player) { nav(`/play/${token}`, { replace: true }); return; }
    loadAll();
  }, [player]);

  const loadAll = async () => {
    try {
      const [standRes, myRes, sessRes] = await Promise.all([
        playerFetch(`/api/play/${token}/standings`),
        playerFetch(`/api/play/${token}/myresults`),
        fetch(`/api/play/${token}`),
      ]);
      const [standData, myData, sessData] = await Promise.all([
        standRes.json(), myRes.json(), sessRes.json(),
      ]);
      if (!standRes.ok) throw new Error(standData.error);
      setStandings(standData);
      setMyResults(myData);
      setSession(sessData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const url = `/api/sessions/${player.sessionId}/pdf`;
    const a   = document.createElement('a');
    a.href    = url;
    a.setAttribute('Authorization', `Bearer ${player.token}`);
    // Open in new tab — browser will download it
    window.open(url + `?token=${player.token}`, '_blank');
  };

  function pairName(row) {
    const names = [row.player1Name, row.player2Name].filter(Boolean);
    return names.length ? names.join(' / ') : `Pair ${row.pairNumber}`;
  }

  function pctColour(pct) {
    const n = parseFloat(pct);
    if (n >= 60) return 'text-green-400';
    if (n >= 45) return 'text-gold-300';
    return 'text-red-400';
  }

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  const myStanding = standings.find(s => s.pairNumber === player?.pairNumber);

  return (
    <div className="min-h-screen bg-felt-gradient">
      {/* Header */}
      <header className="border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => nav(`/play/${token}/score`)} className="text-cream-400 hover:text-gold-300">
            <ArrowLeft size={20} />
          </button>
          <span className="font-display text-gold-300 text-base flex-1 truncate">
            {session?.name} — Results
          </span>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3"
          >
            <Download size={14} /> PDF
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* My result highlight */}
        {myStanding && (
          <div className="card-felt relative p-5 border-gold-400/50">
            <div className="text-xs text-cream-400 uppercase tracking-widest mb-1">Your Result</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-2xl text-cream-100">
                  {MEDAL[myStanding.rank] ?? `#${myStanding.rank}`} {myStanding.rank <= 3 ? '' : `Rank ${myStanding.rank}`}
                </div>
                <div className="text-cream-400 text-sm mt-0.5">
                  Pair {myStanding.pairNumber} · {myStanding.totalMP} / {myStanding.maxMP} MP
                </div>
              </div>
              <div className={`font-display text-3xl font-bold ${pctColour(myStanding.percentage)}`}>
                {myStanding.percentage}%
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2">
          {['standings', 'myboards'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all
                ${tab === t
                  ? 'bg-gold-400 border-gold-400 text-felt-950'
                  : 'border-gold-500/30 text-cream-300 hover:border-gold-400/50'}`}
            >
              {t === 'standings' ? '🏆 All Standings' : '📋 My Boards'}
            </button>
          ))}
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Standings tab */}
        {tab === 'standings' && (
          <div className="card-felt relative overflow-hidden">
            <div className="grid grid-cols-[44px_1fr_56px_60px] px-4 py-3
                            border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
              <div>Rank</div><div>Pair</div>
              <div className="text-right">MP</div><div className="text-right">%</div>
            </div>
            <div className="divide-y divide-gold-500/10">
              {standings.map((row, i) => (
                <div
                  key={row.pairNumber}
                  className={`grid grid-cols-[44px_1fr_56px_60px] px-4 py-3 items-center
                    ${row.pairNumber === player?.pairNumber ? 'bg-gold-400/10' : ''}
                    ${i === 0 ? 'bg-gold-400/5' : ''}`}
                >
                  <div>{row.rank <= 3
                    ? <span className="text-lg">{MEDAL[row.rank]}</span>
                    : <span className="font-mono text-cream-400 text-sm">{row.rank}</span>}
                  </div>
                  <div>
                    <div className={`text-sm font-semibold ${row.pairNumber === player?.pairNumber ? 'text-gold-300' : 'text-cream-100'}`}>
                      {pairName(row)}
                    </div>
                    <div className="text-xs text-cream-400/60">Pair {row.pairNumber}</div>
                  </div>
                  <div className="text-right font-mono text-sm text-cream-200">{row.totalMP}</div>
                  <div className={`text-right font-mono font-semibold text-sm ${pctColour(row.percentage)}`}>
                    {row.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My boards tab */}
        {tab === 'myboards' && (
          <div className="card-felt relative overflow-hidden">
            <div className="grid grid-cols-[40px_50px_1fr_50px_50px] px-4 py-3
                            border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
              <div>Bd</div><div>Side</div><div>Contract</div>
              <div className="text-right">Score</div><div className="text-right">MP</div>
            </div>
            <div className="divide-y divide-gold-500/10">
              {myResults.map((r, i) => {
                const contract = r.level != null
                  ? `${r.declarer}${r.level}${r.suit}${r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : ''}=${r.tricks}`
                  : '—';
                const score = r.ns_score != null
                  ? (r.side === 'NS' ? r.ns_score : -r.ns_score)
                  : null;
                return (
                  <div key={r.board_number}
                    className={`grid grid-cols-[40px_50px_1fr_50px_50px] px-4 py-3 items-center
                      ${i % 2 === 0 ? 'bg-felt-800/20' : ''}`}
                  >
                    <div className="font-mono text-cream-300 text-sm">{r.board_number}</div>
                    <div className={`text-xs font-semibold ${r.side === 'NS' ? 'text-cream-300' : 'text-gold-400'}`}>
                      {r.side}
                    </div>
                    <div className="font-mono text-sm text-cream-200">{contract}</div>
                    <div className={`text-right font-mono text-sm
                      ${score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-cream-400'}`}>
                      {score != null ? (score > 0 ? `+${score}` : score) : '—'}
                    </div>
                    <div className={`text-right font-mono text-sm
                      ${r.mp != null && r.mp >= r.maxMp * 0.6 ? 'text-green-400'
                        : r.mp != null && r.mp < r.maxMp * 0.4 ? 'text-red-400'
                        : 'text-cream-300'}`}>
                      {r.mp != null ? `${r.mp}/${r.maxMp}` : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={downloadPDF} className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
          <Download size={16} /> Download Full Results as PDF
        </button>
      </main>
    </div>
  );
}
