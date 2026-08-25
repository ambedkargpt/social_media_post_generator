import { useState } from "react";
import { Link } from "react-router-dom";
import logoSrc from "../assets/images/logo-animation.png";
import LegalModal from "./LegalModal";
import { FacebookIcon, InstagramIcon, LinkedinIcon, TwitterIcon, YoutubeIcon } from "./landing/SocialIcons";

// Section anchors resolve on the home page. MainLayout scrolls to the hash after
// a route change, so these work from /pricing and /about too, which plain
// "#contact" links did not: they appended a hash to whatever page you were on.
const PRODUCT_LINKS = [
  { label: "Generate posts", to: "/generate/social-media" },
  { label: "BheemBot", to: "/bheembot" },
  { label: "Use cases", to: "/#bheem" },
  { label: "Pricing", to: "/pricing" },
  { label: "Solutions", to: "/solutions" },
];

const COMPANY_LINKS = [
  { label: "About", to: "/about" },
  { label: "Our team", to: "/#charity" },
  { label: "Dalit Corpus", to: "/#ambedkarverse" },
  { label: "Resources", to: "/resources" },
  { label: "Contact us", to: "/contact" },
];

// Accounts with no URL are skipped rather than rendered as links that go
// nowhere, so filling one in is all it takes to make it appear.
const SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/ambedkargpt/", icon: InstagramIcon },
  { label: "YouTube",   href: "https://www.youtube.com/@AmbedkarGPT",   icon: YoutubeIcon },
  { label: "Facebook",  href: "", icon: FacebookIcon },
  { label: "LinkedIn",  href: "", icon: LinkedinIcon },
  { label: "X",         href: "", icon: TwitterIcon },
];

const EMAIL = "smartbhaujan@gmail.com";

function ColumnHeading({ children }) {
  return (
    <div>
      <h4 className="text-[15px] font-semibold text-white">{children}</h4>
      <span className="mt-2 block h-[2px] w-8 rounded-full bg-[linear-gradient(90deg,#3f9fff,transparent)]" />
    </div>
  );
}

function LinkColumn({ heading, links }) {
  return (
    <div>
      <ColumnHeading>{heading}</ColumnHeading>
      <ul className="mt-5 space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="inline-block text-[13.5px] text-[#9fb2d1] transition hover:translate-x-0.5 hover:text-white"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const [legal, setLegal] = useState(null);
  const socials = SOCIAL_LINKS.filter((s) => s.href);

  return (
    <footer className="relative overflow-hidden border-t border-[#1a2c55]/70 bg-[#040712]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(63,159,255,0.45),transparent)]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-72 w-[65%] -translate-x-1/2 rounded-full bg-[#2d7dfb]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-[1280px] px-6 py-14 md:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr] lg:gap-14">

          {/* Brand */}
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <img
                src={logoSrc}
                alt=""
                className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(63,159,255,0.35)]"
              />
              <span className="text-[21px] font-semibold leading-none tracking-tight">
                <span className="text-white">Ambedkar</span>
                <span className="gradient-text-cyan">GPT</span>
              </span>
            </Link>

            <p className="mt-4 max-w-[46ch] text-[13.5px] leading-relaxed text-[#9fb2d1]">
              Ambedkarite knowledge, in the hands of the people who need it most.
            </p>

            <div className="mt-5 space-y-1 text-[13px] leading-relaxed text-[#8296bd]">
              <p className="text-[#9fb2d1]">KalpiT Ltd</p>
              <p>71-75 Shelton Street, Covent Garden, London WC2H 9JQ</p>
              <p>
                <a href={`mailto:${EMAIL}`} className="transition hover:text-white">
                  {EMAIL}
                </a>
              </p>
            </div>

            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-2.5">
                {socials.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2a4375]/70 text-[#aec0de] transition hover:-translate-y-0.5 hover:border-[#4a78c8]/90 hover:text-white hover:shadow-[0_0_16px_rgba(63,159,255,0.35)]"
                  >
                    <Icon width={14} height={14} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <LinkColumn heading="Product" links={PRODUCT_LINKS} />
          <LinkColumn heading="Company" links={COMPANY_LINKS} />
        </div>

        <div className="relative mt-12 h-px w-full bg-[#1a2c55]/60">
          <span className="absolute left-1/2 top-1/2 h-[2px] w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,transparent,rgba(63,159,255,0.85),transparent)] blur-[0.5px]" />
        </div>

        {/* One legal row. There were two competing groups before, one of which
            was plain text, and every link in both went nowhere. */}
        <div className="mt-7 flex flex-col-reverse items-start justify-between gap-4 text-[12.5px] text-[#8296bd] md:flex-row md:items-center">
          <p>
            AmbedkarGPT, developed by KalpiT Ltd (UK) © {new Date().getFullYear()}
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button
              type="button"
              onClick={() => setLegal("terms")}
              className="transition hover:text-white"
            >
              Terms of Service
            </button>
            <button
              type="button"
              onClick={() => setLegal("privacy")}
              className="transition hover:text-white"
            >
              Privacy Policy
            </button>
            <Link to="/contact" className="transition hover:text-white">
              Support
            </Link>
          </div>
        </div>
      </div>

      {legal && <LegalModal type={legal} onClose={() => setLegal(null)} />}
    </footer>
  );
}
