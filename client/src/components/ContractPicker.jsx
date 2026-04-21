import { useState, useMemo } from 'react';
import SuitSymbol from './SuitSymbol.jsx';

// ── Vulnerability ─────────────────────────────────────────────
const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function getVuln(b) { return VUL_CYCLE[(b - 1) % 16]; }
function isVul(side, b) { const v = getVuln(b); return v === 'both' || v === side; }

// ── Inline score calculator (mirrors scoring-engine.js) ───────
function calcScore({ declarer, level, suit, doubled, tricks, boardNumber }) {
  if (level === 0) return 0;
  const declaringNS = declarer === 'N' || declarer === 'S';
  const vul = isVul(declaringNS ? 'ns' : 'ew', boardNumber);
  const needed = 6 + level;
  const result = tricks - needed;

  let score;
  if (result >= 0) {
    // Base trick score
    let base;
    if (suit === 'NT')                  base = 10 + 30 * level;
    else if (suit === 'H' || suit === 'S') base = 30 * level;
    else                                base = 20 * level;
    if (doubled === 'doubled')   base *= 2;
    if (doubled === 'redoubled') base *= 4;

    const isGame = base >= 100;

    // Overtrick value
    let otv;
    if (doubled === 'none')       otv = (suit === 'C' || suit === 'D') ? 20 : 30;
    else if (doubled === 'doubled')    otv = vul ? 200 : 100;
    else                          otv = vul ? 400 : 200;

    score = base + result * otv;
    if (doubled === 'doubled')   score += 50;
    if (doubled === 'redoubled') score += 100;
    if (!isGame)  score += 50;
    else          score += vul ? 500 : 300;
    if (level === 6) score += vul ? 750  : 500;
    if (level === 7) score += vul ? 1500 : 1000;
  } else {
    const mult = doubled === 'redoubled' ? 2 : 1;
    let penalty = 0;
    for (let i = 1; i <= -result; i++) {
      if (vul) {
        penalty += (i === 1 ? 200 : 300) * mult;
      } else {
        let base = i === 1 ? 100 : i <= 3 ? 200 : 300;
        penalty += base * mult;
      }
    }
    score = -penalty;
  }
  return declaringNS ? score : -score;
}

const LEVELS    = [1,2,3,4,5,6,7];
const SUITS     = ['C','D','H','S','NT'];
const DOUBLES   = [
  { value:'none',      label:'—'  },
  { value:'doubled',   label:'X'  },
  { value:'redoubled', label:'XX' },
];
const DECLARERS = ['N','S','E','W'];

