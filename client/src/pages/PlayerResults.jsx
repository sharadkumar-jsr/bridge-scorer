import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, ClipboardList } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function PlayerResults() {
  const { token }               = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                     = useNavigate();

  const [standings, setStandings] = useState([]);
  const [myResults, setMyResults] = useState([]);
  const [session,   setSession]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('standings');

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

  const handlePrint = () => window.print();

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
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; color: black !important; }
          .print-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .print-table th { background: #0b2a1a; color: #c9a03c; padding: 6px 8px; text-align: left; }
          .print-table td { padding: 5px 8px; border-bottom: 1px solid #ddd; }
          .print-table tr:nth-child(even) td { background: #f5f5f0; }
          .my-row td { background: #fff8e6 !important; font-weight: bold; }
          .print-header { text-align: center; margin-bottom: 20px; }
          .print-section { margin-bottom: 24px; }
          .print-section h2 { font-size: 15px; color: #0b2a1a; border-bottom: 2px solid #c9a03c; padding-bottom: 4px; margin-bottom: 8px; }
          .score-pos { color: #1a7a3a; }
          .score-neg { color: #cc3333; }
        }
        @media screen { .print-only { display: none; } }
      `}</style>

      <div className="min-h-screen bg-felt-gradient">
        {/* Navbar */}
        <header className="no-print border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(`/play/${token}/score`)}
              className="text-cream-400 hover:text-gold-300">
              <ArrowLeft size={20} />
            </button>
            <span className="font-display text-gold-300 text-base flex-1 truncate">
              {session?.name} — Results
            </span>
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <Printer size={14} /> Print
            </button>
          </div>
        </header>

        {/* Print version */}
        <div className="print-only" style={{padding:'20px'}}>
          <div className="print-header">
            <h1 style={{fontSize:'18px',margin:0}}>♠ ♥ ♦ ♣ Bridge Club Scorer</h1>
            <p style={{fontSize:'13px',color:'#666',margin:'4px 0 0'}}>
              {session?.name} · {session?.date} · {session?.tables_count} tables · {session?.num_boards} boards
            </p>
          </div>
          <div className="print-section">
            <h2>Final Standings</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Rank</th><th>Pair</th><th>Players</th>
                  <th style={{textAlign:'right'}}>MP</th>
                  <th style={{textAlign:'right'}}>Max MP</th>
                  <th style={{textAlign:'right'}}>%</th>
                </tr>
              </thead>
              <tbody>
                {standings.map(row => (
                  <tr key={row.pairNumber}
                    className={row.pairNumber===player?.pairNumber?'my-row':''}>
                    <td>{row.rank<=3?['🥇','🥈','🥉'][row.rank-1]:row.rank}</td>
                    <td>{row.pairNumber}</td>
                    <td>{pairName(row)}{row.pairNumber===player?.pairNumber?' ◀ You':''}</td>
                    <td style={{textAlign:'right'}}>{row.totalMP}</td>
                    <td style={{textAlign:'right'}}>{row.maxMP}</td>
                    <td style={{textAlign:'right',fontWeight:'bold'}}>{row.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="print-section">
            <h2>My Board Results — Pair {player?.pairNumber}</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Board</th><th>Side</th><th>Contract</th>
                  <th style={{textAlign:'right'}}>Score</th>
                  <th style={{textAlign:'right'}}>MP</th>
                </tr>
              </thead>
              <tbody>
                {myResults.filter(r=>!r.is_bye).map(r => {
                  const contract = r.level!=null
                    ? `${r.declarer}${r.level}${r.suit}${r.doubled==='doubled'?'X':r.doubled==='redoubled'?'XX':''}=${r.tricks}`
                    : '—';
                  const score = r.ns_score!=null?(r.side==='NS'?r.ns_score:-r.ns_score):null;
                  return (
                    <tr key={r.board_number}>
                      <td>{r.board_number}</td>
                      <td>{r.side}</td>
                      <td>{contract}</td>
                      <td style={{textAlign:'right',fontWeight:'bold',
                        color:score>0?'#1a7a3a':score<0?'#cc3333':'#555'}}>
                        {score!=null?(score>0?`+${score}`:score):'—'}
                      </td>
                      <td style={{textAlign:'right'}}>
                        {r.mp!=null?`${r.mp}/${r.maxMp}`:'—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p style={{textAlign:'center',fontSize:'11px',color:'#888',marginTop:'20px'}}>
            Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Screen version */}
        <main className="no-print max-w-lg mx-auto px-4 py-6 space-y-4">

          {myStanding && (
            <div className="card-felt relative p-5">
              <div className="text-xs text-cream-400 uppercase tracking-widest mb-1">Your Result</div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-display text-2xl text-cream-100">
                    {MEDAL[myStanding.rank] ?? `#${myStanding.rank}`}
                    {myStanding.rank > 3 ? ` Rank ${myStanding.rank}` : ''}
                  </div>
                  <div className="text-cream-400 text-sm mt-0.5">
                    Pair {myStanding.pairNumber} · {myStanding.totalMP}/{myStanding.maxMP} MP
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
            {['standings','myboards'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all
                  ${tab===t
                    ?'bg-gold-400 border-gold-400 text-felt-950'
                    :'border-gold-500/30 text-cream-300 hover:border-gold-400/50'}`}>
                {t==='standings'?'🏆 All Standings':'📋 My Boards'}
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {tab==='standings' && (
            <div className="card-felt relative overflow-hidden">
              <div className="grid grid-cols-[44px_1fr_56px_60px] px-4 py-3
                              border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
                <div>Rank</div><div>Pair</div>
                <div className="text-right">MP</div><div className="text-right">%</div>
              </div>
              <div className="divide-y divide-gold-500/10">
                {standings.map((row,i) => (
                  <div key={row.pairNumber}
                    className={`grid grid-cols-[44px_1fr_56px_60px] px-4 py-3 items-center
                      ${row.pairNumber===player?.pairNumber?'bg-gold-400/10':''}
                      ${i===0?'bg-gold-400/5':''}`}>
                    <div>{row.rank<=3
                      ?<span className="text-lg">{MEDAL[row.rank]}</span>
                      :<span className="font-mono text-cream-400 text-sm">{row.rank}</span>}
                    </div>
                    <div>
                      <div className={`text-sm font-semibold
                        ${row.pairNumber===player?.pairNumber?'text-gold-300':'text-cream-100'}`}>
                        {pairName(row)}
                        {row.pairNumber===player?.pairNumber&&
                          <span className="text-xs text-gold-500 ml-1">◀ You</span>}
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

          {tab==='myboards' && (
            <div className="card-felt relative overflow-hidden">
              <div className="grid grid-cols-[40px_50px_1fr_50px_50px] px-4 py-3
                              border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
                <div>Bd</div><div>Side</div><div>Contract</div>
                <div className="text-right">Score</div><div className="text-right">MP</div>
              </div>
              <div className="divide-y divide-gold-500/10">
                {myResults.filter(r=>!r.is_bye).map((r,i) => {
                  const contract = r.level!=null
                    ?`${r.declarer}${r.level}${r.suit}${r.doubled==='doubled'?'X':r.doubled==='redoubled'?'XX':''}=${r.tricks}`
                    :'—';
                  const score = r.ns_score!=null?(r.side==='NS'?r.ns_score:-r.ns_score):null;
                  return (
                    <div key={r.board_number}
                      className={`grid grid-cols-[40px_50px_1fr_50px_50px] px-4 py-3 items-center
                        ${i%2===0?'bg-felt-800/20':''}`}>
                      <div className="font-mono text-cream-300 text-sm">{r.board_number}</div>
                      <div className={`text-xs font-semibold ${r.side==='NS'?'text-cream-300':'text-gold-400'}`}>
                        {r.side}
                      </div>
                      <div className="font-mono text-sm text-cream-200">{contract}</div>
                      <div className={`text-right font-mono text-sm
                        ${score>0?'text-green-400':score<0?'text-red-400':'text-cream-400'}`}>
                        {score!=null?(score>0?`+${score}`:score):'—'}
                      </div>
                      <div className={`text-right font-mono text-sm
                        ${r.mp!=null&&r.mp>=r.maxMp*0.6?'text-green-400'
                          :r.mp!=null&&r.mp<r.maxMp*0.4?'text-red-400':'text-cream-300'}`}>
                        {r.mp!=null?`${r.mp}/${r.maxMp}`:'—'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Board Travellers link */}
          <button
            onClick={() => nav(`/play/${token}/traveller`)}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <ClipboardList size={16} />
            View Board Travellers (all pairs per board)
          </button>

          <button onClick={handlePrint}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16} /> Print Results / Save as PDF
          </button>

          <p className="text-center text-cream-400/50 text-xs">
            Tap Print → choose "Save as PDF" in your browser print dialog
          </p>
        </main>
      </div>
    </>
  );
}
