import { useCallback, useEffect, useState } from 'react';

/**
 * How much a fixed-viewBox chart is being stretched by.
 *
 * An SVG drawn in a 520-unit viewBox is stretched to whatever width its card
 * happens to be, and it stretches the type in it by the same amount: the same
 * axis label rendered around 11px on a wide desktop card and 7px on a phone.
 * Multiplying a font size by this ratio renders it at a constant size at every
 * width, which is why the charts can be read on a phone without being redrawn
 * for one.
 *
 * Returns [ref, scale]. The ref is a callback ref rather than an object one
 * because the element it goes on is mounted only once the chart has data, and
 * an effect keyed on the ref object would have run and finished before that.
 */
export default function useChartScale(viewBoxWidth) {
  const [node, setNode] = useState(null);
  const [scale, setScale] = useState(1);
  const ref = useCallback((el) => setNode(el), []);

  useEffect(() => {
    if (!node) return undefined;
    function measure(width) {
      // Bounded: past these the labels would either crowd the plot or shrink
      // into it, and neither is better than a slightly off size.
      if (width > 0) setScale(Math.min(2.1, Math.max(0.85, viewBoxWidth / width)));
    }
    measure(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    ro.observe(node);
    return () => ro.disconnect();
  }, [node, viewBoxWidth]);

  return [ref, scale];
}
