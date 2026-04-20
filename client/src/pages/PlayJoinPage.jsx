import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, Delete } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext.jsx';

export default function PlayJoinPage() {
  const { token }        = useParams();
  const { joinAsPlayer } = usePlayer();
  const nav              = useNavigate();

  const [session,      setSession]      = useState(null);
  const [pairs,        setPairs]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  // Step 1 = select pair, Step 2 = enter PIN
  const [step,         setStep]         = useState(1);
  const [selectedPair, setSelectedPair] = useState(null);
  const [pin,          setPin]          = useState('');
  const [joining,      setJoining]      = useState(false);
  const [pinError,     setPinError]     = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/play/${token}`).then(r => r.json()),
      fetch(`/api/play/${token}/pairs`).then(r => r.json()),
    ])
    .then(([s, p]) => {
      if (s.error) throw new Error(s.error);
      setSession(s);
      setPairs(p);
    })
    .catch(e => setError(e.message))
    .finally(() => setLoading(false));
  }, [token]);

  // PIN pad digit press
  const pressDigit = (d) => {
    if (pin.length < 4) setPin(p => p + d);
  };
  const backspace = () => setPin(p => p.slice(0, -1));
  const clearPin  = () => setPin('');

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) handleJoin();
  }, [pin]);

  const handleSelectPair = (pair) => {
    setSelectedPair(pair);
    setPin('');
    setPinError('');
    setStep(2);
  };

  const handleJoin = async () => {
    if (pin.length !== 4) return;
    setJoining(true); setPinError('');
    try {
      const res  = await fetch(`/api/play/${token}/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pairNumber: selectedPair.pair_number, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPin('');
        throw new Error(data.error ?? 'Join failed');
      }
      joinAsPlayer({
        token:        data.playerToken,
        pairNumber:   data.pair.pair_number,
        player1Name:  data.pair.player1_name,
        player2Name:  data.pair.player2_name,
        sessionId:    data.session.id,
        sessionName:  data.session.name,
        sessionToken: token,
      });
      nav(`/play/${token}/score`);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-gold-400" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-felt-gradient flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-4xl mb-4 text-gold-500/30 select-none">♠ ♥ ♦ ♣</div>
        <p className="text-red-400 text-lg">{error}</p>
        <p className="text-cream-400 text-sm mt-2">Check the link and try again.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-felt-gradient flex flex-col items-center justify-center px-4 py-8">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="text-4xl mb-3 tracking-widest text-gold-400 select-none">♠ ♥ ♦ ♣</div>
        <h1 className="font-display text-2xl text-cream-100">{session?.name}</h1>
        <p className="text-cream-400 text-sm mt-1">{session?.date}</p>
      </div>

      <div className="w-full max-w-sm">

        {/* ── STEP 1: Select Pair ── */}
        {step === 1 && (
          <div className="card-felt relative p-6">
            <h2 className="font-display text-lg text-cream-100 mb-1">Which pair are you?</h2>
            <p className="text-cream-400 text-sm mb-5">Tap your pair number</p>

            <div className="space-y-2">
              {pairs.map(p => {
                const names = [p.player1_name, p.player2_name].filter(Boolean).join(' / ');
                return (
                  <button
                    key={p.pair_number}
                    onClick={() => handleSelectPair(p)}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-xl
                               border border-gold-500/30 hover:border-gold-400/70
                               hover:bg-gold-400/5 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gold-400/10 border border-gold-400/30
                                    flex items-center justify-center font-display text-gold-300 text-lg flex-shrink-0">
                      {p.pair_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-cream-100 font-semibold text-sm">Pair {p.pair_number}</div>
                      <div className="text-cream-400 text-xs truncate">
                        {names || 'Players not yet named'}
                      </div>
                    </div>
                    <div className="text-gold-400 text-lg">›</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STEP 2: Enter PIN ── */}
        {step === 2 && selectedPair && (
          <div className="card-felt relative p-6">
            {/* Back */}
            <button
              onClick={() => { setStep(1); setPin(''); setPinError(''); }}
              className="text-cream-400 hover:text-gold-300 text-sm mb-4 flex items-center gap-1"
            >
              ← Back
            </button>

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-gold-400/10 border border-gold-400/30
                              flex items-center justify-center font-display text-gold-300 text-2xl mx-auto mb-2">
                {selectedPair.pair_number}
              </div>
              <p className="text-cream-100 font-semibold">Pair {selectedPair.pair_number}</p>
              {[selectedPair.player1_name, selectedPair.player2_name].filter(Boolean).length > 0 && (
                <p className="text-cream-400 text-sm">
                  {[selectedPair.player1_name, selectedPair.player2_name].filter(Boolean).join(' / ')}
                </p>
              )}
              <p className="text-cream-400/60 text-sm mt-3">Enter your 4-digit PIN</p>
              <p className="text-cream-400/40 text-xs">(Given to you by the director)</p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4 mb-4">
              {[0,1,2,3].map(i => (
                <div key={i}
                  className={`w-5 h-5 rounded-full border-2 transition-all
                    ${i < pin.length
                      ? 'bg-gold-400 border-gold-400'
                      : 'border-cream-400/30 bg-transparent'}`}
                />
              ))}
            </div>

            {pinError && (
              <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm
                              px-3 py-2 rounded-lg mb-4 text-center">
                {pinError}
              </div>
            )}

            {joining && (
              <div className="flex justify-center mb-4">
                <Loader2 size={20} className="animate-spin text-gold-400" />
              </div>
            )}

            {/* PIN pad */}
            {!joining && (
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3,4,5,6,7,8,9].map(d => (
                  <button
                    key={d}
                    onClick={() => pressDigit(String(d))}
                    disabled={pin.length >= 4}
                    className="h-14 rounded-xl border border-gold-500/30 font-mono text-2xl
                               text-cream-100 hover:bg-gold-400/10 hover:border-gold-400/60
                               transition-all active:scale-95 disabled:opacity-30"
                  >
                    {d}
                  </button>
                ))}
                {/* Bottom row: clear, 0, backspace */}
                <button
                  onClick={clearPin}
                  className="h-14 rounded-xl border border-gold-500/20 text-xs text-cream-400
                             hover:border-red-500/40 hover:text-red-400 transition-all"
                >
                  CLR
                </button>
                <button
                  onClick={() => pressDigit('0')}
                  disabled={pin.length >= 4}
                  className="h-14 rounded-xl border border-gold-500/30 font-mono text-2xl
                             text-cream-100 hover:bg-gold-400/10 hover:border-gold-400/60
                             transition-all active:scale-95 disabled:opacity-30"
                >
                  0
                </button>
                <button
                  onClick={backspace}
                  className="h-14 rounded-xl border border-gold-500/20 text-cream-400
                             hover:border-gold-400/40 hover:text-gold-300 transition-all
                             flex items-center justify-center"
                >
                  <Delete size={20} />
                </button>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-cream-400/40 text-xs mt-6">
          Only enter your own pair number and PIN
        </p>
      </div>
    </div>
  );
}
