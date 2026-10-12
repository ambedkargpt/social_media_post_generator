import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Two or three ways into the same form - Phone or Email, here - as a rule
 * that slides rather than a pill that fills.
 *
 * Underline rather than Segmented because these are not a filter on one
 * thing: picking one changes which fields exist below. A pill implies the
 * content stays and its contents are filtered; a tab implies the panel
 * changes, which is what happens.
 *
 * Measured, like everything else that slides: Hindi labels are longer, and
 * the bar has to end where the word does.
 */
export default function UnderlineTabs({ options, value, onChange, ariaLabel }) {
  const refs = useRef({});
  const [bar, setBar] = useState(null);
  const [animate, setAnimate] = useState(false);

  const measure = () => {
    const el = refs.current[value];
    if (!el) return;
    setBar({ x: el.offsetLeft, w: el.offsetWidth });
  };

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, options]);

  // Webfonts land after the first paint and change every label's width, so a
  // measurement taken before that is already wrong when anyone sees it.
  useEffect(() => {
    document.fonts?.ready?.then(measure).catch(() => {});
    const ro = new ResizeObserver(measure);
    Object.values(refs.current).forEach((n) => n && ro.observe(n));
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const onKeyDown = (e) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % options.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + options.length) % options.length;
    if (next === null) return;
    e.preventDefault();
    onChange(options[next].value);
  };

  return (
    <div className="np-utabs" role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown}>
      {bar && (
        <span
          aria-hidden="true"
          className="np-utab-bar"
          style={{
            width: bar.w,
            transform: `translateX(${bar.x}px)`,
            transition: animate ? undefined : 'none',
          }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          ref={(n) => { refs.current[o.value] = n; }}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => onChange(o.value)}
          className={`np-utab ${o.value === value ? 'is-active' : ''}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
