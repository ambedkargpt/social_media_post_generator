import { Link } from "react-router-dom";
import logoSrc from "../assets/images/logo-animation.png";
import Sparkle from "./landing/Sparkle";
import { FacebookIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from "./landing/SocialIcons";

const ABOUT_LINKS = [
  { label: "API", href: "#" },
  { label: "FAQ", href: "#" },
  { label: "Support", href: "#contact" },
  { label: "Contact Us", href: "#contact" },
  { label: "Careers", href: "#" },
  { label: "AmbedkarGpt Creator Program", href: "#" },
];

const SOCIAL_LINKS = [
  { label: "Facebook", href: "#", icon: FacebookIcon },
  { label: "LinkedIn", href: "#", icon: LinkedinIcon },
  { label: "Twitter", href: "#", icon: TwitterIcon },
  { label: "YouTube", href: "#", icon: YoutubeIcon },
];

function ColumnHeading({ children }) {
  return (
    <div>
      <h4 className="text-[16px] font-semibold text-white">{children}</h4>
      <span className="mt-2 block h-[2px] w-8 rounded-full bg-[linear-gradient(90deg,#3f9fff,transparent)]" />
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-[#1a2c55]/70 bg-[#040712]">
      {/* Top hairline + soft top glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(63,159,255,0.45),transparent)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[65%] -translate-x-1/2 rounded-full bg-[#2d7dfb]/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-20 h-64 w-64 rounded-full bg-[#7b5cff]/8 blur-[110px]" />

      <div className="relative mx-auto max-w-[1440px] px-6 py-16 md:py-20">
        {/* ─── Main grid: brand | About | Quick Links ─── */}
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr] md:gap-12">
          {/* Brand block */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src={logoSrc}
                alt="AmbedkarGPT"
                className="h-10 w-10 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.35)]"
              />
              <span className="sparkle-twinkle inline-flex">
                <Sparkle size={14} color="#4fb4ff" />
              </span>
            </div>
            <Link
              to="/"
              className="mt-4 inline-block text-[22px] font-semibold leading-none tracking-tight"
            >
              <span className="text-white">Ambedkar</span>
              <span className="ml-0.5 gradient-text-cyan">GPT</span>
            </Link>
            <div className="mt-4 space-y-1 text-[13px] leading-relaxed text-[#9fb2d1]">
              <p>Kalpik Ltd</p>
              <p>ABN: 56 862 209 485</p>
              <p>
                <a
                  href="mailto:smartbhaujan@gmail.com"
                  className="transition hover:text-white"
                >
                  smartbhaujan@gmail.com
                </a>
              </p>
              <p>71-75 Shelton Street in Covent Garden, London (WC2H 9JQ)</p>
            </div>
            <p className="mt-3 font-serif text-[13px] italic text-[#7aa6e5]">
              Equality for Everyone, AI FOR All
            </p>

            {/* Social icon row */}
            <div className="mt-5 flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2a4375]/70 text-[#aec0de] transition hover:-translate-y-0.5 hover:border-[#4a78c8]/90 hover:text-white hover:shadow-[0_0_16px_rgba(63,159,255,0.35)]"
                >
                  <Icon width={14} height={14} />
                </a>
              ))}
            </div>
          </div>

          {/* About column */}
          <div>
            <ColumnHeading>About</ColumnHeading>
            <ul className="mt-6 space-y-5">
              {ABOUT_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="group inline-flex items-center text-[13.5px] text-[#9fb2d1] transition hover:text-white"
                  >
                    <span className="transition group-hover:translate-x-0.5">{l.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick Links column */}
          <div>
            <ColumnHeading>Quick Links</ColumnHeading>
            <ul className="mt-6 space-y-5">
              <li>
                <a href="#home" className="text-[13.5px] text-[#c8d8f2] transition hover:text-white">Home</a>
              </li>
              <li>
                <a href="#about" className="text-[13.5px] text-[#c8d8f2] transition hover:text-white">Grow Your Content</a>
              </li>
              <li>
                <a href="#bheem" className="text-[13.5px] text-[#c8d8f2] transition hover:text-white">Use Cases</a>
              </li>
              <li>
                <a href="#charity" className="text-[13.5px] text-[#c8d8f2] transition hover:text-white">Our Team</a>
              </li>
              <li>
                <a href="#contact" className="text-[13.5px] text-[#c8d8f2] transition hover:text-white">Contact Us</a>
              </li>
            </ul>
          </div>

        </div>

        {/* ─── Separator with center glow ─── */}
        <div className="relative mt-16 h-px w-full bg-[#1a2c55]/60">
          <span className="absolute left-1/2 top-1/2 h-[2px] w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(63,159,255,0.85),transparent)] blur-[0.5px]" />
        </div>

        {/* ─── Bottom bar ─── */}
        <div className="mt-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-[#8296bd]">
            <a href="#" className="transition hover:text-white">
              Legal Notice
            </a>
            <a href="#" className="transition hover:text-white">
              DMCA
            </a>
            <a href="#" className="transition hover:text-white">
              Terms of Service
            </a>
            <a href="#" className="transition hover:text-white">
              Cookie Policy
            </a>
          </div>

          <div className="text-right text-[12.5px] leading-relaxed text-[#8296bd]">
            <p>Terms of use and privacy policy</p>
            <p className="mt-0.5">
              AmbedkarGPT Developed by KalpiT Ltd (UK) ©{" "}
              {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
