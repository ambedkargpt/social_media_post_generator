import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * A rounded pill that opens a small menu, styled like the news feed's sort
 * control. Closes on an outside click or Escape. Labels arrive translated.
 */
export default function PillDropdown({ value, options, onChange, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find((o) => o.id === value) ?? options[0];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/80 px-3.5 py-1.5 text-[12px] font-medium text-[#a3b0d4] transition hover:border-[#3a6bc4]/60 hover:text-white"
      >
        {current?.label}
        <ChevronDown
          size={13}
          strokeWidth={2}
          className={`text-[#6b78a0] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[10rem] overflow-hidden rounded-xl border border-[#1e3260]/70 bg-[#0d1531] shadow-xl"
        >
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === value}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[12.5px] transition hover:bg-[#0f1a3a] ${
                o.id === value ? 'text-[#3f9fff]' : 'text-white/80'
              }`}
            >
              {o.label}
              {o.id === value && <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
