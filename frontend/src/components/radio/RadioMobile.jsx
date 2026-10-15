import { useState } from 'react';
import { AudioLines, Clock, Pause, Play } from 'lucide-react';

import { useI18n } from '../../i18n/index.jsx';
import ShareMenu from './ShareMenu.jsx';
import { Label, SignalMeter, Transcript } from './deskParts.jsx';
import { ACCENT, ACCENT_HOVER, INK, MUTED, RULE, SURFACE, airTime, istClock, mmss } from './radioTokens';

/**
 * The station on a phone - news first.
 *
 * The desk is two columns and a footer of controls, which on a phone stacks
 * into a long scroll with the play button somewhere in it. Here the player is
 * a compact card at the top (what is on, and the one button), then the story
 * read like an article, then what is coming as cards you swipe through.
 *
 * Fed the same derived state as the desk and the tape, so it cannot show a
 * different story from them.
 */

const UP_NEXT_CARDS = 10;
const RED = '#ff4d4d';

function minutes(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

export default function RadioMobile({
  now, story, storyIndex, total, offsetInStory, storyDuration, textOffset, textDuration,
  upcoming, listening, onTune, canTune, nextInSec, progress,
}) {
  const { t } = useI18n();
  const [showAll, setShowAll] = useState(false);

  const next = upcoming.filter((row) => row.state === 'next');
  const cards = next.slice(0, UP_NEXT_CARDS);

  return (
    <div className="bhim-m">
      {/* ── the player ── */}
      <section className="bhim-m-player" aria-label={t('radio.title')}>
        <div className="bhim-m-player-top">
          <span className="bhim-m-tile" aria-hidden="true">
            <AudioLines size={26} strokeWidth={2.2} />
          </span>

          <div className="bhim-m-now">
            <span className="bhim-m-station">{t('radio.title')}</span>
            <span className="bhim-m-live">
              <span className="bhim-m-dot" aria-hidden="true" />
              {t('radio.live')}
              <span className="bhim-m-sep" aria-hidden="true">·</span>
              <span className="bhim-m-clock">{istClock(now)} IST</span>
            </span>
            <span lang="hi" className="bhim-m-headline-mini">
              {story?.title || t('radio.opening')}
            </span>
          </div>

          <button
            type="button"
            className="bhim-m-play"
            onClick={onTune}
            disabled={!canTune}
            aria-pressed={listening}
            aria-label={listening ? t('radio.tuneOff') : t('radio.tuneInAria')}
          >
            {listening
              ? <Pause size={24} fill="currentColor" strokeWidth={0} />
              : <Play size={24} fill="currentColor" strokeWidth={0} style={{ marginLeft: 3 }} />}
          </button>
        </div>

        <div className="bhim-m-player-foot">
          <SignalMeter active={listening} live={canTune} bars={22} />
          <span className="bhim-m-next">{t('radio.nextIn', { time: mmss(nextInSec) })}</span>
        </div>
        <div className="bhim-m-progress" aria-hidden="true">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      </section>

      {/* ── the story ── */}
      <article className="bhim-m-story">
        <div className="bhim-m-labels">
          <Label tone={ACCENT_HOVER}>{t('radio.nowOnAir')}</Label>
          <Label>
            {storyIndex < 0 ? t('radio.opening') : t('radio.storyOf', { n: storyIndex + 1, total })}
          </Label>
        </div>

        <h2 lang="hi" aria-live="polite" className="bhim-m-headline">
          {story?.title || t('radio.title')}
        </h2>

        <p className="bhim-m-aired">
          {t('radio.airedAt', { time: istClock(airTime(now, offsetInStory)) })}
        </p>

        <div className="bhim-m-meta">
          <span className="bhim-m-length">
            <Clock size={16} aria-hidden="true" />
            {t('radio.listenFor', { n: minutes(storyDuration) })}
          </span>
          <ShareMenu headline={story?.title} className="bhim-m-share" align="right" />
        </div>

        <Transcript
          text={story?.text}
          offsetSec={textOffset}
          durationSec={textDuration}
          listening={listening}
          size={18}
        />
      </article>

      {/* ── what is coming ── */}
      {next.length > 0 && (
        <section className="bhim-m-next-up" aria-labelledby="bhim-m-up-next">
          <div className="bhim-m-next-head">
            <h3 id="bhim-m-up-next">{t('radio.upNext')}</h3>
            <button
              type="button"
              className="bhim-m-see-all"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll ? t('radio.showLess') : t('radio.seeAll')}
            </button>
          </div>

          {/* Not buttons: a station has no "skip to", so these are a list of
              what is coming, the same as the desk's running order. */}
          {showAll ? (
            <ol className="bhim-m-list">
              {next.map(({ track, at }) => (
                <li key={`${track.id}-${at.getTime()}`}>
                  <span className="bhim-m-list-time">{istClock(at)}</span>
                  <span lang="hi">{track.title}</span>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="bhim-m-cards">
              {cards.map(({ track, at }, i) => (
                <li key={`${track.id}-${at.getTime()}`} className="bhim-m-card">
                  <span className="bhim-m-card-n">{String(i + 1).padStart(2, '0')}</span>
                  <span lang="hi" className="bhim-m-card-title">{track.title}</span>
                  <span className="bhim-m-card-foot">
                    <Clock size={13} aria-hidden="true" />
                    {istClock(at)}
                    <span aria-hidden="true">·</span>
                    {t('radio.minutes', { n: minutes(track.endSec - track.startSec) })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <style>{`
        .bhim-m { display: flex; flex-direction: column; gap: 22px; }

        .bhim-m-player {
          border: 1px solid ${RULE};
          border-radius: 18px;
          padding: 16px;
          background:
            radial-gradient(120% 140% at 0% 0%, rgba(29, 122, 252, 0.16), transparent 60%),
            ${SURFACE};
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
        }
        .bhim-m-player-top { display: flex; align-items: center; gap: 14px; }
        .bhim-m-tile {
          flex: none; width: 60px; height: 60px; border-radius: 14px;
          display: grid; place-items: center;
          color: ${ACCENT_HOVER};
          background: linear-gradient(160deg, #13235a, #0a1236);
          border: 1px solid ${RULE};
        }
        .bhim-m-now { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .bhim-m-station { font: 600 15px/1.2 var(--font-body, Inter), sans-serif; color: ${ACCENT_HOVER}; }
        .bhim-m-live {
          display: inline-flex; align-items: center; gap: 6px;
          font: 700 11px/1.2 var(--font-body, Inter), sans-serif; letter-spacing: 0.06em;
          color: ${RED};
        }
        .bhim-m-dot { width: 8px; height: 8px; border-radius: 50%; background: ${RED}; }
        .bhim-m-sep { color: ${MUTED}; }
        .bhim-m-clock { color: ${MUTED}; font-weight: 500; letter-spacing: 0; font-variant-numeric: tabular-nums; }
        .bhim-m-headline-mini {
          font: 500 14px/1.45 var(--font-hindi); color: ${INK};
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .bhim-m-play {
          flex: none; width: 56px; height: 56px; border-radius: 50%;
          display: grid; place-items: center;
          border: 0; background: ${ACCENT}; color: #fff; cursor: pointer;
          box-shadow: 0 6px 18px rgba(29, 122, 252, 0.45);
          transition: transform .15s ease, filter .15s ease;
        }
        .bhim-m-play[aria-pressed="true"] { background: #fff; color: ${ACCENT}; }
        .bhim-m-play:active:not(:disabled) { transform: scale(0.94); }
        .bhim-m-play:disabled { opacity: 0.4; cursor: not-allowed; box-shadow: none; }
        .bhim-m-player-foot {
          display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
          margin-top: 14px;
        }
        .bhim-m-next {
          font: 500 12px/1 ui-monospace, monospace; color: ${MUTED};
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .bhim-m-progress { height: 4px; border-radius: 4px; background: ${RULE}; margin-top: 10px; overflow: hidden; }
        .bhim-m-progress > div { height: 100%; border-radius: 4px; background: ${ACCENT}; }

        .bhim-m-story { display: flex; flex-direction: column; gap: 12px; }
        .bhim-m-labels { display: flex; gap: 14px; flex-wrap: wrap; }
        .bhim-m-headline {
          margin: 0; color: ${INK};
          font: 700 28px/1.35 var(--font-hindi);
          text-wrap: balance;
        }
        .bhim-m-aired { margin: 0; font-size: 13px; color: ${MUTED}; }
        .bhim-m-meta {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          padding: 4px 0 14px; border-bottom: 1px solid ${RULE};
        }
        .bhim-m-length { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; color: ${MUTED}; }
        .bhim-m-share {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 999px;
          border: 1px solid ${RULE}; background: transparent; color: ${INK};
          font: 500 14px/1 var(--font-body, Inter), sans-serif; cursor: pointer;
        }

        .bhim-m-next-up { display: flex; flex-direction: column; gap: 12px; }
        .bhim-m-next-head { display: flex; align-items: baseline; justify-content: space-between; }
        .bhim-m-next-head h3 {
          margin: 0; font: 700 13px/1 var(--font-body, Inter), sans-serif;
          letter-spacing: 0.08em; text-transform: uppercase; color: ${ACCENT_HOVER};
        }
        .bhim-m-see-all {
          border: 0; background: none; padding: 4px 0; cursor: pointer;
          font: 600 14px/1 var(--font-body, Inter), sans-serif; color: ${ACCENT_HOVER};
        }
        .bhim-m-cards {
          list-style: none; margin: 0 -16px; padding: 2px 16px 6px;
          display: flex; gap: 12px; overflow-x: auto;
          scroll-snap-type: x mandatory; scroll-padding-inline: 16px; scrollbar-width: none;
          overscroll-behavior-x: contain;
        }
        .bhim-m-cards::-webkit-scrollbar { display: none; }
        .bhim-m-card {
          flex: 0 0 72%; max-width: 260px; scroll-snap-align: start;
          display: flex; flex-direction: column; gap: 10px;
          padding: 14px; border-radius: 14px;
          border: 1px solid ${RULE}; background: ${SURFACE};
        }
        .bhim-m-card-n { font: 600 13px/1 ui-monospace, monospace; color: ${MUTED}; }
        .bhim-m-card-title {
          font: 600 15px/1.45 var(--font-hindi); color: ${INK};
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
          min-height: calc(15px * 1.45 * 3);
        }
        .bhim-m-card-foot {
          margin-top: auto; display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; color: ${MUTED}; font-variant-numeric: tabular-nums;
        }
        .bhim-m-list { list-style: none; margin: 0; padding: 0; }
        .bhim-m-list li {
          display: grid; grid-template-columns: auto 1fr; gap: 12px; align-items: baseline;
          padding: 10px 0; border-bottom: 1px solid ${RULE};
          font: 500 15px/1.45 var(--font-hindi); color: ${INK};
        }
        .bhim-m-list-time { font: 500 12px/1 ui-monospace, monospace; color: ${MUTED}; font-variant-numeric: tabular-nums; }

        .bhim-m :focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .bhim-m-play { transition: none; } }
      `}</style>
    </div>
  );
}
