import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Printer, FileDown, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function vulText(b) {
  const v = VUL_CYCLE[(b-1)%16];
  if (v==='none') return 'None'; if (v==='ns') return 'NS Vul';
  if (v==='ew')   return 'EW Vul'; return 'Both Vul';
}
function vulLabel(b) {
  const v = VUL_CYCLE[(b-1)%16];
  if (v==='none') return 'NV'; if (v==='ns') return 'NS';
  if (v==='ew')   return 'EW'; return 'Both';
}

function contractStr(r) {
  if (!r || r.level==null) return '—';
  if (r.level===0) return 'Passed';
  const dbl = r.doubled==='doubled'?'X':r.doubled==='redoubled'?'XX':'';
  return `${r.declarer}${r.level}${r.suit}${dbl}`;
}

function calcMP(results) {
  const played = results.filter(r=>!r.is_bye&&r.ns_score!=null);
  const n=played.length, maxMP=Math.max(0,(n-1)*2), avgMP=maxMP/2;
  const out={};
  for (const r of played) {
    let nsMP=0,ewMP=0;
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

const MEDAL={1:'🥇',2:'🥈',3:'🥉'};

export default function DirectorResultsPage() {
  const { id }       = useParams();
  const { apiFetch, auth } = useAuth();
  const nav          = useNavigate();

  const [session,   setSession]   = useState(null);
  const [standings, setStandings] = useState([]);
  const [boards,    setBoards]    = useState([]);
  const [pairs,     setPairs]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [tab,       setTab]       = useState('standings');
  const [openBoard, setOpenBoard] = useState(null);

  useEffect(() => { loadAll(); }, [id]);

  // Fetch with one automatic retry — shields against transient
  // Supabase pooler drops / Render cold starts
  const fetchJson = async (url, label) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const res  = await apiFetch(url);
        const data = await res.json().catch(() => ({}));
        if (res.ok) return data;
        if (attempt === 2)
          throw new Error(`${label} failed (${res.status}): ${data.error ?? 'Server error'}`);
      } catch (e) {
        if (attempt === 2) throw e instanceof Error ? e : new Error(`${label} failed`);
      }
      await new Promise(r => setTimeout(r, 800)); // brief pause before retry
    }
  };

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [sessData, resultsData, scoresData] = await Promise.all([
        fetchJson(`/api/sessions/${id}`,                'Session details'),
        fetchJson(`/api/sessions/${id}/results`,        'Board results'),
        fetchJson(`/api/sessions/${id}/results/scores`, 'Standings'),
      ]);

      if (!Array.isArray(resultsData)) throw new Error('Board results: unexpected response');
      if (!Array.isArray(scoresData))  throw new Error('Standings: unexpected response');

      setSession(sessData);
      setStandings(scoresData);

      // Build pair lookup (guard against [null] from empty json_agg)
      const pairLookup={};
      (sessData.pairs??[]).forEach(p=>{ if(p) pairLookup[p.pair_number]=p; });
      setPairs(pairLookup);

      // Group results by board number
      const boardMap={};
      for (const r of resultsData) {
        if (!boardMap[r.board_number]) boardMap[r.board_number]=[];
        boardMap[r.board_number].push(r);
      }
      const boardArr = Object.entries(boardMap)
        .map(([bn,results])=>({boardNumber:Number(bn),results}))
        .sort((a,b)=>a.boardNumber-b.boardNumber);
      setBoards(boardArr);
      if (boardArr.length) setOpenBoard(boardArr[0].boardNumber);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  function getPairName(num) {
    const p=pairs[num];
    if (!p) return `Pair ${num}`;
    const names=[p.player1_name,p.player2_name].filter(Boolean);
    return names.length?names.join(' / '):`Pair ${num}`;
  }

  // Server-generated PDF — reliable on iPhone/iPad where window.print() is flaky.
  // Token goes via ?t= because the Vercel proxy strips Authorization headers.
  const downloadPdf = () => {
    if (!auth?.accessToken) return;
    window.open(`/api/sessions/${id}/pdf?t=${encodeURIComponent(auth.accessToken)}`, '_blank');
  };

  function pctColour(pct) {
    const n=parseFloat(pct);
    if(n>=60) return 'text-green-400';
    if(n>=45) return 'text-gold-300';
    return 'text-red-400';
  }

  const tdS = {background:'white',color:'black',padding:'4px 8px',fontSize:'11px',borderBottom:'1px solid #ddd'};
  const thS = {background:'#0b2a1a',color:'#c9a03c',padding:'5px 8px',fontSize:'11px',fontWeight:'bold'};
  const subTh = {background:'#e8e8e0',color:'#333',padding:'3px 7px',fontSize:'9px',fontWeight:'bold',textAlign:'center',borderBottom:'1px solid #ccc'};
  const subTd = {background:'#fafaf5',color:'black',padding:'3px 7px',fontSize:'9px',borderBottom:'1px solid #f0f0e8',textAlign:'center'};

  // ── Pair-wise scorecards (print only) — same math/format as PairResultsPage ──
  const pairCards = useMemo(() => {
    const rankMap = {}, pctMap = {};
    for (const s of standings) { rankMap[s.pairNumber] = s.rank; pctMap[s.pairNumber] = s.percentage; }

    const boardMPMap = {};
    for (const board of boards) boardMPMap[board.boardNumber] = calcMP(board.results);

    const pvp = {};
    const ensure = (a,b) => {
      if (!pvp[a]) pvp[a] = {};
      if (!pvp[a][b]) pvp[a][b] = { boards:[], totalMP:0, maxMP:0, totalScore:0 };
    };

    for (const board of boards) {
      for (const r of board.results) {
        if (r.is_bye || r.ns_score == null) continue;
        const ns = r.ns_pair, ew = r.ew_pair, key = `${ns}-${ew}`;
        const mp = boardMPMap[board.boardNumber]?.[key];
        if (!mp) continue;

        ensure(ns, ew);
        pvp[ns][ew].boards.push({ boardNum:board.boardNumber, side:'NS', contract:contractStr(r), tricks:r.tricks, score:r.ns_score, mp:mp.nsMP, maxMP:mp.maxMP });
        pvp[ns][ew].totalMP += mp.nsMP; pvp[ns][ew].maxMP += mp.maxMP; pvp[ns][ew].totalScore += r.ns_score;

        ensure(ew, ns);
        pvp[ew][ns].boards.push({ boardNum:board.boardNumber, side:'EW', contract:contractStr(r), tricks:r.tricks, score:-r.ns_score, mp:mp.ewMP, maxMP:mp.maxMP });
        pvp[ew][ns].totalMP += mp.ewMP; pvp[ew][ns].maxMP += mp.maxMP; pvp[ew][ns].totalScore += -r.ns_score;
      }
    }

    for (const p of Object.keys(pvp))
      for (const opp of Object.keys(pvp[p]))
        pvp[p][opp].boards.sort((a,b) => a.boardNum - b.boardNum);

    const realPairs = Object.keys(pvp).map(Number).sort((a,b) => a-b);
    return { pvp, realPairs, rankMap, pctMap };
  }, [boards, standings]);

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <>
      <style>{`
        @media print {
          *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
          body,html{background:white!important;color:black!important;}
          .dr-navbar,.dr-screen,.dr-tabs{display:none!important;}
          .dr-print{display:block!important;}
          .dr-footer{display:block!important;}
          .board-block{page-break-inside:avoid;margin-bottom:14px;border:1px solid #bbb;border-radius:4px;overflow:hidden;}
          .pair-block{page-break-inside:avoid;}
          .board-hdr{background:#0b2a1a!important;color:#c9a03c!important;padding:5px 10px;display:flex;justify-content:space-between;font-size:11px;font-weight:bold;}
          .b-tbl{width:100%;border-collapse:collapse;font-size:10px;}
          .b-th{background:#e8e8e0!important;color:#333!important;padding:3px 7px;border-bottom:1px solid #ccc;}
          .b-td{padding:3px 7px;border-bottom:1px solid #eee;background:white!important;color:black!important;}
          .b-tr-alt .b-td{background:#f8f8f2!important;}
        }
        @media screen{.dr-print{display:none;}.dr-footer{display:none;}}
      `}</style>

      {/* ── PRINT VERSION ──────────────────────────────────── */}
      <div className="dr-print" style={{padding:'16px',fontFamily:'Arial,sans-serif',background:'white',color:'black'}}>
        <div style={{textAlign:'center',marginBottom:'14px',borderBottom:'3px solid #0b2a1a',paddingBottom:'10px'}}>
          <h1 style={{fontSize:'18px',color:'#0b2a1a',margin:'0 0 3px'}}>♠ ♥ ♦ ♣ Bridge Club Scorer — Full Results</h1>
          <p style={{fontSize:'11px',color:'#555',margin:0}}>
            {session?.name} · {session?.date} · {session?.tables_count} tables · {session?.num_boards} boards
          </p>
        </div>

        {/* Standings */}
        <h2 style={{fontSize:'14px',color:'#0b2a1a',borderBottom:'2px solid #c9a03c',paddingBottom:'3px',marginBottom:'8px'}}>
          Final Standings
        </h2>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px',marginBottom:'20px'}}>
          <thead>
            <tr>
              <th style={thS}>Rank</th><th style={thS}>Pair</th><th style={thS}>Players</th>
              <th style={{...thS,textAlign:'right'}}>MP</th>
              <th style={{...thS,textAlign:'right'}}>Max</th>
              <th style={{...thS,textAlign:'right'}}>%</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row,i)=>{
              const td={...tdS,background:i%2===0?'white':'#f8f8f2'};
              const pct=parseFloat(row.percentage);
              return (
                <tr key={row.pairNumber}>
                  <td style={td}>{row.rank<=3?['🥇','🥈','🥉'][row.rank-1]:row.rank}</td>
                  <td style={td}>{row.pairNumber}</td>
                  <td style={td}>{getPairName(row.pairNumber)}</td>
                  <td style={{...td,textAlign:'right'}}>{row.totalMP}</td>
                  <td style={{...td,textAlign:'right'}}>{row.maxMP}</td>
                  <td style={{...td,textAlign:'right',fontWeight:'bold',
                    color:pct>=60?'#1a7a3a':pct<45?'#cc3333':'#000'}}>
                    {row.percentage}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Board travellers */}
        <h2 style={{fontSize:'14px',color:'#0b2a1a',borderBottom:'2px solid #c9a03c',paddingBottom:'3px',marginBottom:'8px'}}>
          Board Travellers
        </h2>
        {boards.map(board=>{
          const mpMap=calcMP(board.results);
          const played=[...board.results.filter(r=>!r.is_bye&&r.entered_at)]
            .sort((a,b)=>(b.ns_score??-9999)-(a.ns_score??-9999));
          const byes=board.results.filter(r=>r.is_bye);
          return (
            <div key={board.boardNumber} className="board-block">
              <div className="board-hdr">
                <span>Board {board.boardNumber}</span>
                <span>{vulText(board.boardNumber)}</span>
              </div>
              <table className="b-tbl">
                <thead>
                  <tr>
                    <th className="b-th" style={{textAlign:'left'}}>NS Pair</th>
                    <th className="b-th" style={{textAlign:'left'}}>EW Pair</th>
                    <th className="b-th" style={{textAlign:'center'}}>Contract</th>
                    <th className="b-th" style={{textAlign:'center'}}>Tricks</th>
                    <th className="b-th" style={{textAlign:'right'}}>NS Score</th>
                    <th className="b-th" style={{textAlign:'center'}}>NS MP</th>
                    <th className="b-th" style={{textAlign:'center'}}>EW MP</th>
                  </tr>
                </thead>
                <tbody>
                  {played.length===0&&byes.length===0&&(
                    <tr><td colSpan="7" className="b-td" style={{textAlign:'center',color:'#aaa'}}>No results</td></tr>
                  )}
                  {played.map((r,i)=>{
                    const key=`${r.ns_pair}-${r.ew_pair}`;
                    const mp=mpMap[key];
                    const sc=r.ns_score;
                    return (
                      <tr key={key} className={i%2!==0?'b-tr-alt':''}>
                        <td className="b-td">{getPairName(r.ns_pair)}</td>
                        <td className="b-td">{getPairName(r.ew_pair)}</td>
                        <td className="b-td" style={{textAlign:'center',fontFamily:'monospace'}}>{contractStr(r)}</td>
                        <td className="b-td" style={{textAlign:'center'}}>{r.tricks??'—'}</td>
                        <td className="b-td" style={{textAlign:'right',fontWeight:'bold',
                          color:sc>0?'#1a7a3a':sc<0?'#cc3333':'#555'}}>
                          {sc!=null?(sc>0?`+${sc}`:sc):'—'}
                        </td>
                        <td className="b-td" style={{textAlign:'center',fontWeight:'bold'}}>{mp?.nsMP??'—'}</td>
                        <td className="b-td" style={{textAlign:'center',fontWeight:'bold'}}>{mp?.ewMP??'—'}</td>
                      </tr>
                    );
                  })}
                  {byes.map(r=>(
                    <tr key={`${r.ns_pair}-${r.ew_pair}`}>
                      <td className="b-td">{getPairName(r.ns_pair)}</td>
                      <td className="b-td">{getPairName(r.ew_pair)}</td>
                      <td className="b-td" colSpan="5" style={{textAlign:'center',color:'#888',fontStyle:'italic'}}>
                        BYE — Average score
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        {/* Pair-wise scorecards */}
        {pairCards.realPairs.length > 0 && (
          <h2 style={{fontSize:'14px',color:'#0b2a1a',borderBottom:'2px solid #c9a03c',
            paddingBottom:'3px',margin:'20px 0 8px',pageBreakBefore:'always'}}>
            Pair-wise Scorecards
          </h2>
        )}
        {pairCards.realPairs.map(p=>{
          const opponents=Object.keys(pairCards.pvp[p]??{}).map(Number).sort((a,b)=>a-b);
          if(!opponents.length) return null;
          return (
            <div key={p} className="pair-block"
              style={{border:'1px solid #ccc',borderRadius:'4px',overflow:'hidden',marginBottom:'16px'}}>
              <div style={{background:'#0b2a1a',color:'#c9a03c',padding:'6px 10px',display:'flex',
                justifyContent:'space-between',fontSize:'12px',fontWeight:'bold'}}>
                <span>Pair {p} — {getPairName(p)}</span>
                <span>Rank #{pairCards.rankMap[p]??'—'} · {pairCards.pctMap[p]??'—'}%</span>
              </div>
              {opponents.map(opp=>{
                const res=pairCards.pvp[p][opp];
                const pct=res.maxMP>0?((res.totalMP/res.maxMP)*100).toFixed(0):'—';
                const scoreColor=res.totalScore>0?'#1a7a3a':res.totalScore<0?'#cc3333':'#555';
                return (
                  <div key={opp} style={{borderTop:'1px solid #ddd'}}>
                    <div style={{background:'#f0f0e8',padding:'4px 10px',display:'flex',
                      justifyContent:'space-between',fontSize:'10px',fontWeight:'bold'}}>
                      <span>vs Pair {opp} — {getPairName(opp)}</span>
                      <span style={{color:scoreColor}}>
                        Net: {res.totalScore>0?`+${res.totalScore}`:res.totalScore} · MP: {res.totalMP}/{res.maxMP} · {pct}%
                      </span>
                    </div>
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
                        {res.boards.map((b,i)=>{
                          const sc=b.score;
                          const scColor=sc>0?'#1a7a3a':sc<0?'#cc3333':'#555';
                          const bg=i%2===0?'#fafaf5':'white';
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
      </div>

      <div className="dr-footer" style={{textAlign:'center',fontSize:'10px',color:'#888',
        padding:'8px 0',fontFamily:'Arial,sans-serif',borderTop:'1px solid #ddd'}}>
        Generated by Bridge Club Scorer · {new Date().toLocaleDateString()}
      </div>

      {/* ── SCREEN VERSION ─────────────────────────────────── */}
      <div className="dr-screen min-h-screen bg-felt-gradient">
        <header className="dr-navbar border-b border-gold-500/20 bg-felt-900/80 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => nav(`/sessions/${id}/director`)}
              className="text-cream-400 hover:text-gold-300">
              <ArrowLeft size={20}/>
            </button>
            <span className="font-display text-gold-300 text-base flex-1 truncate">
              Full Results — {session?.name}
            </span>
            <button onClick={downloadPdf}
              className="flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <FileDown size={14}/> PDF
            </button>
            <button onClick={()=>window.print()}
              className="hidden sm:flex items-center gap-1.5 text-sm btn-gold py-1.5 px-3">
              <Printer size={14}/> Print
            </button>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg
                            flex items-center justify-between gap-3">
              <span>⚠️ {error} — detailed scores may be incomplete.</span>
              <button onClick={loadAll}
                className="shrink-0 border border-red-400/50 hover:bg-red-400/10 rounded-md px-3 py-1 text-xs font-semibold">
                Retry
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="dr-tabs flex gap-2">
            {['standings','traveller'].map(t=>(
              <button key={t} onClick={()=>setTab(t)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all
                  ${tab===t?'bg-gold-400 border-gold-400 text-felt-950':'border-gold-500/30 text-cream-300 hover:border-gold-400/50'}`}>
                {t==='standings'?'🏆 Standings':'📋 Board Travellers'}
              </button>
            ))}
          </div>

          {/* Standings tab */}
          {tab==='standings' && (
            <div className="card-felt relative overflow-hidden">
              <div className="grid grid-cols-[44px_44px_1fr_60px_60px_70px] px-4 py-3
                              border-b border-gold-500/20 text-xs text-cream-400 uppercase tracking-widest">
                <div>Rank</div><div>Pair</div><div>Players</div>
                <div className="text-right">MP</div>
                <div className="text-right">Max</div>
                <div className="text-right">%</div>
              </div>
              <div className="divide-y divide-gold-500/10">
                {standings.map((row,i)=>(
                  <div key={row.pairNumber}
                    className={`grid grid-cols-[44px_44px_1fr_60px_60px_70px] px-4 py-3 items-center
                      ${i===0?'bg-gold-400/5':''}`}>
                    <div>{row.rank<=3
                      ?<span className="text-lg">{MEDAL[row.rank]}</span>
                      :<span className="font-mono text-cream-400 text-sm">{row.rank}</span>}
                    </div>
                    <div className="font-mono text-cream-300 text-sm">{row.pairNumber}</div>
                    <div className="text-sm text-cream-100 truncate">{getPairName(row.pairNumber)}</div>
                    <div className="text-right font-mono text-sm text-cream-200">{row.totalMP}</div>
                    <div className="text-right font-mono text-sm text-cream-400">{row.maxMP}</div>
                    <div className={`text-right font-mono font-bold text-sm ${pctColour(row.percentage)}`}>
                      {row.percentage}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Traveller tab */}
          {tab==='traveller' && boards.map(board=>{
            const mpMap=calcMP(board.results);
            const isOpen=openBoard===board.boardNumber;
            const played=[...board.results.filter(r=>!r.is_bye&&r.entered_at)]
              .sort((a,b)=>(b.ns_score??-9999)-(a.ns_score??-9999));
            const byes=board.results.filter(r=>r.is_bye);

            return (
              <div key={board.boardNumber} className="card-felt relative overflow-hidden">
                <button onClick={()=>setOpenBoard(isOpen?null:board.boardNumber)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gold-400/10 border border-gold-400/30
                                    flex items-center justify-center font-display text-gold-300 text-sm">
                      {board.boardNumber}
                    </div>
                    <div>
                      <div className="text-cream-100 text-sm font-semibold">Board {board.boardNumber}</div>
                      <div className="text-xs text-cream-400">{vulText(board.boardNumber)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-cream-400/60">{played.length} results</span>
                    {isOpen?<ChevronUp size={15} className="text-cream-400"/>:<ChevronDown size={15} className="text-cream-400"/>}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gold-500/20 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-felt-900/60 text-cream-400">
                          <th className="px-3 py-2 text-left">NS Pair</th>
                          <th className="px-3 py-2 text-left">EW Pair</th>
                          <th className="px-3 py-2 text-center">Contract</th>
                          <th className="px-3 py-2 text-center">Tricks</th>
                          <th className="px-3 py-2 text-right">NS Score</th>
                          <th className="px-3 py-2 text-center">NS MP</th>
                          <th className="px-3 py-2 text-center">EW MP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gold-500/10">
                        {played.length===0&&byes.length===0&&(
                          <tr><td colSpan="7" className="px-3 py-3 text-center text-cream-400/50">No results</td></tr>
                        )}
                        {played.map(r=>{
                          const key=`${r.ns_pair}-${r.ew_pair}`;
                          const mp=mpMap[key];
                          const sc=r.ns_score;
                          return (
                            <tr key={key} className="hover:bg-white/3">
                              <td className="px-3 py-2 text-cream-200">{getPairName(r.ns_pair)}</td>
                              <td className="px-3 py-2 text-cream-200">{getPairName(r.ew_pair)}</td>
                              <td className="px-3 py-2 text-center font-mono text-cream-200">{contractStr(r)}</td>
                              <td className="px-3 py-2 text-center font-mono text-cream-300">{r.tricks??'—'}</td>
                              <td className={`px-3 py-2 text-right font-mono font-bold
                                ${sc>0?'text-green-400':sc<0?'text-red-400':'text-cream-400'}`}>
                                {sc!=null?(sc>0?`+${sc}`:sc):'—'}
                              </td>
                              <td className={`px-3 py-2 text-center font-mono font-bold
                                ${mp?.nsMP!=null&&mp.nsMP>=mp.maxMP*0.6?'text-green-400'
                                  :mp?.nsMP!=null&&mp.nsMP<mp.maxMP*0.4?'text-red-400':'text-cream-300'}`}>
                                {mp?.nsMP??'—'}
                              </td>
                              <td className={`px-3 py-2 text-center font-mono font-bold
                                ${mp?.ewMP!=null&&mp.ewMP>=mp.maxMP*0.6?'text-green-400'
                                  :mp?.ewMP!=null&&mp.ewMP<mp.maxMP*0.4?'text-red-400':'text-cream-300'}`}>
                                {mp?.ewMP??'—'}
                              </td>
                            </tr>
                          );
                        })}
                        {byes.map(r=>(
                          <tr key={`${r.ns_pair}-${r.ew_pair}`}>
                            <td className="px-3 py-2 text-cream-400/60">{getPairName(r.ns_pair)}</td>
                            <td className="px-3 py-2 text-cream-400/60">{getPairName(r.ew_pair)}</td>
                            <td colSpan="5" className="px-3 py-2 text-center text-amber-400/70">
                              👻 BYE — Average score
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={downloadPdf}
            className="btn-gold w-full flex items-center justify-center gap-2 py-3">
            <FileDown size={16}/> Download PDF — Standings + All Board Results
          </button>
          <p className="text-center text-cream-400/50 text-xs">
            Recommended on iPhone/iPad — opens a PDF you can share, save, or AirPrint
          </p>
          <button onClick={()=>window.print()}
            className="btn-ghost w-full flex items-center justify-center gap-2 py-3">
            <Printer size={16}/> Browser Print — Standings + Travellers + Pair Cards
          </button>
          <p className="text-center text-cream-400/50 text-xs pb-2">
            Best on a computer — includes every pair's individual scorecard
          </p>
        </main>
      </div>
    </>
  );
}
