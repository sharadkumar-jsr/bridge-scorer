import { useState } from 'react';
import SuitSymbol from './SuitSymbol.jsx';

// Vulnerability cycle - mirrors scoring-engine.js
const VUL_CYCLE = [
  'none','ns','ew','both','ns','ew','both','none',
  'ew','both','none','ns','both','none','ns','ew',
];
function getVuln(boardNum) { return VUL_CYCLE[(boardNum - 1) % 16]; }
function isVul(side, boardNum) {
  const v = getVuln(boardNum);
  return v === 'both' || v === side;
}

const LEVELS  = [1, 2, 3, 4, 5, 6, 7];
const SUITS   = ['C', 'D', 'H', 'S', 'NT'];
const DOUBLES = [
  { value: 'none',      label: '—'  },
  { value: 'doubled',   label: 'X'  },
  { value: 'redoubled', label: 'XX' },
];
const DECLARERS = ['N', 'S', 'E', 'W'];

function ToggleBtn({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border transition-all duration-100 font-mono text-sm px-3 py-2
        ${selected
          ? 'bg-gold-400 border-gold-400 text-felt-950 font-bold shadow-gold'
          : 'border-gold-500/30 text-cream-300 hover:border-gold-400/60 hover:text-cream-100'
        } ${className}`}
    >
      {children}
    </button>
  );
}

export default function ContractPicker({ boardNumber, nsPair, ewPair, onSubmit, loading }) {
  const [level,    setLevel]    = useState(null);
  const [suit,     setSuit]     = useState(null);
  const [doubled,  setDoubled]  = useState('none');
  const [declarer, setDeclarer] = useState(null);
  const [tricks,   setTricks]   = useState(null);

  const vulNS = isVul('ns', boardNumber);
  const vulEW = isVul('ew', boardNumber);
  const ready = level !== null && suit !== null && declarer !== null && tricks !== null;

  const needed = level !== null ? 6 + level : null;

  const handleSubmit = () => {
    if (!ready) return;
    onSubmit({ declarer, level, suit, doubled, tricks });
  };

  const reset = () => {
    setLevel(null); setSuit(null); setDoubled('none');
    setDeclarer(null); setTricks(null);
  };

  return (
    <div className="space-y-5">
      {/* Board header */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex gap-4">
          <span className="text-cream-400">NS <span className="text-cream-100 font-semibold">Pair {nsPair}</span></span>
          <span className="text-cream-400">EW <span className="text-cream-100 font-semibold">Pair {ewPair}</span></span>
        </div>
        {/* Vulnerability */}
        <div className="flex gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded ${vulNS ? 'bg-red-900/70 text-red-300' : 'bg-felt-700 text-cream-400'}`}>
            NS {vulNS ? 'Vul' : 'NV'}
          </span>
          <span className={`px-2 py-0.5 rounded ${vulEW ? 'bg-red-900/70 text-red-300' : 'bg-felt-700 text-cream-400'}`}>
            EW {vulEW ? 'Vul' : 'NV'}
          </span>
        </div>
      </div>

      {/* Level */}
      <div>
        <p className="text-xs text-cream-400 mb-2 uppercase tracking-widest">Level</p>
        <div className="flex gap-2">
          {LEVELS.map(l => (
            <ToggleBtn key={l} selected={level === l} onClick={() => setLevel(l)}>
              {l}
            </ToggleBtn>
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
              <button
                key={t}
                type="button"
                onClick={() => setTricks(t)}
                className={`rounded-lg py-2 text-sm font-mono border transition-all duration-100
                  ${tricks === t
                    ? made
                      ? 'bg-green-700 border-green-500 text-white font-bold'
                      : 'bg-red-900 border-red-700 text-red-200 font-bold'
                    : made
                      ? 'border-green-800/50 text-green-400 hover:border-green-600'
                      : 'border-gold-500/20 text-cream-400 hover:border-gold-500/40'
                  }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={reset}
          className="btn-ghost text-sm"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ready || loading}
          className="btn-gold flex-1 text-center"
        >
          {loading ? 'Saving…' : 'Save Result'}
        </button>
      </div>
    </div>
  );
}
