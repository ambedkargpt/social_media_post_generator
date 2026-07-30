import { LinkedinIcon, TwitterIcon } from "./SocialIcons";
import SectionLabel from "./SectionLabel";
import StaggerReveal from "../ui/StaggerReveal";
import team1 from "../../assets/images/team/team1.jpeg";
import team2 from "../../assets/images/team/team2.jpeg";
import team3 from "../../assets/images/team/team3.jpeg";
import team4 from "../../assets/images/team/team4.jpeg";
import team5 from "../../assets/images/team/team5.jpeg";
import team6 from "../../assets/images/team/team6.jpeg";
import team7 from "../../assets/images/team/team7.jpeg";

// NOTE: names/roles are placeholders — photos to be matched to real names later.
// `position` sets each photo's focal point so faces are never cropped out.
const TEAM = [
  { name: "Team Member", role: "AmbedkarGPT", photo: team1, position: "50% 25%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team2, position: "50% 20%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team3, position: "50% 30%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team4, position: "50% 20%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team5, position: "50% 55%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team6, position: "50% 12%" },
  { name: "Team Member", role: "AmbedkarGPT", photo: team7, position: "50% 40%" },
];

function TeamCard({ member }) {
  return (
    <div className="glass-card hover-lift relative overflow-hidden p-4">
      {/* photo */}
      <div
        className="aspect-[4/5] w-full overflow-hidden rounded-xl"
        style={{
          background:
            "radial-gradient(120% 120% at 30% 20%, rgba(63,135,255,0.35) 0%, #0a1330 70%)",
        }}
      >
        {member.photo ? (
          <img
            src={member.photo}
            alt={member.name}
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ objectPosition: member.position || "50% 25%" }}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-[72px] font-bold text-white/20">
            {member.initials}
          </span>
        )}
      </div>

      {/* info */}
      <div className="mt-4 flex items-center justify-between px-1">
        <div>
          <p className="text-[17px] font-semibold text-white">{member.name}</p>
          <p className="mt-0.5 text-[13px] uppercase tracking-[0.15em] text-[#7aa6e5]">
            {member.role}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="#"
            aria-label="LinkedIn"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a4375]/70 text-[#aec0de] transition hover:border-[#4a78c8]/90 hover:text-white"
          >
            <LinkedinIcon width={12} height={12} />
          </a>
          <a
            href="#"
            aria-label="Twitter"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2a4375]/70 text-[#aec0de] transition hover:border-[#4a78c8]/90 hover:text-white"
          >
            <TwitterIcon width={12} height={12} />
          </a>
        </div>
      </div>
    </div>
  );
}

// Team section — "A team like never seen before" with group header + member cards
export default function TeamSection() {
  return (
    <section id="charity" className="relative py-8 md:py-10">
      {/* Ambient glow — bottom glow bleeds into ContactSection */}
      <div className="pointer-events-none absolute inset-x-0 -top-28 -bottom-28">
        <div className="absolute left-1/4 top-1/4 h-[420px] w-[600px] rounded-full bg-[#1e4fb5]/8 blur-[150px]" />
        <div className="absolute right-1/4 bottom-0 h-[360px] w-[500px] rounded-full bg-[#2d6fff]/8 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-[1440px] px-6">
        <SectionLabel>Our Team</SectionLabel>

        <h2 className="mx-auto mt-8 max-w-[820px] text-center font-display text-[46px] font-bold leading-[1.05] text-white md:text-[62px]">
          A Team like{" "}
          <span className="italic gradient-text-blue">never seen</span> before
        </h2>

        <p className="mx-auto mt-10 max-w-[720px] text-center text-[22px] leading-9 text-[#bfcfe8] md:text-[24px]">
          Our team connects scholars, creators, engineers, and changemakers,
          turning knowledge into meaningful action.
        </p>

        {/* Cards — stagger reveal */}
        <StaggerReveal
          step={110}
          className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TEAM.map((m) => (
            <TeamCard key={m.name} member={m} />
          ))}
        </StaggerReveal>
      </div>
    </section>
  );
}
