/**
 * Which channel a story was scraped from — a development-only marker.
 *
 * General news is one feed fed by more than one channel (Ravish Kumar and
 * Dalit Dastak today), and once the stories are mixed into the list there is
 * nothing on screen that tells them apart. This says so while working locally.
 *
 * `import.meta.env.DEV` is true under `vite dev` and is replaced with the
 * literal `false` by `vite build`, so the whole component folds away and
 * cannot reach production. The dashed border and the mono type mark it as
 * scaffolding rather than product chrome, in case it is ever seen in a demo.
 */
export default function DevSourceTag({ source, className = '' }) {
  if (!import.meta.env.DEV || !source) return null;

  return (
    <span
      title="Development only — the channel this story was scraped from"
      className={`inline-flex shrink-0 items-center gap-1 rounded border border-dashed border-[#c9922f]/70 bg-[#2a2210]/70 px-1.5 py-0.5 font-count text-[10px] font-semibold uppercase tracking-wider text-[#e0b552] ${className}`}
    >
      <span aria-hidden="true">·</span>
      {source}
    </span>
  );
}
