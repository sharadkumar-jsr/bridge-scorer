import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, Trophy, LogOut, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';
import ContractPicker from '../components/ContractPicker.jsx';

export default function PlayerDashboard() {
  const { token }                             = useParams();
  const { player, playerFetch, leaveSession } = usePlayer();
  const nav                                   = useNavigate();

  const [boards,   setBoards]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [active,   setActive]   = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [released, setReleased] = useState(false);

  // ── Live per-board traveller (only for boards this pair has completed) ──
  const [travOpen,    setTravOpen]    = useState(null);   // board_number currently open
  const [travData,    setTravData]    = useState(null);   // { boardNumber, results, playedCount }
  const [travLoading, setTravLoading] = useState(false);
  const [travError,   setTravError]   = useState('');

  const loadTraveller = async (boardNumber) => {
    setTravError('');
    try {
      const res  = await playerFetch(`/api/play/${token}/boards/${boardNumber}/traveller`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not load traveller');
      setTravData(data);
    } catch (e) { setTravError(e.message); setTravData(null); }
  };

  const toggleTraveller = async (boardNumber) => {
    if (travOpen === boardNumber) { setTravOpen(null); setTravData(null); setTravError(''); return; }
    setTravOpen(boardNumber);
    setTravData(null);
    setTravError('');
    setTravLoading(true);
    await loadTraveller(boardNumber);
    setTravLoading(false);
  };

  // Keep the open traveller live — re-fetch (server re-checks eligibility every time)
  useEffect(() => {
    if (travOpen == null) return;
    const t = setInterval(() => loadTraveller(travOpen), 12_000);
    return () => clearInterval(t);
  }, [travOpen]);

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
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Group boards by round
  const roundMap = useMemo(() => {
    const map = {};
    for (const b of boards) {
      if (!map[b.round]) map[b.round] = [];
      map[b.round].push(b);
    }
    return map;
  }, [boards]);

  const roundNums = Object.keys(roundMap).map(Number).sort((a,b) => a-b);

  const [openRound, setOpenRound] = useState(null);
  useEffect(() => {
    if (roundNums.length && openRound === null) {
      const first = roundNums.find(r =>
        roundMap[r].some(b => !b.is_bye && b.canEnter)
      ) ?? roundNums[0];
      setOpenRound(first);
    }
  }, [roundNums.length]);

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

      // Store the returned nsScore so we can show points to this pair
      setBoards(prev => prev.map(b =>
        b.id === active.id
          ? {
              ...b,
              ...contract,
              entered_at: new Date().toISOString(),
              canEnter:   false,
              ns_score:   data.nsScore ?? null,
            }
          : b
      ));
      setActive(null);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  // Calculate the score from this pair's perspective
  function myScore(board) {
    if (board.ns_score == null) return null;
    return board.side === 'NS' ? board.ns_score : -board.ns_score;
  }

  function contractLabel(board) {
    if (!board.entered_at) return null;
    if (board.level === 0) return 'Passed Out';
    if (board.level == null) return null;
    const dbl = board.doubled === 'doubled' ? 'X'
              : board.doubled === 'redoubled' ? 'XX' : '';
    return `${board.declarer}${board.level}${board.suit}${dbl} = ${board.tricks}`;
  }

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

        {/* Progress */}
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
              🏆 View Final Results
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
          const rndBoards     = roundMap[rnd] ?? [];
          const allBye        = rndBoards.length > 0 && rndBoards.every(b => b.is_bye);
          const realRndBoards = rndBoards.filter(b => !b.is_bye);
          const rndDone       = realRndBoards.length > 0 && realRndBoards.every(b => b.entered_at);
          const isOpen        = openRound === rnd;
          const first         = realRndBoards[0] ?? rndBoards[0];

          // BYE round
          if (allBye) {
            return (
              <div key={rnd} className="card-felt relative overflow-hidden opacity-60">
                <div className="px-5 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-display text-lg text-cream-400">Round {rnd}</span>
                    <span className="text-xs bg-amber-900/40 text-amber-400 border border-amber-700/30
                                     px-2 py-0.5 rounded-full">
                      👻 BYE Round
                    </span>
                  </div>
                  <span className="text-xs text-cream-400/60">Average score awarded</span>
                </div>
                <div className="px-5 pb-4">
                  <p className="text-xs text-cream-400/60">
                    Your pair has a bye this round. An average score is awarded automatically.
                  </p>
                </div>
              </div>
            );
          }

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
                        {realRndBoards.filter(b=>b.entered_at).length}/{realRndBoards.length}
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
                    const label     = contractLabel(board);
                    const score     = myScore(board);

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

                          {/* ── Score display after entry ── */}
                          <div className="text-right">
                            {isEntered ? (
                              <div>
                                <div className="text-xs font-mono text-cream-300">{label}</div>
                                {score !== null && (
                                  <div className={`text-sm font-bold font-mono
                                    ${score > 0 ? 'text-green-400'
                                    : score < 0 ? 'text-red-400'
                                    : 'text-cream-400'}`}>
                                    {score > 0 ? `+${score}` : score === 0 ? '0' : score}
                                  </div>
                                )}
                              </div>
                            ) : canEnter ? (
                              <span className="text-xs text-cream-400/50">tap to enter</span>
                            ) : (
                              <div>
                                {label && <div className="text-xs font-mono text-cream-300">{label}</div>}
                                {score !== null && (
                                  <div className={`text-sm font-bold font-mono
                                    ${score > 0 ? 'text-green-400'
                                    : score < 0 ? 'text-red-400'
                                    : 'text-cream-400'}`}>
                                    {score > 0 ? `+${score}` : score === 0 ? '0' : score}
                                  </div>
                                )}
                                {!label && <span className="text-xs text-amber-400/70">entered by opponents</span>}
                              </div>
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

                        {/* Locked by opponents */}
                        {!canEnter && isEntered && !label && (
                          <div className="px-5 py-3 bg-felt-900/40 border-t border-gold-500/10">
                            <p className="text-xs text-amber-400/80">
                              🔒 Score entered by your opponents
                            </p>
                          </div>
                        )}

                        {/* Live traveller — only for boards this pair has completed */}
                        {isEntered && (
                          <div className="px-5 py-3 bg-felt-900/30 border-t border-gold-500/10">
                            <button
                              onClick={() => toggleTraveller(board.board_number)}
                              className="flex items-center gap-1.5 text-xs text-gold-300 hover:text-gold-200 transition-colors"
                            >
                              <BarChart3 size={13} />
                              {travOpen === board.board_number ? 'Hide traveller' : 'View traveller'}
                            </button>

                            {travOpen === board.board_number && (
                              <div className="mt-2.5">
                                {travLoading && !travData ? (
                                  <div className="py-3 flex justify-center">
                                    <Loader2 size={16} className="animate-spin text-gold-400" />
                                  </div>
                                ) : travError ? (
                                  <p className="text-xs text-red-400 py-1.5">{travError}</p>
                                ) : travData ? (
                                  <TravellerTable data={travData} myPair={player?.pairNumber} />
                                ) : null}
                              </div>
                            )}
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

// ── Live board traveller table (player-facing) ──────────────────
function travContract(r) {
  if (r.level == null) return '—';
  if (r.level === 0)   return 'Passed';
  const dbl = r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : '';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function TravellerTable({ data, myPair }) {
  const rows = data?.results ?? [];
  if (!rows.length) {
    return <p className="text-xs text-cream-400/60 py-1.5">No scores entered for this board yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gold-500/15">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-felt-900/60 text-cream-400">
            <th className="px-2 py-1.5 text-left">NS</th>
            <th className="px-2 py-1.5 text-left">EW</th>
            <th className="px-2 py-1.5 text-center">Contract</th>
            <th className="px-2 py-1.5 text-center">Tr</th>
            <th className="px-2 py-1.5 text-right">Score</th>
            <th className="px-2 py-1.5 text-center">NS MP</th>
            <th className="px-2 py-1.5 text-center">EW MP</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gold-500/10">
          {rows.map((r, i) => {
            const mine = r.nsPair === myPair || r.ewPair === myPair;
            const sc   = r.nsScore;
            return (
              <tr key={i} className={mine ? 'bg-gold-400/10' : ''}>
                <td className={`px-2 py-1.5 ${r.nsPair === myPair ? 'text-gold-300 font-semibold' : 'text-cream-200'}`}>
                  {r.nsNames}
                </td>
                <td className={`px-2 py-1.5 ${r.ewPair === myPair ? 'text-gold-300 font-semibold' : 'text-cream-200'}`}>
                  {r.ewNames}
                </td>
                <td className="px-2 py-1.5 text-center font-mono text-cream-200">{travContract(r)}</td>
                <td className="px-2 py-1.5 text-center font-mono text-cream-300">{r.tricks ?? '—'}</td>
                <td className={`px-2 py-1.5 text-right font-mono font-bold
                  ${sc > 0 ? 'text-green-400' : sc < 0 ? 'text-red-400' : 'text-cream-400'}`}>
                  {sc != null ? (sc > 0 ? `+${sc}` : sc) : '—'}
                </td>
                <td className="px-2 py-1.5 text-center font-mono text-cream-300">{r.nsMP ?? '—'}</td>
                <td className="px-2 py-1.5 text-center font-mono text-cream-300">{r.ewMP ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-2 py-1.5 text-[11px] text-cream-400/60 bg-felt-900/40">
        {data.playedCount} {data.playedCount === 1 ? 'result' : 'results'} so far · updates live · your row highlighted
      </div>
    </div>
  );
}
