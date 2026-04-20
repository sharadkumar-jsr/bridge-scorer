import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Trophy, Wifi, WifiOff } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { getSocket, disconnectSocket } from '../socket.js';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const { id }       = useParams();
  const { apiFetch, auth } = useAuth();
  const nav          = useNavigate();

  const [session,   setSession]   = useState(null);
  const [rankings,  setRankings]  = useState([]);
  const [pairs,     setPairs]     = useState({});   // pairNum → names
  const [loading,   setLoading]   = useState(true);
  const [connected, setConnected] = useState(false);
  const [flash,     setFlash]     = useState(null); // pairNum that just changed rank
  const prevRanks   = useRef({});

  // ── Initial data load ──────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiFetch(`/api/sessions/${id}`).then(r => r.json()),
      apiFetch(`/api/sessions/${id}/results/scores`).then(r => r.json()),
    ])
    .then(([s, scores]) => {
      setSession(s);
      // Build pair name lookup
      const lookup = {};
      (s.pairs ?? []).forEach(p => { lookup[p.pair_number] = p; });
      setPairs(lookup);
      setRankings(scores);
      scores.forEach(r => { prevRanks.current[r.pairNumber] = r.rank; });
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, [id]);

  // ── Socket.io for live updates ─────────────────────────────
  useEffect(() => {
    if (!auth?.accessToken) return;

    const socket = getSocket(auth.accessToken);

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('join_session', { sessionId: id });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('scores:updated', ({ sessionId, rankings: newRankings }) => {
      if (sessionId !== id) return;

      // Detect rank changes for flash animation
      newRankings.forEach(r => {
        const prev = prevRanks.current[r.pairNumber];
        if (prev !== undefined && prev !== r.rank) {
          setFlash(r.pairNumber);
          setTimeout(() => setFlash(null), 1500);
        }
        prevRanks.current[r.pairNumber] = r.rank;
      });

      setRankings(newRankings);
    });

    // If already connected (singleton), join immediately
    if (socket.connected) {
      setConnected(true);
      socket.emit('join_session', { sessionId: id });
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('scores:updated');
      socket.emit('leave_session', { sessionId: id });
    };
  }, [id, auth?.accessToken]);

  // ── Helpers ────────────────────────────────────────────────
  function pairName(num) {
    const p = pairs[num];
    if (!p) return `Pair ${num}`;
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    return names.length ? names.join(' / ') : `Pair ${num}`;
  }

  function pctColour(pct) {
    const n = parseFloat(pct);
    if (n >= 60) return 'text-green-400';
    if (n >= 45) return 'text-gold-300';
    return 'text-red-400';
  }

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar
        title={session?.name ?? 'Leaderboard'}
        backTo={`/sessions/${id}/director`}
        sessionId={id}
      />

      <main className="max-w-2xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream-100 flex items-center gap-2">
              <Trophy size={22} className="text-gold-400" />
              Live Standings
            </h2>
            <p className="text-cream-400 text-sm mt-0.5">{session?.name} · {session?.date}</p>
          </div>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border
            ${connected
              ? 'border-green-600/40 bg-green-900/30 text-green-400'
              : 'border-cream-400/20 bg-felt-700 text-cream-400'}`}
          >
            {connected
              ? <><span className="live-dot w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Live</>
              : <><WifiOff size={12} />Offline</>
            }
          </div>
        </div>

        {/* Rankings table */}
        {rankings.length === 0 ? (
          <div className="card-felt relative p-10 text-center text-cream-400">
            No results entered yet. Start scoring boards to see rankings.
          </div>
        ) : (
          <div className="card-felt relative overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 px-5 py-3
                            border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
              <div>Rank</div>
              <div>Pair</div>
              <div className="text-right">MP</div>
              <div className="text-right">%</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-gold-500/10">
              {rankings.map((row, i) => {
                const isFlash = flash === row.pairNumber;
                const isTop3  = row.rank <= 3;

                return (
                  <div
                    key={row.pairNumber}
                    className={`grid grid-cols-[3rem_1fr_6rem_6rem] gap-2 px-5 py-3.5
                                items-center transition-colors duration-300
                                ${isFlash ? 'bg-gold-400/10' : ''}
                                ${i === 0 ? 'bg-gold-400/5' : ''}`}
                  >
                    {/* Rank */}
                    <div className="flex items-center gap-1">
                      {isTop3
                        ? <span className="text-lg">{MEDAL[row.rank]}</span>
                        : <span className="font-mono text-cream-400 text-sm">{row.rank}</span>
                      }
                    </div>

                    {/* Name */}
                    <div>
                      <div className={`text-sm font-semibold ${i === 0 ? 'text-gold-300' : 'text-cream-100'}`}>
                        {pairName(row.pairNumber)}
                      </div>
                      <div className="text-xs text-cream-400/60">Pair {row.pairNumber}</div>
                    </div>

                    {/* Matchpoints */}
                    <div className="text-right font-mono text-sm text-cream-200">
                      {row.totalMP}
                      <span className="text-cream-400/50 text-xs"> /{row.maxMP}</span>
                    </div>

                    {/* Percentage */}
                    <div className={`text-right font-mono font-semibold text-sm ${pctColour(row.percentage)}`}>
                      {row.percentage}%
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Completion note */}
        {session?.status === 'completed' && (
          <p className="text-center text-cream-400/60 text-xs mt-6">
            ✓ Session complete · Final results
          </p>
        )}
        {session?.status === 'active' && (
          <p className="text-center text-cream-400/60 text-xs mt-6">
            Rankings update automatically as boards are scored
          </p>
        )}
      </main>
    </div>
  );
}
