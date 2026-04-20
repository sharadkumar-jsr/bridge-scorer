import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** Parse "1-3" → [1,2,3]  or "1,2,3" → [1,2,3]  or "5" → [5] */
function parseBoards(str) {
  const s = String(str ?? '').trim();
  if (!s) return [];
  if (/^\d+-\d+$/.test(s)) {
    const [a, b] = s.split('-').map(Number);
    if (b < a || b - a > 50) return null; // invalid range
    const arr = [];
    for (let i = a; i <= b; i++) arr.push(i);
    return arr;
  }
  const nums = s.split(',').map(x => parseInt(x.trim(), 10));
  if (nums.some(isNaN)) return null;
  return nums;
}

function emptySlot(round, table) {
  return { round, table, nsPair: '', ewPair: '', boards: '' };
}

export default function ManualMovementPage() {
  const { id }       = useParams();
  const { apiFetch } = useAuth();
  const nav          = useNavigate();

  const [session,   setSession]   = useState(null);
  const [slots,     setSlots]     = useState([]);   // flat array of all slots
  const [openRound, setOpenRound] = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [errors,    setErrors]    = useState({});   // key: "r{round}t{table}" → message
  const [submitErr, setSubmitErr] = useState('');

  useEffect(() => {
    apiFetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(s => {
        setSession(s);
        // Pre-populate empty slots based on numRounds × tablesCount
        const initial = [];
        for (let r = 1; r <= s.num_rounds; r++) {
          for (let t = 1; t <= s.tables_count; t++) {
            initial.push(emptySlot(r, t));
          }
        }
        setSlots(initial);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const updateSlot = (round, table, field, value) => {
    setSlots(prev => prev.map(s =>
      s.round === round && s.table === table ? { ...s, [field]: value } : s
    ));
    // Clear error for this slot
    const key = `r${round}t${table}`;
    setErrors(e => { const ne = { ...e }; delete ne[key]; return ne; });
  };

  const rounds = session ? Array.from({ length: session.num_rounds }, (_, i) => i + 1) : [];

  const validateAll = () => {
    const errs = {};
    for (const slot of slots) {
      const key = `r${slot.round}t${slot.table}`;
      if (!slot.nsPair || isNaN(parseInt(slot.nsPair))) {
        errs[key] = 'NS pair number required';
      } else if (!slot.ewPair || isNaN(parseInt(slot.ewPair))) {
        errs[key] = 'EW pair number required';
      } else if (!slot.boards.trim()) {
        errs[key] = 'Boards required (e.g. 1-3 or 1,2,3)';
      } else if (parseBoards(slot.boards) === null) {
        errs[key] = 'Invalid board format';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitErr('');
    if (!validateAll()) {
      setSubmitErr('Please fix the errors above before submitting.');
      return;
    }

    // Build movement array
    const movement = slots.map(s => ({
      round:   s.round,
      table:   s.table,
      nsPair:  parseInt(s.nsPair),
      ewPair:  parseInt(s.ewPair),
      boards:  parseBoards(s.boards),
    }));

    setSaving(true);
    try {
      const res  = await apiFetch(`/api/sessions/${id}/movement`, {
        method: 'POST',
        body:   JSON.stringify({ movement }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save movement');
      nav(`/sessions/${id}/setup`);
    } catch (err) {
      setSubmitErr(err.message);
    } finally {
      setSaving(false);
    }
  };

  const roundComplete = (r) => {
    return slots
      .filter(s => s.round === r)
      .every(s => s.nsPair && s.ewPair && s.boards.trim());
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title={`${session?.name} — Movement`} backTo="/sessions" />

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-3">

        {/* Instructions */}
        <div className="card-felt relative p-4 text-sm text-cream-400 space-y-1">
          <p className="text-cream-200 font-semibold">Copy your printed movement card below</p>
          <p>For each round and table, enter NS pair, EW pair, and boards.</p>
          <p>Boards: type <span className="font-mono text-gold-300">1-3</span> for boards 1 to 3,
             or <span className="font-mono text-gold-300">1,2,3</span> for individual boards.</p>
        </div>

        {submitErr && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-3 rounded-lg flex gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            {submitErr}
          </div>
        )}

        {/* Rounds accordion */}
        {rounds.map(rnd => {
          const rndSlots = slots.filter(s => s.round === rnd);
          const isOpen   = openRound === rnd;
          const done     = roundComplete(rnd);
          const hasErr   = rndSlots.some(s => errors[`r${rnd}t${s.table}`]);

          return (
            <div key={rnd} className="card-felt relative overflow-hidden">
              {/* Round header */}
              <button
                onClick={() => setOpenRound(isOpen ? null : rnd)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg text-cream-100">Round {rnd}</span>
                  {hasErr
                    ? <AlertTriangle size={15} className="text-red-400" />
                    : done
                      ? <CheckCircle2 size={15} className="text-green-400" />
                      : null
                  }
                </div>
                {isOpen
                  ? <ChevronUp size={18} className="text-cream-400" />
                  : <ChevronDown size={18} className="text-cream-400" />}
              </button>

              {isOpen && (
                <div className="border-t border-gold-500/20 p-4 space-y-3">
                  {/* Column headers */}
                  <div className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2 text-xs text-cream-400 uppercase tracking-widest px-1">
                    <div>Tbl</div>
                    <div>NS Pair #</div>
                    <div>EW Pair #</div>
                    <div>Boards</div>
                  </div>

                  {rndSlots.map(slot => {
                    const key = `r${rnd}t${slot.table}`;
                    const err = errors[key];
                    return (
                      <div key={slot.table}>
                        <div className={`grid grid-cols-[40px_1fr_1fr_1fr] gap-2 items-center
                                        ${err ? 'opacity-100' : ''}`}>
                          {/* Table number badge */}
                          <div className="w-8 h-8 rounded-lg bg-felt-700 border border-gold-500/20
                                          flex items-center justify-center text-sm font-mono text-cream-400">
                            {slot.table}
                          </div>

                          {/* NS Pair */}
                          <input
                            type="number" min="1" max="30"
                            value={slot.nsPair}
                            onChange={e => updateSlot(rnd, slot.table, 'nsPair', e.target.value)}
                            placeholder="NS"
                            className={`input-felt text-center text-lg font-mono py-2
                              ${err && !slot.nsPair ? 'border-red-500/60' : ''}`}
                          />

                          {/* EW Pair */}
                          <input
                            type="number" min="1" max="30"
                            value={slot.ewPair}
                            onChange={e => updateSlot(rnd, slot.table, 'ewPair', e.target.value)}
                            placeholder="EW"
                            className={`input-felt text-center text-lg font-mono py-2
                              ${err && !slot.ewPair ? 'border-red-500/60' : ''}`}
                          />

                          {/* Boards */}
                          <input
                            type="text"
                            value={slot.boards}
                            onChange={e => updateSlot(rnd, slot.table, 'boards', e.target.value)}
                            placeholder="1-3"
                            className={`input-felt text-center font-mono py-2
                              ${err && !slot.boards ? 'border-red-500/60' : ''}`}
                          />
                        </div>
                        {err && (
                          <p className="text-red-400 text-xs mt-1 ml-10">{err}</p>
                        )}
                      </div>
                    );
                  })}

                  {/* Next round button */}
                  {rnd < rounds.length && (
                    <button
                      onClick={() => setOpenRound(rnd + 1)}
                      className="btn-ghost w-full text-sm mt-2 py-2"
                    >
                      Next: Round {rnd + 1} →
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Submit */}
        <div className="pt-2 space-y-2">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-gold w-full py-3 text-base"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Saving Movement…
              </span>
            ) : (
              'Save Movement & Enter Pair Names →'
            )}
          </button>
          <p className="text-center text-cream-400/50 text-xs">
            You can always come back and edit before starting the session
          </p>
        </div>
      </main>
    </div>
  );
}
