import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';

import { useRadio } from '../context/RadioContext';
import { useI18n } from '../i18n/index.jsx';

/**
 * The headline strip: what the station is on, scrolling the way a news channel
 * runs its crawl.
 *
 * It follows the broadcast, not the audio. The bulletin runs on a clock
 * whether anyone is listening or not, so the headline here keeps changing for
 * a reader who never tuned in and for one who tuned out - which is the point.
 * A site with a radio in it should look like it is on even when it is quiet.
 *
 * Not on the landing page. There the visitor is being told what the product
 * is, and a live crawl of today's politics is a different conversation; the
 * "Bhim Radio is live" strip is what speaks to them instead.
 */

// Pixels a headline travels per second. Slow enough to read a long Devanagari
// sentence, quick enough that the strip never looks frozen.
const SPEED_PX_PER_SEC = 58;

export default function NewsTicker({ className = '' }) {
  const { t } = useI18n();
  const { station, track, playing, primeStation } = useRadio();

  const viewportRef = useRef(null);
  const measureRef = useRef(null);
  const [copyWidth, setCopyWidth] = useState(0);

  // Ask for the manifest without opening the player. Without this the strip
  // would stay empty until someone visited the radio page.
  useEffect(() => { primeStation(); }, [primeStation]);

  const headline = track?.title || station?.title || '';

  /**
   * How wide one pass is.
   *
   * At least the width of the strip, even when the sentence is shorter. Two
   * copies sitting at their natural width are both on screen at once on a wide
   * monitor, so the second one appears to start in the middle of the page
   * rather than entering from the right edge - which is not a crawl, it is two
   * labels sliding. Padding each pass out to the full width puts the next
   * headline exactly at the right-hand edge as the last one leaves.
   *
   * Measured from a copy that is never padded, so this cannot feed back into
   * itself and grow on every pass.
   */
  const remeasure = useCallback(() => {
    const viewport = viewportRef.current;
    const text = measureRef.current;
    if (!viewport || !text) return;
    const natural = text.scrollWidth;
    if (natural > 0) setCopyWidth(Math.max(natural, viewport.clientWidth));
  }, []);

  useLayoutEffect(() => {
    remeasure();
    // A sidebar collapsing or a window resize changes how far a pass has to
    // travel; without this the crawl keeps the old width and either overlaps
    // itself or leaves a gap.
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(remeasure);
    ro.observe(viewport);
    return () => ro.disconnect();
  }, [headline, remeasure]);

  if (!headline) return null;

  const duration = Math.max(10, copyWidth / SPEED_PX_PER_SEC);

  return (
    <div
      className={`w-full overflow-hidden border-b border-[#1b2a52] ${className}`}
      style={{ background: 'linear-gradient(90deg, #070c20 0%, #0c1536 50%, #070c20 100%)' }}
      role="region"
      aria-label={t('ticker.aria')}
    >
      <div className="flex min-h-[38px] items-center">

        {/* The label sits still while the headline moves past it, the way a
            channel's bug does. Opaque, so the crawl slides under it cleanly. */}
        <span
          className="z-10 flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-[11px] font-bold uppercase tracking-widest text-red-300"
          style={{ background: '#070c20' }}
        >
          <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
            {playing && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
            )}
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
          </span>
          <Radio size={12} strokeWidth={2.4} />
          {t('ticker.label')}
        </span>

        <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden">
          {/* Measured, never shown: the sentence at its natural width, with no
              padding to full width, so remeasure() cannot read back its own
              result. */}
          <span
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap px-10 text-[14px] font-semibold"
          >
            {headline}
          </span>

          {/* Two passes, translated by exactly half the pair: as the first
              leaves on the left, the second is arriving at the right edge, so
              the loop has no seam and no jump. `key` restarts the run when the
              broadcast moves to the next story. */}
          <div
            key={headline}
            className="news-ticker-track flex w-max items-center"
            style={{ animationDuration: `${duration}s` }}
          >
            {[0, 1].map((copy) => (
              <span
                key={copy}
                aria-hidden={copy === 1}
                className="shrink-0 whitespace-nowrap px-10 text-[14px] font-semibold text-[#cfdcf2]"
                style={{ minWidth: copyWidth ? `${copyWidth}px` : undefined }}
              >
                {headline}
              </span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes news-ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .news-ticker-track {
          animation-name: news-ticker-scroll;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .news-ticker-track:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          /* Still readable, just not moving: the second copy would otherwise
             sit there as a duplicate sentence. */
          .news-ticker-track { animation: none; }
          .news-ticker-track > span[aria-hidden="true"] { display: none; }
        }
      `}</style>
    </div>
  );
}
