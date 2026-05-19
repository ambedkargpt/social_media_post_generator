import { Sparkles, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '../LanguageSwitcher';

export default function Topbar({ user }) {
  const navigate = useNavigate();
  const name  = user?.name  ?? '—';
  const initial = (name?.[0] ?? 'A').toUpperCase();

  return (
    <div className="flex items-center justify-between gap-4 pt-7 pb-6">
      {/* Generate CTA (centered visually) */}
      <div className="flex-1 flex items-center">
        <button
          type="button"
          onClick={() => navigate('/generate')}
          className="inline-flex items-center gap-2 rounded-full btn-gradient px-5 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_28px_rgba(17,122,255,0.4)]"
        >
          <Sparkles size={15} strokeWidth={2.1} />
          Generate
        </button>
      </div>

      {/* language + notifications + user */}
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#1a254a]/70 bg-[#0d1531]/60 text-[#a3b0d4] transition hover:border-[#2a4375]/80 hover:text-white"
        >
          <Bell size={16} strokeWidth={1.9} />
          <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-[#ff4b7d] shadow-[0_0_8px_rgba(255,75,125,0.7)]" />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-[13.5px] font-semibold text-white">{name}</div>
          </div>
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#3f9fff]/50 bg-gradient-to-br from-[#2b3e7a] to-[#1a2654] text-[13px] font-semibold text-white shadow-[0_0_14px_rgba(63,159,255,0.25)]">
              {initial}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#070b1c] bg-[#22c55e]" />
          </div>
        </div>
      </div>
    </div>
  );
}
