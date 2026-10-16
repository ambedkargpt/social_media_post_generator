import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
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
 * It sits along the bottom of the screen, the way a news channel's crawl does,
 * in the channel's red with a yellow ON AIR tag, big enough to read while it
 * moves. On public pages it is `docked`: fixed to the viewport and portalled
 * to <body>, because a transformed ancestor (the page transition) re-anchors
 * position: fixed to itself. In the dashboard it is the last row of the
 * screen-high column, which puts it at the bottom without fixing anything.
 * Either way it publishes its height as --ticker-h, so the mini player and
 * the page's own bottom padding can stand clear of it.
 *
 * Not on the landing page. There the visitor is being told what the product
 * is, and a live crawl of today's politics is a different conversation; the
 * "Bhim Radio is live" strip is what speaks to them instead.
 */

// Pixels a headline travels per second. Slow enough to read a long Devanagari
// sentence, quick enough that the strip never looks frozen.
const SPEED_PX_PER_SEC = 58;

// The whole strip is the way into the station. `onOpen`, when given, runs
// instead of the plain link - the dashboard passes one that signs out first.
export default function NewsTicker({ className = '', onOpen, docked = false }) {
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

  // How much of the screen bottom the strip takes, for whatever else sits
  // there (the mini player, the page's last lines).
  const stripRef = useRef(null);
  useLayoutEffect(() => {
    const strip = stripRef.current;
    const root = document.documentElement;
    if (!strip) return undefined;
    const publish = () => root.style.setProperty('--ticker-h', `${strip.offsetHeight}px`);
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    ro?.observe(strip);
    return () => { ro?.disconnect(); root.style.removeProperty('--ticker-h'); };
  }, [headline]);

  if (!headline) return null;

  const duration = Math.max(10, copyWidth / SPEED_PX_PER_SEC);

  const strip = (
    <div
      ref={stripRef}
      className={`news-ticker w-full overflow-hidden ${docked ? 'fixed inset-x-0 bottom-0 z-50' : ''} ${className}`}
      role="region"
      aria-label={t('ticker.aria')}
    >
      <Link
        to="/bhimradio"
        onClick={(e) => { if (onOpen) { e.preventDefault(); onOpen(); } }}
        aria-label={t('ticker.open')}
        className="news-ticker-link flex min-h-[46px] items-center md:min-h-[54px]"
      >

        {/* The label sits still while the headline moves past it, the way a
            channel's bug does. Opaque, so the crawl slides under it cleanly. */}
        <span className="news-ticker-tag z-10 flex shrink-0 items-center gap-2 self-stretch px-3 text-[12px] font-extrabold uppercase tracking-widest md:px-4 md:text-[14px]">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {playing && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
          </span>
          <Radio size={15} strokeWidth={2.6} />
          {t('ticker.label')}
        </span>

        <div ref={viewportRef} className="relative min-w-0 flex-1 overflow-hidden">
          {/* Measured, never shown: the sentence at its natural width, with no
              padding to full width, so remeasure() cannot read back its own
              result. */}
          <span
            ref={measureRef}
            aria-hidden="true"
            className="news-ticker-text pointer-events-none invisible absolute left-0 top-0 whitespace-nowrap px-10"
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
                className="news-ticker-text shrink-0 whitespace-nowrap px-10 text-white"
                style={{ minWidth: copyWidth ? `${copyWidth}px` : undefined }}
              >
                {headline}
              </span>
            ))}
          </div>
        </div>
      </Link>

      <style>{`
        /* A channel crawl: a red band with a gold rule along its top, the tag
           in yellow, the headline in large white type. */
        .news-ticker {
          background: linear-gradient(90deg, #a50e16 0%, #d4141f 50%, #a50e16 100%);
          border-top: 3px solid #ffc72c;
          box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.35);
        }
        .news-ticker-tag { background: #ffc72c; color: #1a0306; }
        .news-ticker-text { font-size: 17px; font-weight: 700; letter-spacing: 0.01em; }
        @media (min-width: 768px) { .news-ticker-text { font-size: 20px; } }
        .news-ticker-link { cursor: pointer; text-decoration: none; }
        .news-ticker-link:focus-visible { outline: 3px solid #ffc72c; outline-offset: -3px; }
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

  return docked ? createPortal(strip, document.body) : strip;
}
