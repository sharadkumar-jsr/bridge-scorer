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

  // Build inline styles for print table rows to avoid CSS specificity issues
  const thStyle = {
    background: '#0b2a1a',
    color: '#c9a03c',
    padding: '6px 10px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 'bold',
    borderBottom: '1px solid #555',
  };
  const tdStyle = {
    background: 'white',
    color: 'black',
    padding: '5px 10px',
    fontSize: '11px',
    borderBottom: '1px solid #ddd',
  };
  const tdAltStyle = {
    ...tdStyle,
    background: '#f8f8f2',
  };
  const tdMyStyle = {
    ...tdStyle,
    background: '#fff8e0',
    fontWeight: 'bold',
  };

  return (
    <>
      <style>{`
        @media print {
          /* Nuclear option — override everything with white */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body, html {
            background: white !important;
            color: black !important;
          }
          /* Hide all screen UI */
          .pr-navbar  { display: none !important; }
          .pr-screen  { display: none !important; }
          /* Show print content */
          .pr-print   { display: block !important; }
          .pr-footer  { display: block !important; }
        }
        @media screen {
          .pr-print  { display: none; }
          .pr-footer { display: none; }
        }
      `}</style>

      {/* ── PRINT VERSION ───────────────────────────────────────────── */}
      <div className="pr-print" style={{padding: '20px', fontFamily: 'Arial, sans-serif', background: 'white', color: 'black'}}>

        {/* Header */}
        <div style={{textAlign:'center', marginBottom:'16px', borderBottom:'3px solid #0b2a1a', paddingBottom:'12px'}}>
          <h1 style={{fontSize:'20px', color:'#0b2a1a', margin:'0 0 4px'}}>♠ ♥ ♦ ♣ Bridge Club Scorer</h1>
          <p style={{fontSize:'12px', color:'#555', margin:0}}>
            {session?.name} · {session?.date} · {session?.tables_count} tables · {session?.num_boards} boards
          </p>
        </div>

        {/* Standings */}
        <div style={{marginBottom:'24px'}}>
          <h2 style={{fontSize:'15px', color:'#0b2a1a', borderBottom:'2px solid #c9a03c', paddingBottom:'4px', marginBottom:'8px'}}>
            Final Standings
          </h2>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
            <thead>
              <tr>
                <th style={thStyle}>Rank</th>
                <th style={thStyle}>Pair #</th>
                <th style={thStyle}>Players</th>
                <th style={{...thStyle, textAlign:'right'}}>MP</th>
                <th style={{...thStyle, textAlign:'right'}}>Max MP</th>
                <th style={{...thStyle, textAlign:'right'}}>%</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const isMe = row.pairNumber === player?.pairNumber;
                const td   = isMe ? tdMyStyle : i % 2 === 0 ? tdStyle : tdAltStyle;
                const pct  = parseFloat(row.percentage);
                const pctColor = pct >= 60 ? '#1a7a3a' : pct < 45 ? '#cc3333' : '#000';
                return (
                  <tr key={row.pairNumber}>
                    <td style={td}>{row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : row.rank}</td>
                    <td style={td}>{row.pairNumber}</td>
                    <td style={td}>{pairName(row)}{isMe ? ' ◀ You' : ''}</td>
                    <td style={{...td, textAlign:'right'}}>{row.totalMP}</td>
                    <td style={{...td, textAlign:'right'}}>{row.maxMP}</td>
                    <td style={{...td, textAlign:'right', fontWeight:'bold', color:pctColor}}>
                      {row.percentage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* My boards */}
        <div>
          <h2 style={{fontSize:'15px', color:'#0b2a1a', borderBottom:'2px solid #c9a03c', paddingBottom:'4px', marginBottom:'8px'}}>
            My Board Results — Pair {player?.pairNumber}
          </h2>
          <table style={{width:'100%', borderCollapse:'collapse', fontSize:'11px'}}>
            <thead>
              <tr>
                <th style={thStyle}>Board</th>
                <th style={thStyle}>Rnd</th>
                <th style={thStyle}>Side</th>
                <th style={thStyle}>Contract</th>
                <th style={{...thStyle, textAlign:'right'}}>Score</th>
                <th style={{...thStyle, textAlign:'right'}}>MP</th>
              </tr>
            </thead>
            <tbody>
              {myResults.filter(r => !r.is_bye).map((r, i) => {
                const contract = r.level != null
                  ? `${r.declarer}${r.level}${r.suit}${r.doubled==='doubled'?'X':r.doubled==='redoubled'?'XX':''}=${r.tricks}`
                  : '—';
                const score = r.ns_score != null
                  ? (r.side === 'NS' ? r.ns_score : -r.ns_score)
                  : null;
                const td = i % 2 === 0 ? tdStyle : tdAltStyle;
                const scoreColor = score > 0 ? '#1a7a3a' : score < 0 ? '#cc3333' : '#555';
                return (
                  <tr key={r.board_number}>
                    <td style={td}>{r.board_number}</td>
                    <td style={td}>{r.round}</td>
                    <td style={td}>{r.side}</td>
                    <td style={{...td, fontFamily:'monospace'}}>{contract}</td>
                    <td style={{...td, textAlign:'right', fontWeight:'bold', color:scoreColor}}>
                      {score != null ? (score > 0 ? `+${score}` : score) : '—'}
                    </td>
                    <td style={{...td, textAlign:'right'}}>
                      {r.mp != null ? `${r.mp}/${r.maxMp}` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer for print */}
      <div className="pr-footer" style={{textAlign:'center', fontSize:'10px', color:'#888',
        marginTop:'16px', borderTop:'1px solid #ddd', paddingTop:'8px', fontFamily:'Arial, sans-serif'}}>
        Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
      </div>

      {/* ── SCREEN VERSION ─────────────────────────────────────────── */}
      <div className="pr-screen min-h-screen bg-felt-gradient">
        {/* Navbar */}
        <header className="pr-navbar border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(`/play/${token}/score`)}
              className="text-cream-400 hover:text-gold-300">
              <ArrowLeft size={20} />
            </button>
            <span className="font-display text-gold-300 text-base flex-1 truncate">
              {session?.name} — Results
            </span>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <Printer size={14} /> Print
            </button>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">

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

          <div className="flex gap-2">
            {['standings','myboards'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all
                  ${tab===t
                    ?'bg-gold-400 border-gold-400 text-felt-950'
                    :'border-gold-500/30 text-cream-300 hover:border-gold-400/50'}`}>
                {t==='standings' ? '🏆 All Standings' : '📋 My Boards'}
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

          <button onClick={() => nav(`/play/${token}/traveller`)}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <ClipboardList size={16} /> View Board Travellers
          </button>

          <button onClick={() => nav(`/play/${token}/pair-results`)}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <ClipboardList size={16} /> View Pair-wise Results
          </button>

          <button onClick={() => window.print()}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16} /> Print Results / Save as PDF
          </button>

          <p className="text-center text-cream-400/50 text-xs pb-4">
            Tap Print → "Save as PDF" in your browser print dialog
          </p>
        </main>
      </div>
    </>
  );
}
