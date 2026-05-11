import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

// Vulnerability cycle
const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function vulLabel(b) {
  const v = VUL_CYCLE[(b-1)%16];
  if (v==='none') return 'NV'; if (v==='ns') return 'NS'; if (v==='ew') return 'EW'; return 'Both';
}

function contractStr(r) {
  if (!r || r.level == null) return '—';
  if (r.level === 0) return 'Passed';
  const dbl = r.doubled==='doubled'?'X':r.doubled==='redoubled'?'XX':'';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function calcBoardMP(results) {
  const played = results.filter(r => !r.is_bye && r.ns_score != null);
  const n = played.length;
  const maxMP = Math.max(0,(n-1)*2);
  const avgMP = maxMP/2;
  const out = {};
  for (const r of played) {
    let nsMP=0, ewMP=0;
    for (const o of played) {
      if(o===r) continue;
      if(r.ns_score>o.ns_score) nsMP+=2;
      else if(r.ns_score===o.ns_score){nsMP+=1;ewMP+=1;}
      if(r.ns_score<o.ns_score) ewMP+=2;
    }
    out[`${r.ns_pair}-${r.ew_pair}`]={nsMP,ewMP,maxMP};
  }
  for (const r of results.filter(r=>r.is_bye))
    out[`${r.ns_pair}-${r.ew_pair}`]={nsMP:avgMP,ewMP:avgMP,maxMP,isBye:true};
  return out;
}

export default function PairResultsPage() {
  const { token }               = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                     = useNavigate();

  const [data,      setData]      = useState(null);
  const [session,   setSession]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  // Which pair's opponent row is expanded to show board details
  const [expanded,  setExpanded]  = useState({}); // key: `${pair}-${opp}`

  useEffect(() => {
    if (!player) { nav(`/play/${token}`, { replace: true }); return; }
    loadAll();
  }, [player]);

  const loadAll = async () => {
    try {
      const [travRes, standRes, sessRes] = await Promise.all([
        playerFetch(`/api/play/${token}/traveller`),
        playerFetch(`/api/play/${token}/standings`),
        fetch(`/api/play/${token}`),
      ]);
      const [travData, standData, sessData] = await Promise.all([
        travRes.json(), standRes.json(), sessRes.json(),
      ]);
      if (!travRes.ok)  throw new Error(travData.error ?? 'Could not load');
      if (!standRes.ok) throw new Error(standData.error ?? 'Could not load');
      setData({ ...travData, standings: standData });
      setSession(sessData);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center px-4">
      <div className="text-red-400 text-sm">{error || 'No data'}</div>
    </div>
  );

  // ── Lookups ───────────────────────────────────────────────
  const pairName = {};
  (data.pairs ?? []).forEach(p => {
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    pairName[p.pair_number] = names.length ? names.join(' / ') : `Pair ${p.pair_number}`;
  });

  const realPairs = (data.pairs ?? [])
    .filter(p => !p.is_phantom)
    .map(p => p.pair_number)
    .sort((a,b) => a-b);

  const rankMap = {}, pctMap = {};
  for (const s of (data.standings ?? [])) {
    rankMap[s.pairNumber] = s.rank;
    pctMap[s.pairNumber]  = s.percentage;
  }

  // ── Build board MP maps ───────────────────────────────────
  const boardMPMap = {};
  for (const board of (data.boards ?? []))
    boardMPMap[board.boardNumber] = calcBoardMP(board.results);

  // ── Build pairVsPair with individual boards ───────────────
  // pairVsPair[p][opp] = { boards: [{boardNum, side, contract, tricks, score, mp, maxMP}], totals }
  const pairVsPair = {};
  for (const p of realPairs) pairVsPair[p] = {};

  for (const board of (data.boards ?? [])) {
    for (const r of board.results) {
      if (r.is_bye || r.ns_score == null) continue;
      const ns = r.ns_pair, ew = r.ew_pair;
      const key = `${ns}-${ew}`;
      const mp  = boardMPMap[board.boardNumber]?.[key];
      if (!mp) continue;

      // NS pair
      if (!pairVsPair[ns][ew]) pairVsPair[ns][ew] = { boards:[], totalMP:0, maxMP:0, totalScore:0 };
      pairVsPair[ns][ew].boards.push({
        boardNum: board.boardNumber,
        side:     'NS',
        contract: contractStr(r),
        tricks:   r.tricks,
        score:    r.ns_score,
        mp:       mp.nsMP,
        maxMP:    mp.maxMP,
      });
      pairVsPair[ns][ew].totalMP    += mp.nsMP;
      pairVsPair[ns][ew].maxMP      += mp.maxMP;
      pairVsPair[ns][ew].totalScore += r.ns_score;

      // EW pair
      if (!pairVsPair[ew][ns]) pairVsPair[ew][ns] = { boards:[], totalMP:0, maxMP:0, totalScore:0 };
      pairVsPair[ew][ns].boards.push({
        boardNum: board.boardNumber,
        side:     'EW',
        contract: contractStr(r),
        tricks:   r.tricks,
        score:    -r.ns_score,
        mp:       mp.ewMP,
        maxMP:    mp.maxMP,
      });
      pairVsPair[ew][ns].totalMP    += mp.ewMP;
      pairVsPair[ew][ns].maxMP      += mp.maxMP;
      pairVsPair[ew][ns].totalScore += -r.ns_score;
    }
  }

  // Sort boards by board number within each matchup
  for (const p of realPairs)
    for (const opp of Object.keys(pairVsPair[p]))
      pairVsPair[p][opp].boards.sort((a,b) => a.boardNum - b.boardNum);

  const toggleExpand = (p, opp) => {
    const k = `${p}-${opp}`;
    setExpanded(prev => ({ ...prev, [k]: !prev[k] }));
  };

  // ── Print styles ──────────────────────────────────────────
  const thS   = { background:'#0b2a1a', color:'#c9a03c', padding:'4px 7px', fontSize:'10px', fontWeight:'bold', textAlign:'center' };
  const tdS   = { background:'white', color:'black', padding:'3px 7px', fontSize:'10px', borderBottom:'1px solid #eee', textAlign:'center' };
  const tdLS  = { ...tdS, textAlign:'left' };
  const subTh = { background:'#e8e8e0', color:'#333', padding:'3px 7px', fontSize:'9px', fontWeight:'bold', textAlign:'center', borderBottom:'1px solid #ccc' };
  const subTd = { background:'#fafaf5', color:'black', padding:'3px 7px', fontSize:'9px', borderBottom:'1px solid #f0f0e8', textAlign:'center' };

  return (
    <>
      <style>{`
        @media print {
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          body,html{background:white!important;color:black!important;}
          .pr-navbar,.pr-screen{display:none!important;}
          .pr-print{display:block!important;}
          .pair-block{page-break-inside:avoid;margin-bottom:14px;}
        }
        @media screen{.pr-print{display:none;}}
      `}</style>

      {/* ── PRINT VERSION ───────────────────────────────── */}
      <div className="pr-print" style={{padding:'16px',fontFamily:'Arial,sans-serif'}}>
        <div style={{textAlign:'center',marginBottom:'12px',borderBottom:'3px solid #0b2a1a',paddingBottom:'8px'}}>
          <h1 style={{fontSize:'17px',color:'#0b2a1a',margin:'0 0 3px'}}>
            ♠ ♥ ♦ ♣ Bridge Club Scorer — Pair-wise Results
          </h1>
          <p style={{fontSize:'11px',color:'#555',margin:0}}>
            {session?.name} · {session?.date} · {session?.tables_count} tables
          </p>
        </div>

        {realPairs.map(p => {
          const opponents = Object.keys(pairVsPair[p]??{}).map(Number).sort((a,b)=>a-b);
          if (!opponents.length) return null;
          return (
            <div key={p} className="pair-block" style={{border:'1px solid #ccc',borderRadius:'4px',overflow:'hidden',marginBottom:'16px'}}>
              {/* Pair header */}
              <div style={{background:'#0b2a1a',color:'#c9a03c',padding:'6px 10px',display:'flex',justifyContent:'space-between',fontSize:'12px',fontWeight:'bold'}}>
                <span>Pair {p} — {pairName[p]}</span>
                <span>Rank #{rankMap[p]??'—'} · {pctMap[p]??'—'}%</span>
              </div>

              {/* One sub-section per opponent */}
              {opponents.map(opp => {
                const res = pairVsPair[p][opp];
                const pct = res.maxMP>0?((res.totalMP/res.maxMP)*100).toFixed(0):'—';
                const scoreColor = res.totalScore>0?'#1a7a3a':res.totalScore<0?'#cc3333':'#555';
                return (
                  <div key={opp} style={{borderTop:'1px solid #ddd'}}>
                    {/* Opponent summary row */}
                    <div style={{background:'#f0f0e8',padding:'4px 10px',display:'flex',justifyContent:'space-between',fontSize:'10px',fontWeight:'bold'}}>
                      <span>vs Pair {opp} — {pairName[opp]}</span>
                      <span style={{color:scoreColor}}>
                        Net: {res.totalScore>0?`+${res.totalScore}`:res.totalScore} · MP: {res.totalMP}/{res.maxMP} · {pct}%
                      </span>
                    </div>
                    {/* Individual boards */}
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr>
                          <th style={subTh}>Board</th>
                          <th style={subTh}>Vul</th>
                          <th style={subTh}>Side</th>
                          <th style={subTh}>Contract</th>
                          <th style={subTh}>Tricks</th>
                          <th style={subTh}>Score</th>
                          <th style={subTh}>MP</th>
                          <th style={subTh}>Max</th>
                        </tr>
                      </thead>
                      <tbody>
                        {res.boards.map((b,i) => {
                          const sc = b.score;
                          const scColor = sc>0?'#1a7a3a':sc<0?'#cc3333':'#555';
                          const bg = i%2===0?'#fafaf5':'white';
                          return (
                            <tr key={b.boardNum}>
                              <td style={{...subTd,background:bg}}>{b.boardNum}</td>
                              <td style={{...subTd,background:bg}}>{vulLabel(b.boardNum)}</td>
                              <td style={{...subTd,background:bg}}>{b.side}</td>
                              <td style={{...subTd,background:bg,fontFamily:'monospace'}}>{b.contract}={b.tricks}</td>
                              <td style={{...subTd,background:bg}}>{b.tricks}</td>
                              <td style={{...subTd,background:bg,fontWeight:'bold',color:scColor}}>
                                {sc>0?`+${sc}`:sc}
                              </td>
                              <td style={{...subTd,background:bg,fontWeight:'bold'}}>{b.mp}</td>
                              <td style={{...subTd,background:bg}}>{b.maxMP}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })}
        <p style={{textAlign:'center',fontSize:'10px',color:'#888',marginTop:'10px'}}>
          Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* ── SCREEN VERSION ──────────────────────────────── */}
      <div className="pr-screen min-h-screen bg-felt-gradient">
        <header className="pr-navbar border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(`/play/${token}/results`)}
              className="text-cream-400 hover:text-gold-300">
              <ArrowLeft size={20} />
            </button>
            <span className="font-display text-gold-300 text-base flex-1 truncate">
              Pair-wise Results — {session?.name}
            </span>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <Printer size={14} /> Print
            </button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {realPairs.map(p => {
            const opponents = Object.keys(pairVsPair[p]??{}).map(Number).sort((a,b)=>a-b);
            if (!opponents.length) return null;

            return (
              <div key={p} className="card-felt relative overflow-hidden">
                {/* Pair header */}
                <div className="px-5 py-3 bg-felt-900/60 border-b border-gold-500/20
                                flex items-center justify-between">
                  <div>
                    <span className="font-display text-gold-300 text-base">Pair {p}</span>
                    <span className="text-cream-300 text-sm ml-2">{pairName[p]}</span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-cream-400">Rank </span>
                    <span className="text-gold-300 font-bold">#{rankMap[p]??'—'}</span>
                    <span className="text-cream-400 ml-2">{pctMap[p]??'—'}%</span>
                  </div>
                </div>

                {/* One row per opponent */}
                <div className="divide-y divide-gold-500/10">
                  {opponents.map(opp => {
                    const res = pairVsPair[p][opp];
                    const pct = res.maxMP>0?((res.totalMP/res.maxMP)*100).toFixed(0):'—';
                    const k   = `${p}-${opp}`;
                    const isExpanded = !!expanded[k];

                    return (
                      <div key={opp}>
                        {/* Opponent summary row — tap to expand */}
                        <button
                          onClick={() => toggleExpand(p, opp)}
                          className="w-full flex items-center gap-3 px-4 py-3
                                     hover:bg-white/5 transition-colors text-left">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-cream-200">
                              vs Pair {opp} — {pairName[opp]}
                            </div>
                            <div className="text-xs text-cream-400/60 mt-0.5">
                              {res.boards.length} boards ·
                              MP {res.totalMP}/{res.maxMP} · {pct}%
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0 flex items-center gap-2">
                            <div className={`font-mono font-bold text-sm
                              ${res.totalScore>0?'text-green-400':res.totalScore<0?'text-red-400':'text-cream-400'}`}>
                              {res.totalScore>0?`+${res.totalScore}`:res.totalScore}
                            </div>
                            {isExpanded
                              ? <ChevronUp size={14} className="text-cream-400/60" />
                              : <ChevronDown size={14} className="text-cream-400/60" />}
                          </div>
                        </button>

                        {/* Board detail — shown when expanded */}
                        {isExpanded && (
                          <div className="border-t border-gold-500/10 overflow-x-auto bg-felt-900/40">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-cream-400 bg-felt-900/60">
                                  <th className="px-3 py-1.5 text-center">Bd</th>
                                  <th className="px-2 py-1.5 text-center">Vul</th>
                                  <th className="px-2 py-1.5 text-center">Side</th>
                                  <th className="px-3 py-1.5 text-center">Contract</th>
                                  <th className="px-2 py-1.5 text-center">Tr</th>
                                  <th className="px-3 py-1.5 text-right">Score</th>
                                  <th className="px-2 py-1.5 text-center">MP</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gold-500/5">
                                {res.boards.map(b => (
                                  <tr key={b.boardNum}>
                                    <td className="px-3 py-1.5 text-center font-mono text-cream-300">{b.boardNum}</td>
                                    <td className="px-2 py-1.5 text-center text-cream-400/60">{vulLabel(b.boardNum)}</td>
                                    <td className={`px-2 py-1.5 text-center font-semibold
                                      ${b.side==='NS'?'text-cream-300':'text-gold-400'}`}>
                                      {b.side}
                                    </td>
                                    <td className="px-3 py-1.5 text-center font-mono text-cream-200">
                                      {b.contract}={b.tricks}
                                    </td>
                                    <td className="px-2 py-1.5 text-center font-mono text-cream-300">{b.tricks}</td>
                                    <td className={`px-3 py-1.5 text-right font-mono font-bold
                                      ${b.score>0?'text-green-400':b.score<0?'text-red-400':'text-cream-400'}`}>
                                      {b.score>0?`+${b.score}`:b.score}
                                    </td>
                                    <td className={`px-2 py-1.5 text-center font-mono font-bold
                                      ${b.mp>=b.maxMP*0.6?'text-green-400':b.mp<b.maxMP*0.4?'text-red-400':'text-cream-300'}`}>
                                      {b.mp}/{b.maxMP}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              {/* Totals row */}
                              <tfoot>
                                <tr className="bg-felt-900/60 border-t border-gold-500/20">
                                  <td colSpan="5" className="px-3 py-1.5 text-xs text-cream-400 font-semibold">
                                    Total
                                  </td>
                                  <td className={`px-3 py-1.5 text-right font-mono font-bold text-sm
                                    ${res.totalScore>0?'text-green-400':res.totalScore<0?'text-red-400':'text-cream-400'}`}>
                                    {res.totalScore>0?`+${res.totalScore}`:res.totalScore}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-mono font-bold text-cream-200">
                                    {res.totalMP}/{res.maxMP}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <button onClick={() => window.print()}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16} /> Print / Save as PDF
          </button>
          <p className="text-center text-cream-400/50 text-xs pb-4">
            Print shows all boards expanded for every pair
          </p>
        </main>
      </div>
    </>
  );
}
