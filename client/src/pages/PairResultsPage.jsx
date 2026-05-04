import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

export default function PairResultsPage() {
  const { token }               = useParams();
  const { player, playerFetch } = usePlayer();
  const nav                     = useNavigate();

  const [data,    setData]    = useState(null); // { pairs, boards, standings }
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

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
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center px-4">
      <div className="text-red-400 text-sm">{error || 'No data available'}</div>
    </div>
  );

  // ── Build pair name lookup ────────────────────────────────
  const pairName = {};
  (data.pairs ?? []).forEach(p => {
    const names = [p.player1_name, p.player2_name].filter(Boolean);
    pairName[p.pair_number] = names.length ? names.join(' / ') : `Pair ${p.pair_number}`;
  });

  const realPairs = (data.pairs ?? [])
    .filter(p => !p.is_phantom)
    .map(p => p.pair_number)
    .sort((a,b) => a-b);

  // ── For each pair, collect results against each opponent ──
  // Returns: { [pairNum]: { [opponentNum]: { boards: [...], totalMP, totalNS } } }
  const pairVsPair = {};
  for (const p of realPairs) pairVsPair[p] = {};

  // Calculate matchpoints per board
  function calcBoardMP(results) {
    const played = results.filter(r => !r.is_bye && r.ns_score != null);
    const n = played.length;
    const maxMP = Math.max(0, (n - 1) * 2);
    const avgMP = maxMP / 2;
    const out = {};
    for (const r of played) {
      let nsMP = 0, ewMP = 0;
      for (const o of played) {
        if (o === r) continue;
        if (r.ns_score > o.ns_score) nsMP += 2;
        else if (r.ns_score === o.ns_score) { nsMP += 1; ewMP += 1; }
        if (r.ns_score < o.ns_score) ewMP += 2;
      }
      out[`${r.ns_pair}-${r.ew_pair}`] = { nsMP, ewMP, maxMP };
    }
    for (const r of results.filter(r => r.is_bye)) {
      out[`${r.ns_pair}-${r.ew_pair}`] = { nsMP: avgMP, ewMP: avgMP, maxMP, isBye: true };
    }
    return out;
  }

  // Build board MP map for all boards
  const boardMPMap = {};
  for (const board of (data.boards ?? [])) {
    boardMPMap[board.boardNumber] = calcBoardMP(board.results);
  }

  // Populate pairVsPair
  for (const board of (data.boards ?? [])) {
    for (const r of board.results) {
      if (r.is_bye) continue;
      if (r.ns_score == null) continue;

      const ns = r.ns_pair, ew = r.ew_pair;
      const key = `${ns}-${ew}`;
      const mp = boardMPMap[board.boardNumber]?.[key];
      if (!mp) continue;

      // NS perspective
      if (!pairVsPair[ns]) pairVsPair[ns] = {};
      if (!pairVsPair[ns][ew]) pairVsPair[ns][ew] = { boards:[], totalMP:0, maxMP:0, totalScore:0 };
      pairVsPair[ns][ew].boards.push({ boardNum: board.boardNumber, nsScore: r.ns_score, mp: mp.nsMP, maxMP: mp.maxMP });
      pairVsPair[ns][ew].totalMP    += mp.nsMP;
      pairVsPair[ns][ew].maxMP      += mp.maxMP;
      pairVsPair[ns][ew].totalScore += r.ns_score;

      // EW perspective
      if (!pairVsPair[ew]) pairVsPair[ew] = {};
      if (!pairVsPair[ew][ns]) pairVsPair[ew][ns] = { boards:[], totalMP:0, maxMP:0, totalScore:0 };
      pairVsPair[ew][ns].boards.push({ boardNum: board.boardNumber, nsScore: -r.ns_score, mp: mp.ewMP, maxMP: mp.maxMP });
      pairVsPair[ew][ns].totalMP    += mp.ewMP;
      pairVsPair[ew][ns].maxMP      += mp.maxMP;
      pairVsPair[ew][ns].totalScore += -r.ns_score;
    }
  }

  // Rank lookup from standings
  const rankMap = {};
  const pctMap  = {};
  for (const s of (data.standings ?? [])) {
    rankMap[s.pairNumber] = s.rank;
    pctMap[s.pairNumber]  = s.percentage;
  }

  const tdS   = { background:'white', color:'black', padding:'4px 8px', fontSize:'10px', borderBottom:'1px solid #eee', textAlign:'center' };
  const thS   = { background:'#0b2a1a', color:'#c9a03c', padding:'5px 8px', fontSize:'10px', fontWeight:'bold', textAlign:'center' };
  const tdLS  = { ...tdS, textAlign:'left' };

  return (
    <>
      <style>{`
        @media print {
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          body,html{background:white!important;color:black!important;}
          .pr-navbar{display:none!important;}
          .pr-screen{display:none!important;}
          .pr-print{display:block!important;}
        }
        @media screen{.pr-print{display:none;}}
      `}</style>

      {/* ── PRINT VERSION ────────────────────────────────── */}
      <div className="pr-print" style={{padding:'16px', fontFamily:'Arial, sans-serif'}}>
        <div style={{textAlign:'center', marginBottom:'14px', borderBottom:'3px solid #0b2a1a', paddingBottom:'10px'}}>
          <h1 style={{fontSize:'18px', color:'#0b2a1a', margin:'0 0 3px'}}>
            ♠ ♥ ♦ ♣ Bridge Club Scorer — Pair-wise Results
          </h1>
          <p style={{fontSize:'11px', color:'#555', margin:0}}>
            {session?.name} · {session?.date} · {session?.tables_count} tables
          </p>
        </div>

        {realPairs.map(p => {
          const opponents = Object.keys(pairVsPair[p] ?? {}).map(Number).sort((a,b)=>a-b);
          if (!opponents.length) return null;
          return (
            <div key={p} style={{marginBottom:'16px', border:'1px solid #ccc', borderRadius:'4px', overflow:'hidden', pageBreakInside:'avoid'}}>
              <div style={{background:'#0b2a1a', color:'#c9a03c', padding:'6px 10px', display:'flex', justifyContent:'space-between', fontSize:'12px', fontWeight:'bold'}}>
                <span>Pair {p} — {pairName[p]}</span>
                <span>Rank #{rankMap[p] ?? '—'} · {pctMap[p] ?? '—'}%</span>
              </div>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    <th style={{...thS, textAlign:'left'}}>Opponent</th>
                    <th style={thS}>Boards</th>
                    <th style={thS}>Net Score</th>
                    <th style={thS}>MP Won</th>
                    <th style={thS}>Max MP</th>
                    <th style={thS}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {opponents.map((opp, i) => {
                    const res = pairVsPair[p][opp];
                    const pct = res.maxMP > 0 ? ((res.totalMP / res.maxMP) * 100).toFixed(0) : '—';
                    const bg  = i % 2 === 0 ? 'white' : '#f8f8f2';
                    const scoreColor = res.totalScore > 0 ? '#1a7a3a' : res.totalScore < 0 ? '#cc3333' : '#555';
                    return (
                      <tr key={opp}>
                        <td style={{...tdLS, background:bg}}>Pair {opp} — {pairName[opp]}</td>
                        <td style={{...tdS,  background:bg}}>{res.boards.length}</td>
                        <td style={{...tdS,  background:bg, fontWeight:'bold', color:scoreColor}}>
                          {res.totalScore > 0 ? `+${res.totalScore}` : res.totalScore}
                        </td>
                        <td style={{...tdS,  background:bg, fontWeight:'bold'}}>{res.totalMP}</td>
                        <td style={{...tdS,  background:bg}}>{res.maxMP}</td>
                        <td style={{...tdS,  background:bg, fontWeight:'bold',
                          color: Number(pct)>=60?'#1a7a3a':Number(pct)<40?'#cc3333':'#000'}}>
                          {pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        <p style={{textAlign:'center', fontSize:'10px', color:'#888', marginTop:'12px'}}>
          Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
        </p>
      </div>

      {/* ── SCREEN VERSION ───────────────────────────────── */}
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
            const opponents = Object.keys(pairVsPair[p] ?? {}).map(Number).sort((a,b)=>a-b);
            if (!opponents.length) return null;

            return (
              <div key={p} className="card-felt relative overflow-hidden">
                {/* Pair header */}
                <div className="px-5 py-3 bg-felt-900/60 border-b border-gold-500/20
                                flex items-center justify-between">
                  <div>
                    <span className="font-display text-gold-300 text-base">
                      Pair {p}
                    </span>
                    <span className="text-cream-300 text-sm ml-2">{pairName[p]}</span>
                  </div>
                  <div className="text-right text-xs">
                    <span className="text-cream-400">Rank </span>
                    <span className="text-gold-300 font-bold">#{rankMap[p] ?? '—'}</span>
                    <span className="text-cream-400 ml-2">{pctMap[p] ?? '—'}%</span>
                  </div>
                </div>

                {/* Results table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-felt-900/40 text-cream-400">
                        <th className="px-3 py-2 text-left">Opponent</th>
                        <th className="px-3 py-2 text-center">Bds</th>
                        <th className="px-3 py-2 text-right">Net Score</th>
                        <th className="px-3 py-2 text-center">MP</th>
                        <th className="px-3 py-2 text-center">Max</th>
                        <th className="px-3 py-2 text-center">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gold-500/10">
                      {opponents.map(opp => {
                        const res = pairVsPair[p][opp];
                        const pct = res.maxMP > 0
                          ? ((res.totalMP / res.maxMP) * 100).toFixed(0)
                          : '—';
                        const isMe = opp === player?.pairNumber;
                        return (
                          <tr key={opp} className={isMe ? 'bg-gold-400/10' : ''}>
                            <td className="px-3 py-2 text-cream-200">
                              <span className="text-cream-400 mr-1">P{opp}</span>
                              {pairName[opp]}
                            </td>
                            <td className="px-3 py-2 text-center text-cream-400">{res.boards.length}</td>
                            <td className={`px-3 py-2 text-right font-mono font-bold
                              ${res.totalScore>0?'text-green-400':res.totalScore<0?'text-red-400':'text-cream-400'}`}>
                              {res.totalScore>0?`+${res.totalScore}`:res.totalScore}
                            </td>
                            <td className="px-3 py-2 text-center font-mono font-bold text-cream-200">
                              {res.totalMP}
                            </td>
                            <td className="px-3 py-2 text-center font-mono text-cream-400">{res.maxMP}</td>
                            <td className={`px-3 py-2 text-center font-mono font-bold
                              ${Number(pct)>=60?'text-green-400':Number(pct)<40?'text-red-400':'text-cream-300'}`}>
                              {pct}%
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

          <button onClick={() => window.print()}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16} /> Print Pair-wise Results / Save as PDF
          </button>
          <p className="text-center text-cream-400/50 text-xs pb-4">
            Tap Print → "Save as PDF" in your browser print dialog
          </p>
        </main>
      </div>
    </>
  );
}
