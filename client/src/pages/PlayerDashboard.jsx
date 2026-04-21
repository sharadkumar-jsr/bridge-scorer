import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Trophy, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';
import ContractPicker from '../components/ContractPicker.jsx';

export default function PlayerDashboard() {
  const { token }                          = useParams();
  const { player, playerFetch, leaveSession } = usePlayer();
  const nav                                = useNavigate();

  const [boards,   setBoards]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [active,   setActive]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [released, setReleased] = useState(false);

  useEffect(() => {
    if (!player) nav(`/play/${token}`, { replace: true });
  }, [player]);

  useEffect(() => {
    if (!player) return;
    loadSchedule();
    const poll = setInterval(loadSchedule, 30_000);
    return () => clearInterval(poll);
  }, [player]);

  const loadSchedule = async () => {
    try {
      const [schedRes, sessRes] = await Promise.all([
        playerFetch(`/api/play/${token}/schedule`),
        fetch(`/api/play/${token}`),
      ]);
      const schedData = await schedRes.json();
      const sessData  = await sessRes.json();
      if (!schedRes.ok) throw new Error(schedData.error);
      setBoards(Array.isArray(schedData) ? schedData : []);
      setReleased(sessData.results_released ?? false);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Group ALL boards (including BYE) by round
  const roundMap = useMemo(() => {
    const map = {};
    for (const b of boards) {
      if (!map[b.round]) map[b.round] = [];
      map[b.round].push(b);
    }
    return map;
  }, [boards]);

  const roundNums = Object.keys(roundMap).map(Number).sort((a, b) => a - b);

  // Open first round with un-entered real boards
  const [openRound, setOpenRound] = useState(null);
  useEffect(() => {
    if (roundNums.length && openRound === null) {
      const first = roundNums.find(r =>
        roundMap[r].some(b => !b.is_bye && b.canEnter)
      ) ?? roundNums[0];
      setOpenRound(first);
    }
  }, [roundNums.length]);

  // Progress — only count real (non-bye) boards
  const realBoards    = boards.filter(b => !b.is_bye);
  const enteredBoards = realBoards.filter(b => b.entered_at).length;
  const totalBoards   = realBoards.length;
  const pct           = totalBoards ? Math.round((enteredBoards / totalBoards) * 100) : 0;

  const handleSave = async (contract) => {
    if (!active) return;
    setSaving(true);
    try {
      const res  = await playerFetch(`/api/play/${token}/boards/${active.id}`, {
        method: 'PUT',
        body:   JSON.stringify(contract),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setBoards(prev => prev.map(b =>
        b.id === active.id
          ? { ...b, ...contract, entered_at: new Date().toISOString(), canEnter: false }
          : b
      ));
      setActive(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLeave = () => { leaveSession(); nav(`/play/${token}`); };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-felt-gradient">
      {/* Navbar */}
      <header className="border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <span className="text-gold-400 text-lg select-none">♠♥♦♣</span>
          <div className="flex-1 min-w-0">
            <div className="font-display text-gold-300 text-base truncate">{player?.sessionName}</div>
            <div className="text-xs text-cream-400">
              Pair {player?.pairNumber}
              {(player?.player1Name || player?.player2Name) &&
                ` · ${[player.player1Name, player.player2Name].filter(Boolean).join(' / ')}`}
            </div>
          </div>
          {released && (
            <button onClick={() => nav(`/play/${token}/results`)}
              className="flex items-center gap-1 text-xs text-gold-300 hover:text-gold-200">
              <Trophy size={14} /> Results
            </button>
          )}
          <button onClick={handleLeave} className="text-cream-400 hover:text-red-400 transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Progress — only real boards count */}
        <div className="card-felt relative p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-cream-400">Your boards</span>
            <span className="font-mono text-gold-300">{enteredBoards}/{totalBoards} entered</span>
          </div>
          <div className="h-2 bg-felt-700 rounded-full overflow-hidden">
            <div className="h-full bg-gold-400 rounded-full transition-all duration-500"
                 style={{ width: `${pct}%` }} />
          </div>
          {pct === 100 && !released && (
            <p className="text-green-400 text-sm mt-2 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> All boards entered — waiting for director to release results
            </p>
          )}
          {released && (
            <button onClick={() => nav(`/play/${token}/results`)}
              className="btn-gold w-full mt-3 text-sm py-2">
              🏆 View Final Results & Download PDF
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-2.5 rounded-lg">
            {error}
          </div>
        )}

        {/* Rounds */}
        {roundNums.map(rnd => {
          const rndBoards  = roundMap[rnd] ?? [];

          // Check if this round is a BYE round — all boards in this round are bye
          const allBye = rndBoards.length > 0 && rndBoards.every(b => b.is_bye);

          // Real boards only for this round
          const realRndBoards = rndBoards.filter(b => !b.is_bye);
          const rndDone       = realRndBoards.length > 0 && realRndBoards.every(b => b.entered_at);
          const isOpen        = openRound === rnd;
          const first         = realRndBoards[0] ?? rndBoards[0];

          // ── BYE Round ──────────────────────────────────────────
          if (allBye) {
            return (
              <div key={rnd} className="card-felt relative overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between opacity-60">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg text-cream-400">Round {rnd}</span>
                    <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/30
                                     px-2 py-0.5 rounded-full">
                      👻 BYE Round
                    </span>
                  </div>
                  <span className="text-xs text-cream-400/60">Average score awarded</span>
                </div>
                <div className="px-5 pb-4 opacity-60">
                  <p className="text-xs text-cream-400/60">
                    Your pair has a bye this round — no boards to play.
                    An average score is awarded automatically by the system.
                  </p>
                </div>
              </div>
            );
          }

          // ── Normal Round ───────────────────────────────────────
          return (
            <div key={rnd} className="card-felt relative overflow-hidden">
              <button
                onClick={() => setOpenRound(isOpen ? null : rnd)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg text-cream-100">Round {rnd}</span>
                  {rndDone
                    ? <CheckCircle2 size={15} className="text-green-400" />
                    : <span className="text-xs text-cream-400/60">
                        {realRndBoards.filter(b => b.entered_at).length}/{realRndBoards.length}
                      </span>
                  }
                </div>
                <div className="flex items-center gap-3 text-right">
                  {first && (
                    <div className="text-xs text-cream-400">
                      <div>Table {first.table_number} · {first.side}</div>
                      <div>vs {first.opponentNames}</div>
                    </div>
                  )}
                  {isOpen
                    ? <ChevronUp size={16} className="text-cream-400" />
                    : <ChevronDown size={16} className="text-cream-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gold-500/20 divide-y divide-gold-500/10">
                  {realRndBoards.map(board => {
                    const isActive  = active?.id === board.id;
                    const isEntered = !!board.entered_at;
                    const canEnter  = board.canEnter;

                    return (
                      <div key={board.id}>
                        <button
                          onClick={() => { if (canEnter) setActive(isActive ? null : board); }}
                          className={`w-full px-5 py-3 flex items-center justify-between
                                     transition-colors text-left
                                     ${isActive ? 'bg-gold-400/5' : ''}
                                     ${canEnter ? 'hover:bg-white/5 cursor-pointer' : 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-full border flex items-center justify-center
                                           text-xs font-mono flex-shrink-0
                                           ${isEntered
                                             ? 'border-green-500/50 bg-green-900/30 text-green-400'
                                             : 'border-gold-500/30 text-cream-400'}`}>
                              {board.board_number}
                            </div>
                            <div>
                              <div className="text-sm text-cream-200">Board {board.board_number}</div>
                              <div className="text-xs text-cream-400/60">{board.side} · vs {board.opponentNames}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            {isEntered ? (
                              <span className="text-xs font-mono text-green-400">
                                {board.level === 0
                                  ? 'Passed Out'
                                  : `${board.declarer}${board.level}${board.suit}${board.doubled !== 'none' ? (board.doubled === 'doubled' ? 'X' : 'XX') : ''} = ${board.tricks}`
                                }
                              </span>
                            ) : canEnter ? (
                              <span className="text-xs text-cream-400/50">tap to enter</span>
                            ) : (
                              <span className="text-xs text-amber-400/70">entered by opponents</span>
                            )}
                          </div>
                        </button>

                        {/* Contract picker */}
                        {isActive && canEnter && (
                          <div className="px-5 py-5 bg-felt-900/60 border-t border-gold-500/20">
                            <ContractPicker
                              boardNumber={board.board_number}
                              nsPair={board.ns_pair}
                              ewPair={board.ew_pair}
                              side={board.side}
                              onSubmit={handleSave}
                              loading={saving}
                            />
                          </div>
                        )}

                        {/* Score entered by opponents */}
                        {!canEnter && isEntered && (
                          <div className="px-5 py-3 bg-felt-900/40 border-t border-gold-500/10">
                            <p className="text-xs text-amber-400/80 flex items-center gap-1.5">
                              🔒 Score entered by your opponents —
                              <span className="font-mono text-cream-300">
                                {board.level === 0
                                  ? 'Passed Out'
                                  : `${board.declarer}${board.level}${board.suit}${board.doubled !== 'none' ? (board.doubled === 'doubled' ? 'X' : 'XX') : ''} = ${board.tricks}`
                                }
                              </span>
                            </p>
                          </div>
                        )}
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
