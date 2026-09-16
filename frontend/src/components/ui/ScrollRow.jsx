import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A row that scrolls sideways on its own.
 *
 * Chip rows — tones, categories — are wider than a phone. Left to overflow
 * they either push the whole page sideways or show a chip sliced in half at
 * the right edge, which reads as "this is cut off" rather than "there is
 * more". This scrolls inside itself, hides its scrollbar, and fades its right
 * edge only while there is still something to scroll to, so the last chip is
 * never left half-faded once you reach the end.
 *
 * It fades nothing when the row fits, which is what happens at the widths
 * where the chips wrap instead.
 */
export default function ScrollRow({ children, className = '', ...rest }) {
  const ref = useRef(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setMore(el.scrollWidth - el.clientWidth - el.scrollLeft > 8);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // children: a filter that changes the chips changes what there is to scroll.
  }, [measure, children]);

  return (
    <div
      ref={ref}
      onScroll={measure}
      className={`scroll-row flex overflow-x-auto ${more ? 'scroll-row--more' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
