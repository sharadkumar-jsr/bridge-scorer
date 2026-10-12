import { useState } from 'react';
import { Loader2, FileDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadFromApi } from '../utils/download.js';

// Two printable PDFs for the director:
//   • Round 1 table sheet — to circulate to players before the session
//   • PIN sheet           — private, for when a player forgets their PIN
export default function SheetDownloads({ sessionId, onError }) {
  const { apiFetch } = useAuth();
  const [busy, setBusy] = useState('');

  const get = async (kind, filename) => {
    setBusy(kind);
    try {
      await downloadFromApi(apiFetch, `/api/sessions/${sessionId}/sheets/${kind}`, filename);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusy('');
    }
  };

  const Btn = ({ kind, filename, label, hint }) => (
    <button
      onClick={() => get(kind, filename)}
      disabled={!!busy}
      className="btn-ghost flex-1 flex flex-col items-center justify-center gap-0.5 py-3 disabled:opacity-60"
    >
      <span className="flex items-center gap-2 text-sm">
        {busy === kind ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
        {label}
      </span>
      <span className="text-[11px] text-cream-400/60">{hint}</span>
    </button>
  );

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Btn kind="tables" filename="round1-tables.pdf"
           label="Round 1 Table Sheet (PDF)" hint="Share with players" />
      <Btn kind="pins" filename="pair-pins.pdf"
           label="PIN Sheet (PDF)" hint="Director only — keep private" />
    </div>
  );
}
