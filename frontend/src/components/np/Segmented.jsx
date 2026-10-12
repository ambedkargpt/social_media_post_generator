import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * A small set of exclusive options, with the selection sliding between them.
 *
 * The indicator is one absolutely positioned element moved with transform,
 * not a background that fades on each segment. That is the difference
 * between "the selection moved" and "one thing went out while another came
 * in", and it costs one element and no repaints.
 *
 * Measured rather than calculated: segments are as wide as their labels, and
 * the Hindi label for the same option is routinely 30% longer than the
 * English one.
 */
export default function Segmented({
  options,              // [{ value, label }]
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className = '',
  style,
}) {
  const wrapRef = useRef(null);
  const refs = useRef({});
  const [box, setBox] = useState(null);

  const h = size === 'sm' ? 36 : 42;

  const measure = () => {
    const el = refs.current[value];
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    setBox({ x: el.offsetLeft, w: el.offsetWidth });
  };

  // Layout effect, so the indicator is already in place on the first paint
  // rather than jumping from zero after it.
  useLayoutEffect(measure, [value, options]);

  // Fonts land after first paint and change every label's width, so a
  // measurement taken before that is wrong by the time anyone sees it.
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (wrapRef.current) ro.observe(wrapRef.current);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div
      ref={wrapRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={`np-segmented ${className}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        gap: 0,
        padding: 3,
        borderRadius: 10,
        border: '1px solid var(--color-np-rule)',
        background: 'transparent',
        ...style,
      }}
    >
      {box && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 3,
            height: h,
            width: box.w,
            borderRadius: 8,
            background: 'var(--color-np-active)',
            transform: `translateX(${box.x}px)`,
            transition: 'transform var(--np-dur-2) var(--np-ease-out), width var(--np-dur-2) var(--np-ease-out)',
            pointerEvents: 'none',
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(n) => { refs.current[o.value] = n; }}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            style={{
              position: 'relative',
              height: h,
              padding: '0 16px',
              borderRadius: 8,
              border: 'none',
              background: 'transparent',
              color: active ? 'var(--color-np-text)' : 'var(--color-np-muted)',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'color var(--np-dur-1) var(--np-ease-out)',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
