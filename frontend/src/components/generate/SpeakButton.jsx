import { useEffect, useRef, useState } from 'react';
import { Volume2, Square, AlertTriangle } from 'lucide-react';
import { parsePost } from '../../utils/parsePost';

/**
 * Read the generated post aloud.
 *
 * Uses the browser's own speech synthesis rather than a server round trip.
 * The API Lambda already runs close to the gateway's timeout, and a demo
 * cannot wait on another network call to hear a post it has just generated;
 * this starts speaking in well under a second and costs nothing to run.
 *
 * The trade is voice quality, which belongs to the viewer's OS. A machine
 * with no Hindi voice installed will read Devanagari badly or not at all,
 * so that case is detected and said out loud rather than failing quietly.
 */

// Chrome stops speaking after roughly fifteen seconds of a single utterance
// and gives no error when it does. Feeding it one sentence at a time keeps
// every utterance short enough to finish, and the queue plays them in order.
function toSentences(text) {
  return text
    .split(/(?<=[।?!.])\s+/)          // danda first: Hindi ends sentences with it
    .map((s) => s.trim())
    .filter(Boolean);
}

function speakableText(content) {
  const { headline, paragraphs } = parsePost(content || '');
  // Hashtags are deliberately dropped. "#Power_To_The_People" read aloud is
  // "hash Power underscore To underscore The underscore People".
  return [headline, ...paragraphs].filter(Boolean).join(' ');
}

export default function SpeakButton({ content, lang = 'hi', className = '' }) {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices]     = useState([]);
  const cancelled = useRef(false);

  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Voices load asynchronously and the first call usually returns an empty
  // list, so the event matters as much as the initial read.
  useEffect(() => {
    if (!supported) return undefined;
    const load = () => setVoices(window.speechSynthesis.getVoices() || []);
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, [supported]);

  // Anything still queued when the user navigates away would otherwise keep
  // talking over the next screen.
  useEffect(() => () => {
    if (supported) window.speechSynthesis.cancel();
  }, [supported]);

  const voice =
    voices.find((v) => v.lang?.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en')) ||
    voices.find((v) => v.default) ||
    voices[0] ||
    null;

  const missingVoice = supported && voices.length > 0 && lang === 'hi'
    && !voices.some((v) => v.lang?.toLowerCase().startsWith('hi'));

  function stop() {
    cancelled.current = true;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  function start() {
    const text = speakableText(content);
    if (!text) return;

    window.speechSynthesis.cancel();   // clear anything half-spoken
    cancelled.current = false;
    setSpeaking(true);

    const sentences = toSentences(text);
    sentences.forEach((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence);
      if (voice) u.voice = voice;
      u.lang  = voice?.lang || (lang === 'hi' ? 'hi-IN' : 'en-IN');
      u.rate  = 0.95;                  // a shade under default; Hindi at 1.0 rushes
      u.pitch = 1;
      if (i === sentences.length - 1) {
        u.onend = () => { if (!cancelled.current) setSpeaking(false); };
      }
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    });
  }

  if (!supported) return null;

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={speaking ? stop : start}
        disabled={!content?.trim()}
        aria-label={speaking ? 'Stop reading the post aloud' : 'Read the post aloud'}
        className="flex items-center gap-2 rounded-lg border border-[#1e3a6e] bg-[#0d1840] px-3 py-2 text-[13px] font-medium text-white transition hover:border-[#3f9fff]/60 hover:bg-[#0f2050] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {speaking ? (
          <>
            <Square size={14} strokeWidth={2.4} className="text-[#ff8a8a]" />
            Stop
          </>
        ) : (
          <>
            <Volume2 size={15} strokeWidth={2} className="text-[#7fb5ff]" />
            Listen
          </>
        )}
      </button>

      {missingVoice && (
        <span className="flex items-center gap-1.5 text-[11px] text-[#c9a227]">
          <AlertTriangle size={11} strokeWidth={2.2} />
          No Hindi voice on this device, so it will sound wrong.
        </span>
      )}
    </div>
  );
}
