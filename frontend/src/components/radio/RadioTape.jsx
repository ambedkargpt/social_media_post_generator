import { useI18n } from '../../i18n/index.jsx';
import {
  Label, SignalMeter, StatusLine, Transcript, TuneButton, VolumeControl,
} from './deskParts.jsx';
import { ACCENT, ACCENT_HOVER, DEEP, INK, MUTED, RULE, SURFACE, istClock } from './radioTokens';

/**
 * Layout 2b - the broadcast tape.
 *
 * The bulletin drawn as the strip of time it is, running right to left past a
 * fixed needle. Everything to the left of the needle has gone out; everything
 * to the right is still to come, and its distance from the needle is literally
 * how long until it does.
 */

// Pixels per second of broadcast. The whole geometry hangs off this one
// number: segment widths, ruler spacing and the scroll are all derived, so the
// tape cannot drift out of step with itself.
const PX_PER_SEC = 11;
const NEEDLE_X = 300;
const TAPE_H = 240;

// How much of the bulletin to draw. The rest is off-screen and costs nothing
// to leave out; a full day of loops would be tens of thousands of pixels.
const BEFORE = 3;
const AFTER = 6;

export default function RadioTape({
  now, story, storyIndex, total, offsetInStory, storyDuration, cycleLength,
  elapsed, tracks, listening, onTune, canTune, nextInSec, progress,
  volume, onVolume, reduced,
}) {
  const { t } = useI18n();

  // `elapsed` is seconds into the loop, handed down rather than derived from
  // the current story: during the opening music there is no current story, and
  // reading startSec off it threw. Track offsets are against the same loop, so
  // this is the only number the geometry needs.

  const laid = [];
  for (let pass = -1; pass <= 1; pass += 1) {
    tracks.forEach((track, i) => {
      laid.push({
        key: `${pass}-${track.id}`,
        track,
        index: i,
        start: track.startSec + pass * cycleLength,
        duration: Math.max(1, (track.endSec ?? track.startSec) - track.startSec),
      });
    });
  }
  const visible = laid
    .filter((seg) => {
      const x = (seg.start - elapsed) * PX_PER_SEC + NEEDLE_X;
      return x > -(seg.duration * PX_PER_SEC) - 200 && x < 2400;
    })
    .slice(0, BEFORE + AFTER + 6);

  // The ruler: a minor tick every 5s, a major one with a label every 30s.
  const ticks = [];
  const firstTick = Math.floor((elapsed - NEEDLE_X / PX_PER_SEC) / 5) * 5;
  for (let s = firstTick; s < elapsed + 2400 / PX_PER_SEC; s += 5) {
    ticks.push({ s, major: Math.round(s) % 30 === 0 });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── masthead ── */}
      <header
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
          padding: '0 0 20px', borderBottom: `2px solid ${RULE}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            lang="hi"
            style={{
              font: '700 72px/1.05 var(--font-hindi)',
              color: INK, margin: 0, letterSpacing: '-0.02em',
            }}
          >
            भीम रेडियो
          </p>
          <p style={{ margin: '4px 0 0', font: `600 16px/1 var(--font-display)`, color: ACCENT }}>
            {t('radio.title')}
          </p>
        </div>

        <dl
          style={{
            display: 'grid', gridTemplateColumns: 'auto auto', gap: '6px 18px',
            margin: 0, alignItems: 'baseline',
          }}
        >
          <dt><Label>{t('radio.bulletin')}</Label></dt>
          <dd style={{ margin: 0, fontSize: 13, color: INK }}>{istClock(now)} IST</dd>
          <dt><Label>{t('radio.stories')}</Label></dt>
          <dd style={{ margin: 0, fontSize: 13, color: INK }}>{total}</dd>
          <dt><Label>{t('radio.you')}</Label></dt>
          <dd style={{ margin: 0, fontSize: 13, color: listening ? ACCENT_HOVER : MUTED }}>
            <Label tone={listening ? ACCENT_HOVER : MUTED}>
              {listening ? t('radio.tunedIn') : t('radio.notListening')}
            </Label>
          </dd>
        </dl>
      </header>

      {/* ── now ── */}
      <div className="bhim-tape-now" style={{ padding: '24px 0' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
            <Label tone={ACCENT}>{t('radio.nowOnAir')}</Label>
            <Label>
              {storyIndex < 0
                ? t('radio.opening')
                : t('radio.storyOf', { n: storyIndex + 1, total })}
            </Label>
          </div>
          <h2
            lang="hi"
            aria-live="polite"
            style={{ font: '700 40px/1.3 var(--font-hindi)', color: INK, margin: 0, textWrap: 'balance' }}
          >
            {story?.title || t('radio.title')}
          </h2>
          <p style={{ margin: '14px 0 0', fontSize: 13, color: MUTED }}>
            {t('radio.airedAt', { time: istClock(now) })}
          </p>
        </div>

        <div style={{ minWidth: 0, borderLeft: `2px solid ${RULE}`, paddingLeft: 24 }}>
          <Transcript
            text={story?.text}
            offsetSec={offsetInStory}
            durationSec={storyDuration}
            listening={listening}
            size={20}
          />
        </div>
      </div>

      {/* ── the tape ── */}
      <div
        style={{
          position: 'relative', height: TAPE_H, overflow: 'hidden',
          background: SURFACE, borderTop: `2px solid ${RULE}`,
        }}
        role="img"
        aria-label={t('radio.tapeAria')}
      >
        {/* Everything already broadcast sits under a wash, so the needle reads
            as the edge between what has gone out and what has not. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, right: `calc(100% - ${NEEDLE_X}px)`,
            background: 'rgba(10,14,39,0.45)', zIndex: 2, pointerEvents: 'none',
          }}
        />

        {visible.map((seg) => {
          const x = (seg.start - elapsed) * PX_PER_SEC + NEEDLE_X;
          const live = seg.index === storyIndex && seg.start <= elapsed
            && elapsed < seg.start + seg.duration;
          const past = seg.start + seg.duration <= elapsed;
          return (
            <div
              key={seg.key}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: seg.duration * PX_PER_SEC,
                height: TAPE_H - 34,
                transform: `translateX(${x}px)`,
                borderLeft: `2px solid ${live ? ACCENT : RULE}`,
                padding: '14px 12px',
                boxSizing: 'border-box',
                color: past ? MUTED : INK,
                // Stepped rather than continuous when motion is reduced; the
                // tape still tells the time, it just does not slide.
                transition: reduced ? 'transform 1s steps(1)' : 'none',
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <Label tone={live ? ACCENT : MUTED}>
                  {istClock(new Date(now.getTime() + (seg.start - elapsed) * 1000))}
                  {seg.track.tenant ? ` · ${seg.track.tenant}` : ''}
                </Label>
              </div>
              <p
                lang="hi"
                style={{
                  margin: 0, fontSize: 14, lineHeight: 1.4,
                  fontFamily: 'var(--font-hindi)',
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {seg.track.title}
              </p>
            </div>
          );
        })}

        {/* the ruler */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 }}>
          {ticks.map(({ s, major }) => {
            const x = (s - elapsed) * PX_PER_SEC + NEEDLE_X;
            if (x < -60 || x > 2400) return null;
            return (
              <div
                key={s}
                aria-hidden="true"
                style={{
                  position: 'absolute', bottom: 0, left: 0,
                  transform: `translateX(${x}px)`,
                  borderLeft: `1px solid ${RULE}`,
                  height: major ? 16 : 7,
                }}
              >
                {major && (
                  <span
                    style={{
                      position: 'absolute', bottom: 16, left: 4, whiteSpace: 'nowrap',
                      font: '500 10px/1 ui-monospace, monospace', color: MUTED,
                    }}
                  >
                    {istClock(new Date(now.getTime() + (s - elapsed) * 1000), true)}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* the needle */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', top: 0, bottom: 0, left: NEEDLE_X,
            width: 2, background: ACCENT_HOVER, zIndex: 3,
          }}
        >
          <span
            style={{
              position: 'absolute', top: 0, left: 0, whiteSpace: 'nowrap',
              background: ACCENT_HOVER, color: '#0a0e27',
              font: '700 10px/1 ui-monospace, monospace',
              letterSpacing: '0.1em', padding: '5px 7px',
            }}
          >
            NOW {istClock(now, true)}
          </span>
        </div>
      </div>

      {/* ── footer band ── */}
      <footer
        style={{
          background: DEEP, padding: 20, marginTop: 'auto',
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}
      >
        <TuneButton listening={listening} onClick={onTune} disabled={!canTune} width={240} height={76} />
        <SignalMeter active={listening} live={canTune} />
        <StatusLine listening={listening} nextInSec={nextInSec} progress={progress} />
        <VolumeControl volume={volume} onChange={onVolume} listening={listening} disabled={!canTune} />
      </footer>

      <style>{`
        .bhim-tape-now { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
        @media (max-width: 1023px) {
          .bhim-tape-now { grid-template-columns: 1fr; }
          .bhim-tape-now > :nth-child(2) {
            border-left: none !important;
            padding-left: 0 !important;
            border-top: 2px solid ${RULE};
            padding-top: 20px;
          }
        }
      `}</style>
    </div>
  );
}
