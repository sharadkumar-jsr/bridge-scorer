import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function getVuln(b) { return VUL_CYCLE[(b - 1) % 16]; }
function vulText(b) {
  const v = getVuln(b);
  if (v === 'none') return 'None Vul';
  if (v === 'ns')   return 'NS Vul';
  if (v === 'ew')   return 'EW Vul';
  return 'Both Vul';
}

function contractStr(r) {
  if (!r || r.level == null) return '—';
  if (r.level === 0) return 'Passed';
  const dbl = r.doubled === 'doubled' ? 'X' : r.doubled === 'redoubled' ? 'XX' : '';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function calcMP(results) {
  const played = results.filter(r => !r.is_bye && r.ns_score != null);
  const n      = played.length;
  const maxMP  = Math.max(0, (n - 1) * 2);
  const avgMP  = maxMP / 2;
  const out    = {};
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
  for (const r of results.filter(r => r.is_bye)) {
    out[`${r.ns_pair}-${r.ew_pair}`] = { nsMP: avgMP, ewMP: avgMP, maxMP, isBye: true };
  }
  return out;
}

export default function TravellerPage() {
  const { token }               = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                     = useNavigate();

  const [boards,    setBoards]    = useState([]);
  const [pairs,     setPairs]     = useState({});
  const [session,   setSession]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [openBoard, setOpenBoard] = useState(null);

  useEffect(() => {
    if (!player) { nav(`/play/${token}`, { replace: true }); return; }
    loadAll();
  }, [player]);

  const loadAll = async () => {
    try {
      const [sessRes, travRes] = await Promise.all([
        fetch(`/api/play/${token}`),
        playerFetch(`/api/play/${token}/traveller`),
      ]);
      const sessData = await sessRes.json();
      const travData = await travRes.json();
      if (!travRes.ok) throw new Error(travData.error ?? 'Could not load board data');
      setSession(sessData);
      const pairLookup = {};
      (travData.pairs ?? []).forEach(p => { pairLookup[p.pair_number] = p; });
      setPairs(pairLookup);
      setBoards(travData.boards ?? []);
      if (travData.boards?.length) setOpenBoard(travData.boards[0].boardNumber);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  function getPairName(num) {
    const p = pairs[num];
    if (!p) return `P${num}`;
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    // Shorten for mobile: "Sharma / Patel" → "Sharma/Patel", truncate at 12 chars
    const full = names.length ? names.join('/') : `Pair ${num}`;
    return full.length > 14 ? full.substring(0, 13) + '…' : full;
  }

  function getPairNameFull(num) {
    const p = pairs[num];
    if (!p) return `Pair ${num}`;
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    return names.length ? names.join(' / ') : `Pair ${num}`;
  }

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <>
      {/* ── CRITICAL: Print styles override EVERYTHING ───────────────── */}
      <style>{`
        @media print {
          /* Force white background on everything */
          * {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Hide the screen navigation */
          .t-navbar { display: none !important; }
          /* Show all board results even if collapsed on screen */
          .t-board-body { display: block !important; }
          /* Board styling for print */
          .t-board {
            border: 1px solid #999 !important;
            margin-bottom: 12px !important;
            page-break-inside: avoid !important;
            border-radius: 4px !important;
            overflow: hidden !important;
          }
          .t-board-header {
            background: #0b2a1a !important;
            color: #c9a03c !important;
            padding: 5px 10px !important;
            display: flex !important;
            justify-content: space-between !important;
            font-size: 11px !important;
            font-weight: bold !important;
          }
          /* Table styling */
          .t-table { width: 100% !important; border-collapse: collapse !important; font-size: 10px !important; }
          .t-th { background: #e8e8e0 !important; color: #333 !important; padding: 3px 6px !important; border-bottom: 1px solid #bbb !important; font-weight: bold !important; }
          .t-td { padding: 3px 6px !important; border-bottom: 1px solid #eee !important; color: black !important; }
          .t-td-pos { color: #1a7a3a !important; font-weight: bold !important; }
          .t-td-neg { color: #cc3333 !important; font-weight: bold !important; }
          .t-my { background: #fff8e0 !important; }
          /* Print header */
          .t-print-header { display: block !important; text-align: center; margin-bottom: 14px; border-bottom: 2px solid #0b2a1a; padding-bottom: 10px; }
          .t-print-header h1 { font-size: 18px; color: #0b2a1a !important; margin: 0 0 3px; }
          .t-print-header p  { font-size: 11px; color: #555 !important; margin: 0; }
          /* Hide screen-only elements */
          .t-screen-btn { display: none !important; }
          .t-chevron    { display: none !important; }
          .t-count      { display: none !important; }
          /* Footer */
          .t-footer { display: block !important; text-align: center; font-size: 9px; color: #888 !important; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 6px; }
        }
        @media screen {
          .t-print-header { display: none; }
          .t-footer { display: none; }
          .t-board-header { background: #071a10; }
        }
      `}</style>

      {/* ── Print header (hidden on screen) ──────────────────────────── */}
      <div className="t-print-header">
        <h1>♠ ♥ ♦ ♣ Bridge Club Scorer — Board Travellers</h1>
        <p>{session?.name} · {session?.date} · {session?.tables_count} tables · {session?.num_boards} boards</p>
      </div>

      {/* ── Screen navbar ─────────────────────────────────────────────── */}
      <header className="t-navbar border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => nav(`/play/${token}/results`)}
            className="text-cream-400 hover:text-gold-300">
            <ArrowLeft size={20} />
          </button>
          <span className="font-display text-gold-300 text-base flex-1 truncate">
            Travellers — {session?.name}
          </span>
          <button onClick={() => window.print()}
            className="t-screen-btn flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
            <Printer size={14} /> Print
          </button>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="min-h-screen bg-felt-gradient">
        <main className="max-w-2xl mx-auto px-3 py-4 space-y-2">

          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {boards.map(board => {
            const mpMap  = calcMP(board.results);
            const isOpen = openBoard === board.boardNumber;
            const played = board.results.filter(r => !r.is_bye && r.entered_at);
            const byes   = board.results.filter(r => r.is_bye);
            const sorted = [...played].sort((a,b)=>(b.ns_score??-9999)-(a.ns_score??-9999));

            return (
              <div key={board.boardNumber} className="t-board rounded-xl overflow-hidden border border-gold-500/20">

                {/* Board header */}
                <button
                  onClick={() => setOpenBoard(isOpen ? null : board.boardNumber)}
                  className="t-board-header w-full flex items-center justify-between px-4 py-2.5 hover:opacity-90 transition-opacity"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gold-300 font-display text-base">Board {board.boardNumber}</span>
                    <span className="text-xs text-gold-500/70">{vulText(board.boardNumber)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="t-count text-xs text-gold-500/60">{played.length} results</span>
                    <span className="t-chevron text-gold-400">
                      {isOpen ? <ChevronUp size={15}/> : <ChevronDown size={15}/>}
                    </span>
                  </div>
                </button>

                {/* Results — shown when open on screen, always shown in print */}
                <div className={`t-board-body ${isOpen ? '' : 'hidden'}`}>
                  <table className="t-table w-full">
                    <thead>
                      <tr>
                        {/* Compact mobile headers */}
                        <th className="t-th text-left px-2 py-1.5">NS</th>
                        <th className="t-th text-left px-2 py-1.5">EW</th>
                        <th className="t-th text-center px-2 py-1.5">Contract</th>
                        <th className="t-th text-center px-1 py-1.5">Tr</th>
                        <th className="t-th text-right px-2 py-1.5">Score</th>
                        <th className="t-th text-center px-1 py-1.5">NMP</th>
                        <th className="t-th text-center px-1 py-1.5">EMP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {played.length === 0 && byes.length === 0 && (
                        <tr>
                          <td colSpan="7" className="t-td text-center text-cream-400/50 py-2 text-xs">
                            No results entered
                          </td>
                        </tr>
                      )}
                      {sorted.map(r => {
                        const key  = `${r.ns_pair}-${r.ew_pair}`;
                        const mp   = mpMap[key];
                        const isMe = r.ns_pair===player?.pairNumber || r.ew_pair===player?.pairNumber;
                        const score = r.ns_score;
                        return (
                          <tr key={key} className={isMe ? 't-my bg-gold-400/10' : 'border-t border-gold-500/10'}>
                            <td className="t-td px-2 py-1.5">
                              <span className={`text-xs ${r.ns_pair===player?.pairNumber?'text-gold-300 font-bold':'text-cream-200'}`}>
                                {getPairName(r.ns_pair)}{r.ns_pair===player?.pairNumber?' ◀':''}
                              </span>
                            </td>
                            <td className="t-td px-2 py-1.5">
                              <span className={`text-xs ${r.ew_pair===player?.pairNumber?'text-gold-300 font-bold':'text-cream-200'}`}>
                                {getPairName(r.ew_pair)}{r.ew_pair===player?.pairNumber?' ◀':''}
                              </span>
                            </td>
                            <td className="t-td px-2 py-1.5 text-center font-mono text-xs text-cream-200">
                              {contractStr(r)}
                            </td>
                            <td className="t-td px-1 py-1.5 text-center font-mono text-xs text-cream-300">
                              {r.tricks??'—'}
                            </td>
                            <td className={`t-td px-2 py-1.5 text-right font-mono text-xs font-bold
                              ${score>0?'text-green-400 t-td-pos':score<0?'text-red-400 t-td-neg':'text-cream-400'}`}>
                              {score!=null?(score>0?`+${score}`:score):'—'}
                            </td>
                            <td className={`t-td px-1 py-1.5 text-center font-mono text-xs font-bold
                              ${mp?.nsMP!=null&&mp.nsMP>=mp.maxMP*0.6?'text-green-400'
                                :mp?.nsMP!=null&&mp.nsMP<mp.maxMP*0.4?'text-red-400':'text-cream-300'}`}>
                              {mp?.nsMP??'—'}
                            </td>
                            <td className={`t-td px-1 py-1.5 text-center font-mono text-xs font-bold
                              ${mp?.ewMP!=null&&mp.ewMP>=mp.maxMP*0.6?'text-green-400'
                                :mp?.ewMP!=null&&mp.ewMP<mp.maxMP*0.4?'text-red-400':'text-cream-300'}`}>
                              {mp?.ewMP??'—'}
                            </td>
                          </tr>
                        );
                      })}
                      {byes.map(r => {
                        const isMe = r.ns_pair===player?.pairNumber || r.ew_pair===player?.pairNumber;
                        return (
                          <tr key={`${r.ns_pair}-${r.ew_pair}`}
                            className={`border-t border-gold-500/10 ${isMe?'bg-gold-400/10':''}`}>
                            <td className="t-td px-2 py-1.5 text-xs text-cream-400/60">{getPairName(r.ns_pair)}</td>
                            <td className="t-td px-2 py-1.5 text-xs text-cream-400/60">{getPairName(r.ew_pair)}</td>
                            <td colSpan="5" className="t-td px-2 py-1.5 text-center text-xs text-amber-400/70">
                              BYE — Avg score
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Print button */}
          <button onClick={() => window.print()}
            className="t-screen-btn btn-ghost w-full flex items-center justify-center gap-2 py-3 mt-2">
            <Printer size={16} /> Print Travellers / Save as PDF
          </button>
          <p className="t-screen-btn text-center text-cream-400/50 text-xs pb-4">
            Tap Print → "Save as PDF" in your browser print dialog
          </p>
        </main>
      </div>

      {/* Footer for print */}
      <div className="t-footer">
        Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
      </div>
    </>
  );
}
