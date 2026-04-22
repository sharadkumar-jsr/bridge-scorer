import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

// Vulnerability cycle
const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function getVuln(b) { return VUL_CYCLE[(b - 1) % 16]; }

function vulLabel(boardNum) {
  const v = getVuln(boardNum);
  if (v === 'none')  return { text: 'None', cls: 'text-cream-400' };
  if (v === 'ns')    return { text: 'NS Vul', cls: 'text-red-400' };
  if (v === 'ew')    return { text: 'EW Vul', cls: 'text-red-400' };
  if (v === 'both')  return { text: 'Both Vul', cls: 'text-red-400' };
}

function contractStr(r) {
  if (!r || r.level == null) return '—';
  if (r.level === 0) return 'Passed Out';
  const dbl = r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : '';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function pairLabel(r, pairNum) {
  const p = [r[`p${pairNum}_name1`], r[`p${pairNum}_name2`]].filter(Boolean).join('/');
  return p || `Pair ${r[`pair${pairNum}`]}`;
}

// Calculate matchpoints for a set of results on one board
function calcMP(results) {
  const played = results.filter(r => !r.is_bye && r.ns_score != null);
  const n      = played.length;
  const maxMP  = Math.max(0, (n - 1) * 2);
  const avgMP  = maxMP / 2;

  const out = {};
  for (const r of played) {
    let nsMP = 0, ewMP = 0;
    for (const other of played) {
      if (other === r) continue;
      if      (r.ns_score > other.ns_score) nsMP += 2;
      else if (r.ns_score === other.ns_score) { nsMP += 1; ewMP += 1; }
      if      (r.ns_score < other.ns_score) ewMP += 2;
    }
    out[`${r.ns_pair}-${r.ew_pair}`] = { nsMP, ewMP, maxMP };
  }

  // Bye pairs get average
  for (const r of results.filter(r => r.is_bye)) {
    out[`${r.ns_pair}-${r.ew_pair}`] = { nsMP: avgMP, ewMP: avgMP, maxMP, isBye: true };
  }

  return out;
}

export default function TravellerPage() {
  const { token }               = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                     = useNavigate();

  const [boards,   setBoards]   = useState([]);   // all board results grouped by board number
  const [pairs,    setPairs]    = useState({});    // pairNum → names
  const [session,  setSession]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [openBoard, setOpenBoard] = useState(null);

  useEffect(() => {
    if (!player) { nav(`/play/${token}`, { replace: true }); return; }
    loadAll();
  }, [player]);

  const loadAll = async () => {
    try {
      // We need all board results — use the myresults endpoint won't work
      // Instead we fetch standings (which triggers full score calc) and
      // get the full board data via a dedicated call
      const [sessRes, pairsRes] = await Promise.all([
        fetch(`/api/play/${token}`),
        playerFetch(`/api/play/${token}/traveller`),
      ]);
      const sessData   = await sessRes.json();
      const travelData = await pairsRes.json();

      if (!pairsRes.ok) throw new Error(travelData.error ?? 'Could not load board data');

      setSession(sessData);

      // Build pair name lookup
      const pairLookup = {};
      (travelData.pairs ?? []).forEach(p => { pairLookup[p.pair_number] = p; });
      setPairs(pairLookup);
      setBoards(travelData.boards ?? []);

      // Open first board by default
      if (travelData.boards?.length) setOpenBoard(travelData.boards[0].boardNumber);

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  function getPairName(num) {
    const p = pairs[num];
    if (!p) return `Pair ${num}`;
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    return names.length ? names.join(' / ') : `Pair ${num}`;
  }

  const handlePrint = () => window.print();

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-show { display: block !important; }
          body { background: white !important; color: black !important; font-family: sans-serif; }
          .traveller-board { page-break-inside: avoid; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; }
          .traveller-board-header { background: #0b2a1a; color: #c9a03c; padding: 8px 12px; display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; }
          .traveller-table { width: 100%; border-collapse: collapse; font-size: 11px; }
          .traveller-table th { background: #f0f0e8; color: #333; padding: 5px 8px; text-align: center; border-bottom: 1px solid #ccc; }
          .traveller-table td { padding: 4px 8px; text-align: center; border-bottom: 1px solid #eee; }
          .traveller-table tr:last-child td { border-bottom: none; }
          .my-row td { background: #fff8e6 !important; font-weight: bold; }
          .print-title { text-align: center; margin-bottom: 16px; }
          .score-pos { color: #1a7a3a; }
          .score-neg { color: #cc3333; }
        }
        @media screen { .print-show { display: none; } }
      `}</style>

      <div className="min-h-screen bg-felt-gradient">
        {/* Navbar */}
        <header className="no-print border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(`/play/${token}/results`)}
              className="text-cream-400 hover:text-gold-300">
              <ArrowLeft size={20} />
            </button>
            <span className="font-display text-gold-300 text-base flex-1 truncate">
              Board Travellers — {session?.name}
            </span>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <Printer size={14} /> Print
            </button>
          </div>
        </header>

        {/* Print header */}
        <div className="print-show print-title" style={{padding:'16px'}}>
          <h1 style={{fontSize:'18px', margin:0}}>♠ ♥ ♦ ♣ Bridge Club Scorer — Board Travellers</h1>
          <p style={{fontSize:'13px', color:'#666', margin:'4px 0 0'}}>
            {session?.name} · {session?.date}
          </p>
        </div>

        {error && (
          <div className="no-print max-w-2xl mx-auto px-4 py-4">
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          </div>
        )}

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">
          {boards.map(board => {
            const mpMap   = calcMP(board.results);
            const vul     = vulLabel(board.boardNumber);
            const isOpen  = openBoard === board.boardNumber;
            const myResult = board.results.find(r =>
              r.ns_pair === player?.pairNumber || r.ew_pair === player?.pairNumber
            );

            return (
              <div key={board.boardNumber}
                className="traveller-board card-felt relative overflow-hidden">

                {/* Board header — screen */}
                <button
                  onClick={() => setOpenBoard(isOpen ? null : board.boardNumber)}
                  className="no-print w-full flex items-center justify-between px-5 py-3
                             hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gold-400/10 border border-gold-400/30
                                    flex items-center justify-center font-display text-gold-300 text-lg">
                      {board.boardNumber}
                    </div>
                    <div className="text-left">
                      <div className="text-cream-100 text-sm font-semibold">Board {board.boardNumber}</div>
                      <div className={`text-xs ${vul.cls}`}>{vul.text}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {myResult && (
                      <div className="text-xs text-gold-400">
                        {myResult.ns_pair === player?.pairNumber ? 'NS' : 'EW'} ·
                        {myResult.entered_at
                          ? ` ${contractStr(myResult)}`
                          : ' not entered'}
                      </div>
                    )}
                    {isOpen
                      ? <ChevronUp size={16} className="text-cream-400" />
                      : <ChevronDown size={16} className="text-cream-400" />}
                  </div>
                </button>

                {/* Board header — print */}
                <div className="traveller-board-header print-show">
                  <span>Board {board.boardNumber}</span>
                  <span>{vul.text}</span>
                </div>

                {/* Results table */}
                {(isOpen || true) && (
                  <div className={isOpen ? '' : 'no-print'}>
                    <table className="traveller-table w-full text-xs">
                      <thead>
                        <tr className="no-print border-t border-gold-500/20 bg-felt-900/40">
                          <th className="px-3 py-2 text-left text-cream-400 font-medium">NS Pair</th>
                          <th className="px-3 py-2 text-left text-cream-400 font-medium">EW Pair</th>
                          <th className="px-3 py-2 text-center text-cream-400 font-medium">Contract</th>
                          <th className="px-3 py-2 text-center text-cream-400 font-medium">Tricks</th>
                          <th className="px-3 py-2 text-right text-cream-400 font-medium">NS Score</th>
                          <th className="px-3 py-2 text-center text-cream-400 font-medium">NS MP</th>
                          <th className="px-3 py-2 text-center text-cream-400 font-medium">EW MP</th>
                        </tr>
                        <tr className="print-show">
                          <th>NS Pair</th>
                          <th>EW Pair</th>
                          <th>Contract</th>
                          <th>Tricks</th>
                          <th>NS Score</th>
                          <th>NS MP</th>
                          <th>EW MP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {board.results
                          .sort((a, b) => (b.ns_score ?? -9999) - (a.ns_score ?? -9999))
                          .map(r => {
                            const key  = `${r.ns_pair}-${r.ew_pair}`;
                            const mp   = mpMap[key];
                            const isMe = r.ns_pair === player?.pairNumber || r.ew_pair === player?.pairNumber;
                            const score = r.ns_score;

                            if (r.is_bye) {
                              return (
                                <tr key={key} className={isMe ? 'my-row' : ''}>
                                  <td className="no-print px-3 py-2 text-left text-cream-300">
                                    {getPairName(r.ns_pair)}{isMe && r.ns_pair===player?.pairNumber ? ' ◀' : ''}
                                  </td>
                                  <td className="no-print px-3 py-2 text-left text-cream-300">
                                    {getPairName(r.ew_pair)}{isMe && r.ew_pair===player?.pairNumber ? ' ◀' : ''}
                                  </td>
                                  <td className="print-show">{getPairName(r.ns_pair)}</td>
                                  <td className="print-show">{getPairName(r.ew_pair)}</td>
                                  <td colSpan="3" className="px-3 py-2 text-center text-amber-400">
                                    BYE — Average score awarded
                                  </td>
                                </tr>
                              );
                            }

                            return (
                              <tr key={key}
                                className={`${isMe ? 'my-row bg-gold-400/10' : ''} no-print border-t border-gold-500/10`}>
                                <td className="no-print px-3 py-2 text-left text-cream-200">
                                  <span className={r.ns_pair===player?.pairNumber?'text-gold-300 font-semibold':''}>
                                    {getPairName(r.ns_pair)}
                                    {r.ns_pair===player?.pairNumber?' ◀':''}
                                  </span>
                                </td>
                                <td className="no-print px-3 py-2 text-left text-cream-200">
                                  <span className={r.ew_pair===player?.pairNumber?'text-gold-300 font-semibold':''}>
                                    {getPairName(r.ew_pair)}
                                    {r.ew_pair===player?.pairNumber?' ◀':''}
                                  </span>
                                </td>
                                <td className="print-show">{getPairName(r.ns_pair)}</td>
                                <td className="print-show">{getPairName(r.ew_pair)}</td>
                                <td className="px-3 py-2 text-center font-mono text-cream-200">
                                  {r.entered_at ? contractStr(r) : <span className="text-cream-400/50">—</span>}
                                </td>
                                <td className="px-3 py-2 text-center font-mono text-cream-300">
                                  {r.tricks ?? '—'}
                                </td>
                                <td className={`px-3 py-2 text-right font-mono font-semibold
                                  ${score > 0 ? 'text-green-400 score-pos' : score < 0 ? 'text-red-400 score-neg' : 'text-cream-400'}`}>
                                  {score != null ? (score > 0 ? `+${score}` : score) : '—'}
                                </td>
                                <td className={`px-3 py-2 text-center font-mono font-bold
                                  ${mp?.nsMP >= mp?.maxMP * 0.6 ? 'text-green-400' : mp?.nsMP < mp?.maxMP * 0.4 ? 'text-red-400' : 'text-cream-300'}`}>
                                  {mp?.nsMP ?? '—'}
                                </td>
                                <td className={`px-3 py-2 text-center font-mono font-bold
                                  ${mp?.ewMP >= mp?.maxMP * 0.6 ? 'text-green-400' : mp?.ewMP < mp?.maxMP * 0.4 ? 'text-red-400' : 'text-cream-300'}`}>
                                  {mp?.ewMP ?? '—'}
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

          <button onClick={handlePrint}
            className="no-print btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16} /> Print Board Travellers / Save as PDF
          </button>
        </main>
      </div>
    </>
  );
}