function ToggleBtn({ selected, onClick, children, className = '' }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-lg border transition-all duration-100 font-mono text-sm px-3 py-2
        ${selected
          ? 'bg-gold-400 border-gold-400 text-felt-950 font-bold shadow-gold'
          : 'border-gold-500/30 text-cream-300 hover:border-gold-400/60 hover:text-cream-100'
        } ${className}`}>
      {children}
    </button>
  );
}

export default function ContractPicker({ boardNumber, nsPair, ewPair, side, onSubmit, loading }) {
  const [passedOut, setPassedOut] = useState(false);
  const [level,     setLevel]     = useState(null);
  const [suit,      setSuit]      = useState(null);
  const [doubled,   setDoubled]   = useState('none');
  const [declarer,  setDeclarer]  = useState(null);
  const [tricks,    setTricks]    = useState(null);

  const vulNS = isVul('ns', boardNumber);
  const vulEW = isVul('ew', boardNumber);
  const needed = level !== null ? 6 + level : null;

  // ── Live score preview ───────────────────────────────────────
  const liveScore = useMemo(() => {
    if (passedOut) return 0;
    if (level === null || suit === null || declarer === null || tricks === null) return null;
    return calcScore({ declarer, level, suit, doubled, tricks, boardNumber });
  }, [passedOut, level, suit, doubled, declarer, tricks, boardNumber]);

  // Score from this pair's perspective
  const myScore = useMemo(() => {
    if (liveScore === null) return null;
    if (side === 'EW') return -liveScore;
    return liveScore;
  }, [liveScore, side]);

  const contractReady = !passedOut && level !== null && suit !== null && declarer !== null && tricks !== null;
  const ready = passedOut || contractReady;

  const handleSubmit = () => {
    if (!ready) return;
    if (passedOut) {
      onSubmit({ declarer: 'N', level: 0, suit: 'NT', doubled: 'none', tricks: 0 });
    } else {
      onSubmit({ declarer, level, suit, doubled, tricks });
    }
  };

  const reset = () => {
    setPassedOut(false); setLevel(null); setSuit(null);
    setDoubled('none'); setDeclarer(null); setTricks(null);
  };

  const handlePassedOut = () => {
    setPassedOut(p => !p);
    setLevel(null); setSuit(null); setDoubled('none'); setDeclarer(null); setTricks(null);
  };

  return (
    <div className="space-y-4">

      {/* Board header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="text-cream-400">NS <span className="text-cream-100 font-semibold">Pair {nsPair}</span></span>
          <span className="text-cream-400">EW <span className="text-cream-100 font-semibold">Pair {ewPair}</span></span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded ${vulNS ? 'bg-red-900/70 text-red-300' : 'bg-felt-700 text-cream-400'}`}>
            NS {vulNS ? 'Vul' : 'NV'}
          </span>
          <span className={`px-2 py-0.5 rounded ${vulEW ? 'bg-red-900/70 text-red-300' : 'bg-felt-700 text-cream-400'}`}>
            EW {vulEW ? 'Vul' : 'NV'}
          </span>
        </div>
      </div>

      {/* Passed Out button */}
      <button type="button" onClick={handlePassedOut}
        className={`w-full rounded-xl border-2 py-3 font-semibold text-base transition-all duration-150
          ${passedOut
            ? 'bg-amber-700/40 border-amber-500 text-amber-300'
            : 'border-gold-500/30 text-cream-400 hover:border-gold-400/50 hover:text-cream-200'
          }`}>
        {passedOut ? '✓ Passed Out (All Pass)' : 'All Pass — Board Passed Out'}
      </button>

      {!passedOut && (
        <>
          {/* Level */}
          <div>
            <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">Level</p>
            <div className="flex gap-2">
              {LEVELS.map(l => (
                <ToggleBtn key={l} selected={level === l} onClick={() => setLevel(l)}>{l}</ToggleBtn>
              ))}
            </div>
          </div>

          {/* Suit */}
          <div>
            <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">Suit</p>
            <div className="flex gap-2">
              {SUITS.map(s => (
                <ToggleBtn key={s} selected={suit === s} onClick={() => setSuit(s)} className="min-w-[3rem]">
                  <SuitSymbol suit={s} />
                </ToggleBtn>
              ))}
            </div>
          </div>

          {/* Doubled */}
          <div>
            <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">Doubled</p>
            <div className="flex gap-2">
              {DOUBLES.map(d => (
                <ToggleBtn key={d.value} selected={doubled === d.value} onClick={() => setDoubled(d.value)}>
                  {d.label}
                </ToggleBtn>
              ))}
            </div>
          </div>

          {/* Declarer */}
          <div>
            <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">Declarer</p>
            <div className="flex gap-2">
              {DECLARERS.map(d => (
                <ToggleBtn key={d} selected={declarer === d} onClick={() => setDeclarer(d)} className="min-w-[3rem]">
                  {d}
                </ToggleBtn>
              ))}
            </div>
          </div>

          {/* Tricks */}
          <div>
            <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">
              Tricks taken{needed ? ` (need ${needed} to make)` : ''}
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 14 }, (_, i) => i).map(t => {
                const made = needed !== null && t >= needed;
                return (
                  <button key={t} type="button" onClick={() => setTricks(t)}
                    className={`rounded-lg py-2 text-sm font-mono border transition-all duration-100
                      ${tricks === t
                        ? made
                          ? 'bg-green-700 border-green-500 text-white font-bold'
                          : 'bg-red-900 border-red-700 text-red-200 font-bold'
                        : made
                          ? 'border-green-800/50 text-green-400 hover:border-green-600'
                          : 'border-gold-500/20 text-cream-400 hover:border-gold-500/40'
                      }`}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── LIVE SCORE PREVIEW ─────────────────────────────────── */}
      {myScore !== null && (
        <div className={`rounded-xl border px-4 py-3 transition-all
          ${myScore > 0
            ? 'bg-green-900/30 border-green-600/40'
            : myScore < 0
              ? 'bg-red-900/30 border-red-600/40'
              : 'bg-felt-700/60 border-gold-500/20'
          }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-cream-400 uppercase tracking-widest mb-0.5">
                Your score ({side})
              </p>
              <p className={`font-display text-2xl font-bold
                ${myScore > 0 ? 'text-green-400' : myScore < 0 ? 'text-red-400' : 'text-cream-400'}`}>
                {myScore > 0 ? `+${myScore}` : myScore === 0 ? '0' : myScore}
              </p>
            </div>
            {liveScore !== null && liveScore !== myScore && (
              <div className="text-right">
                <p className="text-xs text-cream-400 uppercase tracking-widest mb-0.5">
                  NS score
                </p>
                <p className={`font-mono text-lg
                  ${liveScore > 0 ? 'text-green-400' : liveScore < 0 ? 'text-red-400' : 'text-cream-400'}`}>
                  {liveScore > 0 ? `+${liveScore}` : liveScore}
                </p>
              </div>
            )}
          </div>
          {passedOut && (
            <p className="text-amber-300 text-sm mt-1">
              All four players passed — score is 0 for both sides.
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button type="button" onClick={reset} className="btn-ghost text-sm">Clear</button>
        <button type="button" onClick={handleSubmit} disabled={!ready || loading}
          className="btn-gold flex-1 text-center">
          {loading ? 'Saving…' : 'Save Result'}
        </button>
      </div>
    </div>
  );
}
