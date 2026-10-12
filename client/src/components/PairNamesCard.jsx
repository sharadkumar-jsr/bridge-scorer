import { useState } from 'react';
import { Loader2, Check, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import SheetDownloads from './SheetDownloads.jsx';

// Director tools shown once a session is running:
//  • printable sheets (Round 1 tables, PINs)
//  • change a pair's player names — allowed until the first score is entered
//    (e.g. a player drops out at the last minute). The server enforces the lock.
export default function PairNamesCard({ sessionId, pairs, editable, onSaved }) {
  const { apiFetch } = useAuth();
  const [open,   setOpen]   = useState(false);
  const [drafts, setDrafts] = useState({});   // pairNumber -> { player1_name?, player2_name? }
  const [saving, setSaving] = useState({});
  const [saved,  setSaved]  = useState({});
  const [error,  setError]  = useState('');

  const real = (pairs ?? []).filter(p => p && !p.is_phantom)
    .sort((a, b) => a.pair_number - b.pair_number);

  const value = (p, f) => drafts[p.pair_number]?.[f] ?? p[f] ?? '';
  const dirty = (p) => {
    const d = drafts[p.pair_number];
    if (!d) return false;
    return ['player1_name', 'player2_name'].some(f => f in d && (d[f] ?? '') !== (p[f] ?? ''));
  };
  const edit = (p, f, v) =>
    setDrafts(prev => ({ ...prev, [p.pair_number]: { ...prev[p.pair_number], [f]: v } }));

  const save = async (p) => {
    setSaving(s => ({ ...s, [p.pair_number]: true }));
    setError('');
    try {
      const res = await apiFetch(`/api/sessions/${sessionId}/pairs/${p.pair_number}`, {
        method: 'PUT',
        body: JSON.stringify({
          player1Name: value(p, 'player1_name'),
          player2Name: value(p, 'player2_name'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Could not save names');
      setDrafts(prev => { const n = { ...prev }; delete n[p.pair_number]; return n; });
      setSaved(s => ({ ...s, [p.pair_number]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [p.pair_number]: false })), 2500);
      await onSaved?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(s => ({ ...s, [p.pair_number]: false }));
    }
  };

  return (
    <div className="card-felt relative p-4 space-y-3">
      <p className="text-xs text-cream-400 uppercase tracking-widest">Pair Names &amp; Printable Sheets</p>

      <SheetDownloads sessionId={sessionId} onError={setError} />

      {error && (
        <div className="bg-red-900/40 border border-red-700/50 text-red-300 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {editable ? (
        <>
          <button
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between text-sm text-cream-300
                       hover:text-gold-300 border border-gold-500/20 rounded-lg px-4 py-2.5 transition-colors"
          >
            <span>Change player names <span className="text-cream-400/60">(until the first score is entered)</span></span>
            {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {open && (
            <div className="space-y-2">
              {real.map(p => (
                <div key={p.pair_number} className="flex items-center gap-2">
                  <div className="w-14 flex-shrink-0 text-center">
                    <div className="text-gold-300 font-display text-sm">Pair {p.pair_number}</div>
                  </div>
                  <input className="input-felt text-sm flex-1 min-w-0" placeholder="Player 1" maxLength={60}
                         value={value(p, 'player1_name')}
                         onChange={e => edit(p, 'player1_name', e.target.value)} />
                  <input className="input-felt text-sm flex-1 min-w-0" placeholder="Player 2" maxLength={60}
                         value={value(p, 'player2_name')}
                         onChange={e => edit(p, 'player2_name', e.target.value)} />
                  <div className="w-16 flex-shrink-0 flex justify-end">
                    {saving[p.pair_number] ? (
                      <Loader2 size={15} className="animate-spin text-cream-400" />
                    ) : saved[p.pair_number] ? (
                      <Check size={15} className="text-green-400" />
                    ) : dirty(p) ? (
                      <button onClick={() => save(p)} className="btn-gold text-xs py-1 px-3">Save</button>
                    ) : null}
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-cream-400/60 pt-1">
                Pair numbers and PINs do not change — only the names. Re-download the sheets afterwards
                if you have already printed them.
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-cream-400/70 flex items-center gap-1.5">
          <Lock size={12} /> Player names are locked because scoring has started.
        </p>
      )}
    </div>
  );
}
