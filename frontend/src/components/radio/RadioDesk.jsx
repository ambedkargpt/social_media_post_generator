import { useI18n } from '../../i18n/index.jsx';
import {
  Label, SignalMeter, StatusLine, Transcript, TuneButton, VolumeControl,
} from './deskParts.jsx';
import { ACCENT, INK, MUTED, RULE, SURFACE, airTime, istClock } from './radioTokens';

/**
 * Layout 2a - the broadcast desk.
 *
 * What is on air, large, beside the running order for the rest of the
 * bulletin. The running order is deliberately not clickable: a station has no
 * "skip to", and a row that looks pressable but is not would be worse than a
 * row that plainly is not.
 */
export default function RadioDesk({
  now, story, storyIndex, total, offsetInStory, storyDuration,
  upcoming, listening, onTune, canTune, nextInSec, progress,
  volume, onVolume, clockLabel, cycleLength,
}) {
  const { t } = useI18n();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* ── header ── */}
      <header
        style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          gap: 24, flexWrap: 'wrap',
          padding: '0 0 20px', borderBottom: `2px solid ${RULE}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              font: `700 30px/1.1 var(--font-display)`,
              color: INK, margin: 0, letterSpacing: '-0.02em',
            }}
          >
            {t('radio.title')}
          </h1>
          <p lang="hi" style={{ margin: '6px 0 0', fontSize: 14, color: MUTED, fontFamily: 'var(--font-hindi)' }}>
            भीम रेडियो · राजनीतिक बुलेटिन
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, background: ACCENT, flex: 'none' }} aria-hidden="true" />
            <Label tone={INK}>{t('ticker.label')}</Label>
          </span>
          <span
            style={{
              font: '500 14px/1 ui-monospace, monospace',
              color: MUTED, fontVariantNumeric: 'tabular-nums',
            }}
          >
            {clockLabel} IST
          </span>
        </div>
      </header>

      {/* ── body ── */}
      <div className="bhim-desk-body" style={{ flex: 1, minHeight: 0 }}>

        {/* what is on air */}
        <section style={{ minWidth: 0, padding: '24px 28px 24px 0' }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
            <Label tone={ACCENT}>{t('radio.nowOnAir')}</Label>
            <Label>
              {storyIndex < 0
                ? t('radio.opening')
                : t('radio.storyOf', { n: storyIndex + 1, total })}
            </Label>
            {story?.tenant && <Label>{story.tenant}</Label>}
            {story?.storyType && <Label>{story.storyType}</Label>}
          </div>

          <h2
            lang="hi"
            aria-live="polite"
            style={{
              font: '700 44px/1.3 var(--font-hindi)',
              color: INK, margin: 0, textWrap: 'balance',
            }}
          >
            {story?.title || t('radio.title')}
          </h2>

          {/* The manifest carries no byline or publication time - those live on
              the news record - so what is shown is when this story goes out,
              which is the thing a listener is actually looking at. */}
          <p style={{ margin: '16px 0 0', fontSize: 13, color: MUTED }}>
            {t('radio.airedAt', {
              time: istClock(airTime(story?.startSec ?? 0, now, cycleLength)),
            })}
          </p>

          <div style={{ borderTop: `2px solid ${RULE}`, margin: '24px 0 20px' }} />
          <div style={{ marginBottom: 14 }}><Label>{t('radio.transcript')}</Label></div>

          <Transcript
            text={story?.text}
            offsetSec={offsetInStory}
            durationSec={storyDuration}
            listening={listening}
          />
        </section>

        {/* the running order */}
        <aside
          className="bhim-desk-order"
          style={{ minWidth: 0, padding: '24px 0 24px 28px' }}
        >
          <div style={{ marginBottom: 16 }}>
            <Label>{t('radio.runningOrder', { n: total })}</Label>
          </div>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {upcoming.map(({ track, state, at }) => (
              <li
                key={`${track.id}-${state}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  alignItems: 'baseline',
                  gap: 12,
                  padding: '10px 12px',
                  borderBottom: `1px solid ${RULE}`,
                  background: state === 'onair' ? ACCENT : 'transparent',
                  color: state === 'onair' ? '#fff' : state === 'aired' ? MUTED : INK,
                }}
              >
                <span
                  style={{
                    font: '500 12px/1.4 ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    opacity: state === 'onair' ? 0.85 : 0.7,
                  }}
                >
                  {istClock(at)}
                </span>
                <span
                  lang="hi"
                  style={{
                    fontSize: 13, lineHeight: 1.45,
                    fontFamily: 'var(--font-hindi)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}
                  title={track.title}
                >
                  {track.title}
                </span>
                <Label tone={state === 'onair' ? '#fff' : MUTED}>
                  {state === 'onair' ? t('radio.onAirRow')
                    : state === 'aired' ? t('radio.airedRow')
                      : t('radio.nextRow')}
                </Label>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      {/* ── footer ── */}
      <footer
        style={{
          background: SURFACE, borderTop: `2px solid ${RULE}`,
          padding: 20, marginTop: 'auto',
          display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap',
        }}
      >
        <TuneButton listening={listening} onClick={onTune} disabled={!canTune} />
        <SignalMeter active={listening} />
        <StatusLine listening={listening} nextInSec={nextInSec} progress={progress} />
        <VolumeControl
          volume={volume}
          onChange={onVolume}
          listening={listening}
          disabled={!canTune}
        />
      </footer>

      <style>{`
        .bhim-desk-body {
          display: grid;
          grid-template-columns: 1.45fr 2px 1fr;
        }
        .bhim-desk-body::before {
          content: '';
          grid-column: 2;
          background: ${RULE};
        }
        .bhim-desk-body > :nth-child(2) { grid-column: 3; }
        @media (max-width: 1023px) {
          .bhim-desk-body { grid-template-columns: 1fr; }
          .bhim-desk-body::before { display: none; }
          .bhim-desk-body > section { padding-right: 0 !important; }
          .bhim-desk-order {
            grid-column: 1 !important;
            padding-left: 0 !important;
            border-top: 2px solid ${RULE};
          }
        }
        .bhim-tune:hover:not(:disabled) { filter: brightness(1.15); }
        .bhim-tune:focus-visible,
        .bhim-desk-body :focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
        @keyframes bhim-signal {
          from { height: 3px; }
          to   { height: 24px; }
        }
        .bhim-signal-bar {
          animation: bhim-signal 0.52s ease-in-out infinite alternate;
        }
        @media (prefers-reduced-motion: reduce) {
          .bhim-signal-bar { animation: none; height: 12px; }
        }
      `}</style>
    </div>
  );
}
