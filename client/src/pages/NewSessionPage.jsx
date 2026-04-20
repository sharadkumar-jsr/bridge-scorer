import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const TABLE_INFO = {
  3: { pairs: '5 or 6', rounds: 5,  boards: 20 },
  4: { pairs: '7 or 8', rounds: 7,  boards: 21 },
  5: { pairs: '9 or 10', rounds: 9, boards: 18 },
};

export default function NewSessionPage() {
  const { apiFetch } = useAuth();
  const nav = useNavigate();

  const [name,       setName]       = useState('');
  const [date,       setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [tables,     setTables]     = useState(3);
  const [hasPhantom, setHasPhantom] = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  const info = TABLE_INFO[tables] ?? {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await apiFetch('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          name,
          date,
          tablesCount: tables,
          hasPhantom,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create session');
      nav(`/sessions/${data.id}/setup`);
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
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-1.5">
                Session Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="input-felt"
                placeholder="Monday Club Game"
                required
                autoFocus
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input-felt"
                required
              />
            </div>

            {/* Tables */}
            <div>
              <label className="text-xs text-cream-400 uppercase tracking-widest block mb-2">
                Number of Tables
              </label>
              <div className="flex gap-3">
                {[3, 4, 5].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTables(t)}
                    className={`flex-1 rounded-xl border py-3 transition-all
                      ${tables === t
                        ? 'bg-gold-400 border-gold-400 text-felt-950 font-bold'
                        : 'border-gold-500/30 text-cream-300 hover:border-gold-400/60'
                      }`}
                  >
                    <div className="text-xl font-display">{t}</div>
                    <div className="text-xs mt-0.5 opacity-75">tables</div>
                  </button>
                ))}
              </div>

              {/* Info box */}
              <div className="mt-3 bg-felt-700/60 rounded-lg px-4 py-3 text-sm text-cream-400 space-y-0.5">
                <div>Pairs: <span className="text-cream-100">{info.pairs}</span></div>
                <div>Rounds: <span className="text-cream-100">{info.rounds}</span></div>
                <div>Boards: <span className="text-cream-100">{info.boards}</span></div>
              </div>
            </div>

            {/* Phantom */}
            <label className="flex items-center gap-3 cursor-pointer group">
              <div
                onClick={() => setHasPhantom(p => !p)}
                className={`w-11 h-6 rounded-full border transition-all
                  ${hasPhantom ? 'bg-gold-400 border-gold-400' : 'bg-felt-700 border-gold-500/30'}
                  relative`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all
                  ${hasPhantom ? 'left-5' : 'left-0.5'}`} />
              </div>
              <div>
                <p className="text-cream-200 text-sm">Phantom pair (bye)</p>
                <p className="text-cream-400 text-xs">Enable if you have an odd number of pairs</p>
              </div>
            </label>

            <button type="submit" disabled={loading} className="btn-gold w-full">
              {loading ? 'Creating…' : 'Create & Enter Pairs →'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
