import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SetupPairsPage() {
  const { id } = useParams();
  const { apiFetch } = useAuth();
  const nav = useNavigate();

  const [session, setSession] = useState(null);
  const [pairs,   setPairs]   = useState([]);
  const [saving,  setSaving]  = useState({});
  const [saved,   setSaved]   = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    apiFetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(data => {
        setSession(data);
        // Sort real pairs first, phantom last
        setPairs([...(data.pairs ?? [])].sort((a, b) => a.pair_number - b.pair_number));
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const updatePair = (pairNum, field, value) => {
    setPairs(prev => prev.map(p =>
      p.pair_number === pairNum ? { ...p, [field]: value } : p
    ));
  };

  const savePair = async (pair) => {
    setSaving(s => ({ ...s, [pair.pair_number]: true }));
    try {
      await apiFetch(`/api/sessions/${id}/pairs/${pair.pair_number}`, {
        method: 'PUT',
        body: JSON.stringify({
          player1Name: pair.player1_name,
          player2Name: pair.player2_name,
        }),
      });
      setSaved(s => ({ ...s, [pair.pair_number]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [pair.pair_number]: false })), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(s => ({ ...s, [pair.pair_number]: false }));
    }
  };

  const startSession = async () => {
    setStarting(true);
    try {
      await apiFetch(`/api/sessions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'active' }),
      });
      nav(`/sessions/${id}/director`);
    } catch (err) {
      setError(err.message);
      setStarting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  const realPairs = pairs.filter(p => !p.is_phantom);

  return (
    <div className="min-h-screen bg-felt-gradient">
      <Navbar title={session?.name ?? 'Setup Pairs'} backTo="/sessions" />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-display text-2xl text-cream-100">Enter Pair Names</h2>
            <p className="text-cream-400 text-sm mt-0.5">Names are optional — you can start without them</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-4 py-2.5 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="space-y-3 mb-6">
          {realPairs.map(pair => (
            <div key={pair.pair_number} className="card-felt relative p-4 flex items-center gap-4">
              {/* Pair number badge */}
              <div className="w-9 h-9 rounded-full bg-gold-400/10 border border-gold-400/30
                              flex items-center justify-center font-display text-gold-300 text-sm flex-shrink-0">
                {pair.pair_number}
              </div>

              {/* Name inputs */}
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  className="input-felt text-sm"
                  placeholder="Player 1"
                  value={pair.player1_name ?? ''}
                  onChange={e => updatePair(pair.pair_number, 'player1_name', e.target.value)}
                  onBlur={() => savePair(pair)}
                />
                <input
                  className="input-felt text-sm"
                  placeholder="Player 2"
                  value={pair.player2_name ?? ''}
                  onChange={e => updatePair(pair.pair_number, 'player2_name', e.target.value)}
                  onBlur={() => savePair(pair)}
                />
              </div>

              {/* Save indicator */}
              <div className="w-6 flex-shrink-0 text-center">
                {saving[pair.pair_number] && <Loader2 size={14} className="animate-spin text-cream-400" />}
                {saved[pair.pair_number]  && <Check size={14} className="text-green-400" />}
              </div>
            </div>
          ))}
        </div>

        {/* Start button */}
        <button onClick={startSession} disabled={starting} className="btn-gold w-full text-base py-3">
          {starting ? 'Starting…' : 'Start Session →'}
        </button>
      </main>
    </div>
  );
}
