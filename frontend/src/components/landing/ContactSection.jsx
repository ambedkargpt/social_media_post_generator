import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { Mail, MapPin, Send, UserPlus, Loader2, CheckCircle2 } from 'lucide-react';
import { sendContactMessage } from '../../api/contact';
import SectionLabel from './SectionLabel';
import Spinner from '../Spinner';

// Leaflet is 43 kB gzipped plus a stylesheet, for a map at the very bottom of
// the page. Loading it on render would only move the cost, not remove it, so
// the chunk is not requested until the map is close to the viewport.
const OfficeMap = lazy(() => import('./OfficeMap'));

function LazyOfficeMap() {
  const ref = useRef(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      // No observer, no deferral: showing the map beats hiding it forever.
      setShow(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShow(true);
          obs.disconnect();
        }
      },
      { rootMargin: '400px' },   // start fetching just before it is reached
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-full w-full">
      {/* Leaflet is the largest lazy chunk in the app, so this fallback is on
          screen the longest of any of them. */}
      {show && (
        <Suspense fallback={(
          <div className="flex h-full w-full items-center justify-center bg-[#0a1428]">
            <Spinner size={28} label="Loading map…" showLabel />
          </div>
        )}>
          <OfficeMap />
        </Suspense>
      )}
    </div>
  );
}

// ─── Individual form field — label + input/textarea ───
function Field({
  label, name, value, onChange, type = 'text', placeholder,
  rows, colSpan = 1, grow = false, required = false, disabled = false,
}) {
  const span = colSpan === 2 ? 'md:col-span-2' : '';
  const base =
    'w-full rounded-xl border border-[#1a2d55]/80 bg-[#0a1428] px-4 py-3 text-[14px] text-white placeholder:text-[#4a6080] outline-none transition focus:border-[#3f6bd4] focus:shadow-[0_0_0_3px_rgba(63,107,212,0.18)] disabled:opacity-60';
  const shared = { name, value, onChange, placeholder, required, disabled };
  return (
    <label className={`flex flex-col gap-2 ${span} ${grow ? 'flex-1' : ''}`}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#7aa6e5]">
        {label}
        {required && <span className="ml-1 text-[#ff8b8b]">*</span>}
      </span>
      {rows ? (
        <textarea {...shared} rows={rows} className={`${base} resize-none ${grow ? 'flex-1' : ''}`} />
      ) : (
        <input {...shared} type={type} className={base} />
      )}
    </label>
  );
}

// ─── Direct-channel row (email / location) ───
function ChannelRow({ icon: Icon, label, value, href }) {
  return (
    <a
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-[#1e3260]/60 bg-[#0a1330]/60 p-3 transition hover:border-[#3a6bc4]/80 hover:bg-[#0d1a3f]/80"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#2a4375]/70 bg-[#0c1735]/80 text-[#5fa5ff] shadow-[0_0_14px_rgba(63,159,255,0.22)]">
        <Icon size={15} strokeWidth={1.8} />
      </span>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7aa6e5]">
          {label}
        </span>
        <span className="mt-0.5 text-[13.5px] text-white transition group-hover:text-[#9dc3ff]">
          {value}
        </span>
      </div>
    </a>
  );
}

const EMPTY = { name: '', email: '', address: '', phone: '', message: '', website: '' };

