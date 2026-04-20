import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const HOWELL_INFO = {
  3: { pairs: '5 or 6', rounds: 5,  boards: 20 },
  4: { pairs: '7 or 8', rounds: 7,  boards: 21 },
  5: { pairs: '9 or 10', rounds: 9, boards: 18 },
  6: { pairs: '11 or 12', rounds: 11, boards: 'varies' },
};

export default function NewSessionPage() {
  const { apiFetch } = useAuth();
  const nav = useNavigate();

  const [name,         setName]         = useState('');
  const [date,         setDate]         = useState(today());
  const [movementType, setMovementType] = useState('howell');
  const [tables,       setTables]       = useState(3);
  const [numRounds,    setNumRounds]    = useState('');
  const [hasPhantom,   setHasPhantom]   = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);

  const howellInfo = HOWELL_INFO[tables] ?? {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const body = {
        name,
        date,
        movementType,
        tablesCount: tables,
        hasPhantom: movementType === 'howell' ? hasPhantom : false,
      };
      if (movementType === 'manual') {
        if (!numRounds || parseInt(numRounds) < 1) {
          setError('Please enter the number of rounds.');
          setLoading(false);
          return;
        }
        body.numRounds = parseInt(numRounds);
      }

      const res  = await apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session');

      if (data.needsMovement) {
        // Manual movement — go to movement entry page
        nav(`/sessions/${data.id}/movement`);
      } else {
        // Howell — go straight to pair setup
        nav(`/sessions/${data.id}/setup`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title="New Session" backTo="/sessions" />

      <main className="max-w-lg mx-auto px-4 py-8">
        <h2 className="font-display text-2xl text-cream-100 mb-6">Create Session</h2>

        <div className="card-felt relative p-7 space-y-6">
          {error && (
            <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-1.5">Session Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className="input-felt" placeholder="Monday Club Game" required autoFocus />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-1.5">Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="input-felt" required />
            </div>

            {/* Movement Type */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-2">
                Movement Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'howell', label: 'Howell', sub: 'Automatic (recommended)' },
                  { value: 'manual', label: 'Manual', sub: 'Enter your own chart' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMovementType(opt.value)}
                    className={`rounded-xl border py-3 px-4 text-left transition-all
                      ${movementType === opt.value
                        ? 'bg-gold-400/10 border-gold-400 shadow-gold'
                        : 'border-gold-500/30 hover:border-gold-400/50'}`}
                  >
                    <div className={`font-semibold text-sm ${movementType === opt.value ? 'text-gold-300' : 'text-cream-100'}`}>
                      {opt.label}
                    </div>
                    <div className="text-xs text-cream-400 mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Tables */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-2">
                Number of Tables
              </label>
              {movementType === 'howell' ? (
                <>
                  <div className="flex gap-3">
                    {[3, 4, 5, 6].map(t => (
                      <button key={t} type="button" onClick={() => setTables(t)}
                        className={`flex-1 rounded-xl border py-3 transition-all
                          ${tables === t
                            ? 'bg-gold-400 border-gold-400 text-felt-950 font-bold'
                            : 'border-gold-500/30 text-cream-300 hover:border-gold-400/60'
                          } ${t === 6 ? 'opacity-70' : ''}`}
                      >
                        <div className="text-xl font-display">{t}</div>
                        <div className="text-xs mt-0.5 opacity-75">tables</div>
                      </button>
                    ))}
                  </div>
                  {tables === 6 && (
                    <p className="text-amber-400 text-xs mt-2">
                      ⚠️ 6-table Howell movement not yet loaded — please provide the movement card.
                    </p>
                  )}
                  {/* Info box */}
                  {HOWELL_INFO[tables] && (
                    <div className="mt-3 bg-felt-700/60 rounded-lg px-4 py-3 text-sm text-cream-400 space-y-0.5">
                      <div>Pairs: <span className="text-cream-100">{howellInfo.pairs}</span></div>
                      <div>Rounds: <span className="text-cream-100">{howellInfo.rounds}</span></div>
                      <div>Boards: <span className="text-cream-100">{howellInfo.boards}</span></div>
                    </div>
                  )}
                  {/* Phantom toggle */}
                  <label className="flex items-center gap-3 cursor-pointer mt-3">
                    <div onClick={() => setHasPhantom(p => !p)}
                      className={`w-11 h-6 rounded-full border transition-all relative
                        ${hasPhantom ? 'bg-gold-400 border-gold-400' : 'bg-felt-700 border-gold-500/30'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
                        ${hasPhantom ? 'left-5' : 'left-0.5'}`} />
                    </div>
                    <div>
                      <p className="text-cream-200 text-sm">Phantom pair (bye)</p>
                      <p className="text-cream-400 text-xs">Enable if you have an odd number of pairs</p>
                    </div>
                  </label>
                </>
              ) : (
                /* Manual mode — free text inputs */
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-cream-400 block mb-1">Number of Tables</label>
                    <input
                      type="number" min="1" max="20"
                      value={tables}
                      onChange={e => setTables(parseInt(e.target.value) || 1)}
                      className="input-felt"
                      placeholder="e.g. 4"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-cream-400 block mb-1">Number of Rounds</label>
                    <input
                      type="number" min="1" max="30"
                      value={numRounds}
                      onChange={e => setNumRounds(e.target.value)}
                      className="input-felt"
                      placeholder="e.g. 7"
                      required={movementType === 'manual'}
                    />
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={loading} className="btn-gold w-full">
              {loading
                ? 'Creating…'
                : movementType === 'manual'
                  ? 'Create → Enter Movement Chart →'
                  : 'Create & Enter Pairs →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function today() { return new Date().toISOString().slice(0, 10); }
