import { Mail, MapPin, Send, UserPlus } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import SectionLabel from './SectionLabel';

// Fix Leaflet default marker icons broken by Vite asset bundling
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MHOW = [22.5565, 75.7610];

// ─── Individual form field — label + input/textarea ───
function Field({ label, type = 'text', placeholder, rows, colSpan = 1, grow = false }) {
  const span = colSpan === 2 ? 'md:col-span-2' : '';
  const base =
    'w-full rounded-xl border border-[#1a2d55]/80 bg-[#0a1428] px-4 py-3 text-[14px] text-white placeholder:text-[#4a6080] outline-none transition focus:border-[#3f6bd4] focus:shadow-[0_0_0_3px_rgba(63,107,212,0.18)]';
  return (
    <label className={`flex flex-col gap-2 ${span} ${grow ? 'flex-1' : ''}`}>
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[#7aa6e5]">
        {label}
      </span>
      {rows ? (
        <textarea
          rows={rows}
          placeholder={placeholder}
          className={`${base} resize-none ${grow ? 'flex-1' : ''}`}
        />
      ) : (
        <input type={type} placeholder={placeholder} className={base} />
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

export default function ContactSection() {
  return (
    <section id="contact" className="relative py-20 md:py-28">
      {/* Ambient glow — extends upward to blend with TeamSection above */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-0">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-[#3f78ff]/9 blur-[150px]" />
        <div className="absolute left-[20%] top-[40%] h-[320px] w-[400px] rounded-full bg-[#1a3fa0]/7 blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1180px] px-6">
        {/* ══════════ Top: Work With Us CTA strip ══════════ */}
        <SectionLabel>Work With Us</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[44px] font-bold leading-[1.1] text-white md:text-[54px]">
          Build AI for social change — join us to create the first{' '}
          <span className="italic gradient-text-blue">AI-powered Dalit Literature Corpus</span>{' '}
          &amp; Search.
        </h2>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
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
                value="hello@ambedkargpt.in"
                href="mailto:hello@ambedkargpt.in"
              />
              <ChannelRow
                icon={MapPin}
                label="Location"
                value="Mhow (Dr. Ambedkar Nagar), Madhya Pradesh, India"
                href="#"
              />
            </div>

            <div className="mt-7 overflow-hidden rounded-2xl border border-[#1e3260]/60" style={{ height: 220 }}>
              <MapContainer
                center={MHOW}
                zoom={13}
                scrollWheelZoom={false}
                zoomControl={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={MHOW}>
                  <Popup>Birthplace of Dr. B.R. Ambedkar<br />Mhow, Madhya Pradesh</Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>

          {/* Right column: Transmission form */}
          <form
            onSubmit={(e) => e.preventDefault()}
            className="relative flex h-full flex-col rounded-2xl border border-[#1e3260]/60 bg-[#070f24] p-6 md:p-8"
          >
            {/* Glows contained so they don't bleed outside the form card */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-[#3f9fff]/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-[#7b5cff]/8 blur-3xl" />
            </div>

            <div className="grid flex-1 gap-4 md:grid-cols-2">
              <Field label="Full Identity"            placeholder="Jane Doe" />
              <Field label="Email"                    type="email" placeholder="you@example.com" />
              <Field label="Physical Origin (Address)" placeholder="123 Main St, City, Country" colSpan={2} />
              <Field label="Frequency (Phone)"        type="tel"   placeholder="+91 90000 00000"        colSpan={2} />
              <Field label="Transmission Message"     rows={5}     placeholder="Tell us what you need…" colSpan={2} grow />
            </div>

            <button
              type="submit"
              className="btn-gradient mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-semibold text-white"
            >
              Send Message
              <Send size={15} strokeWidth={2.2} />
            </button>

            <p className="mt-4 text-center text-[11.5px] text-[#7aa6e5]">
              By transmitting, you agree to our{' '}
              <a href="#" className="underline underline-offset-2 hover:text-white">Terms of Service</a>
              {' '}here.
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