export default function ContactSection() {
  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');

  function update(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    setError('');
    try {
      await sendContactMessage(form);
      setForm(EMPTY);
      setStatus('sent');
    } catch (err) {
      // The backend returns one plain sentence for every send failure, so show
      // it rather than a generic message that hides which part broke.
      setError(
        err?.response?.data?.detail ||
        'Could not send your message. Please try again, or email us directly.',
      );
      setStatus('error');
    }
  }

  return (
    <section id="contact" className="relative py-8 md:py-10">
      {/* Ambient glow — extends upward to blend with TeamSection above */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#3f78ff]/9 blur-[150px]" />
        <div className="absolute left-[20%] top-[40%] h-[320px] w-[400px] rounded-full bg-[#1a3fa0]/7 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1440px] px-6">
        {/* ══════════ Top: Work With Us CTA strip ══════════ */}
        <SectionLabel>Connect With Us</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[44px] font-bold leading-[1.1] text-white md:text-[54px]">
          Build AI for social change. Join us to create the first{' '}
          <span className="italic gradient-text-blue">AI-powered Dalit Literature Corpus</span>{' '}
          &amp; Search.
        </h2>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => document.getElementById('contact-form').scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="btn-gradient inline-flex h-12 items-center gap-2 rounded-full px-7 text-[14px] font-semibold text-white"
          >
            Join Our Team
            <UserPlus size={15} strokeWidth={2.2} />
          </button>
        </div>

        {/* subtle divider with center glow */}
        <div className="relative mx-auto mt-20 h-px w-full max-w-[980px] bg-[#1a2c55]/50">
          <span className="absolute left-1/2 top-1/2 h-[2px] w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(63,159,255,0.75),transparent)]" />
        </div>

        {/* ══════════ Bottom: Connect + form ══════════ */}
        <div className="mt-16 grid items-stretch gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          {/* Left column: copy + channels + dotted map */}
          <div className="flex flex-col">
            <h3 className="font-display text-[42px] font-bold leading-[1.05] text-white md:text-[52px]">
              Let&apos;s Connect <span className="italic gradient-text-blue">And</span>
              <br />
              Build Together
            </h3>

            <p className="mt-5 text-[14px] leading-7 text-[#a6b9d6]">
              Be part of the change. Contact us to collaborate, contribute, or
              support our mission. Together, we can build impactful solutions
              and drive meaningful progress through innovation and knowledge.
            </p>

            <div className="mt-7 space-y-3">
              <ChannelRow
                icon={Mail}
                label="Email"
                value="smartbhaujan@gmail.com"
                href="mailto:smartbhaujan@gmail.com"
              />
              <ChannelRow
                icon={MapPin}
                label="Location"
                value="71-75 Shelton Street in Covent Garden, London (WC2H 9JQ)"
                href="#"
              />
            </div>

            <div className="mt-7 overflow-hidden rounded-2xl border border-[#1e3260]/60" style={{ height: 220 }}>
              <LazyOfficeMap />
            </div>
          </div>

          {/* Right column: Transmission form */}
          <form
            id="contact-form"
            onSubmit={handleSubmit}
            className="relative flex h-full flex-col rounded-2xl border border-[#1e3260]/60 bg-[#070f24] p-6 md:p-8"
          >
            {/* Glows contained so they don't bleed outside the form card */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#3f9fff]/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-[#7b5cff]/8 blur-3xl" />
            </div>

            <div className="grid flex-1 gap-4 md:grid-cols-2">
              <Field label="Name" name="name" value={form.name} onChange={update}
                     placeholder="Jane Doe" required disabled={status === 'sending'} />
              <Field label="Email" name="email" value={form.email} onChange={update}
                     type="email" placeholder="you@example.com" required disabled={status === 'sending'} />
              <Field label="Address" name="address" value={form.address} onChange={update}
                     placeholder="123 Main St, City, Country" colSpan={2} disabled={status === 'sending'} />
              <Field label="Phone" name="phone" value={form.phone} onChange={update}
                     type="tel" placeholder="+91 90000 00000" colSpan={2} disabled={status === 'sending'} />
              <Field label="Message" name="message" value={form.message} onChange={update}
                     rows={5} placeholder="Tell us what you need…" colSpan={2} grow
                     required disabled={status === 'sending'} />

              {/* Honeypot: off screen and skipped by keyboard, so only a bot fills it. */}
              <input
                type="text"
                name="website"
                value={form.website}
                onChange={update}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-0 w-0 opacity-0"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'sending'}
              className="btn-gradient mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {status === 'sending' ? (
                <>
                  Sending
                  <Loader2 size={15} strokeWidth={2.2} className="animate-spin" />
                </>
              ) : (
                <>
                  Send Message
                  <Send size={15} strokeWidth={2.2} />
                </>
              )}
            </button>

            {status === 'sent' && (
              <p
                role="status"
                className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#1f5c3c] bg-[#0c2419] px-4 py-3 text-[13px] text-[#8fe0b4]"
              >
                <CheckCircle2 size={15} className="shrink-0" />
                Thanks, your message is on its way. We will be in touch.
              </p>
            )}

            {status === 'error' && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-[#5c2323] bg-[#241010] px-4 py-3 text-center text-[13px] text-[#f0a6a6]"
              >
                {error}
              </p>
            )}

            <p className="mt-4 text-center text-[11.5px] text-[#7aa6e5]">
              By submitting, you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-white">Terms of Service</a>
              {' '}here.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
