import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight,
  ImageIcon, Video, Edit3, Music, Mic2, Tv,
  Headphones, Newspaper, Film, Scale, MonitorPlay, Trophy, Feather,
} from 'lucide-react';

import ServiceCard from '../components/generate/ServiceCard';

const SERVICES = [
  {
    id: 'social',
    title: 'Social Media Post',
    description: 'Generate powerful Ambedkarite social media posts from current news',
    icon: <Edit3 size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ff4f8a] to-[#d43a68]',
    glow: 'rgba(255,79,138,0.45)',
    route: '/generate/social-media',
  },
  {
    id: 'music',
    title: 'Music Generation',
    description: 'Generate lyrics, beats, and full instrumental tracks with AI',
    icon: <Music size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ffb056] to-[#ff7a2d]',
    glow: 'rgba(255,176,86,0.45)',
    badge: 'new',
    route: '/generate/music',
  },
  {
    id: 'podcast',
    title: 'Podcast',
    description: 'Script and produce AI-powered podcast episodes on Ambedkarite themes',
    icon: <Headphones size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#06b6d4] to-[#0891b2]',
    glow: 'rgba(6,182,212,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'video',
    title: 'Video Generation',
    description: 'Generate high-quality videos and animations from your ideas',
    icon: <Video size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#a855f7] to-[#7b3fd4]',
    glow: 'rgba(168,85,247,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'editorial',
    title: 'Editorial',
    description: 'Write structured opinion pieces and editorials rooted in Ambedkarite thought',
    icon: <Newspaper size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#f59e0b] to-[#d97706]',
    glow: 'rgba(245,158,11,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'speech',
    title: 'Political Speech',
    description: 'Generate compelling political speeches grounded in constitutional values',
    icon: <Mic2 size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#22c55e] to-[#16a34a]',
    glow: 'rgba(34,197,94,0.4)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'shorts',
    title: 'Shorts / Reels',
    description: 'Create short-form video scripts optimised for Instagram Reels and YouTube Shorts',
    icon: <Film size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#ec4899] to-[#be185d]',
    glow: 'rgba(236,72,153,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'debate-analysis',
    title: 'Debate Analysis & Feedback',
    description: 'Analyse TV debates and political arguments with an Ambedkarite lens',
    icon: <Scale size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#3f9fff] to-[#5bc0ff]',
    glow: 'rgba(91,192,255,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'debate-show',
    title: 'Debate Show',
    description: 'Generate structured debate scripts and talking points for shows',
    icon: <MonitorPlay size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#6366f1] to-[#4f46e5]',
    glow: 'rgba(99,102,241,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'election',
    title: 'Election Campaign',
    description: 'Craft election campaign content for independent and Bahujan candidates',
    icon: <Trophy size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#f97316] to-[#ea580c]',
    glow: 'rgba(249,115,22,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'poem',
    title: 'Poem',
    description: 'Generate powerful poems and spoken word pieces in the Ambedkarite tradition',
    icon: <Feather size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#14b8a6] to-[#0d9488]',
    glow: 'rgba(20,184,166,0.45)',
    badge: 'comingSoon',
    disabled: true,
  },
  {
    id: 'image',
    title: 'Image Generation',
    description: 'Create stunning visuals from text prompts with advanced AI models',
    icon: <ImageIcon size={20} strokeWidth={1.9} />,
    iconGradient: 'bg-gradient-to-br from-[#8b5cf6] to-[#6d28d9]',
    glow: 'rgba(139,92,246,0.5)',
    badge: 'comingSoon',
    disabled: true,
  },
];

export default function ServiceSelection() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(new Set());

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleContinue() {
    if (selected.size === 0) return;
    if (selected.has('social')) { navigate('/generate/social-media'); return; }
    if (selected.has('music'))  { navigate('/generate/music');        return; }
    // Future routes wired here as services go live
  }

  const count = selected.size;

  return (
    <div
      className="relative min-h-screen overflow-hidden text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 50% -10%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      {/* ambient glows */}
      <div className="pointer-events-none absolute top-0 -left-32 h-[500px] w-[500px] rounded-full bg-[#3f9fff]/10 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[420px] w-[420px] rounded-full bg-[#7b5cff]/10 blur-[140px]" />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-8 pt-6 md:px-12">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-4 py-2 text-[12.5px] font-medium text-[#8b94b8] transition hover:border-[#3a6bc4]/60 hover:text-white"
        >
          <ArrowLeft size={13} strokeWidth={2} />
          Back to Dashboard
        </button>

        <span className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6aa8ff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#3f9fff] shadow-[0_0_10px_rgba(63,159,255,0.8)]" />
          AI Studio Platform
        </span>

        <div className="hidden md:block w-[160px]" />
      </header>

      {/* ── Hero title ── */}
      <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-10 md:px-10">
        <div className="text-center">
          <h1 className="font-display text-[44px] md:text-[58px] font-bold leading-[1.05] tracking-tight">
            <span className="text-white">Choose your </span>
            <span className="relative inline-block">
              <span className="gradient-text-blue">AI service</span>
              <span
                className="absolute left-0 right-0 -bottom-1 h-[3px] rounded-full bg-gradient-to-r from-transparent via-[#3f9fff] to-transparent"
                aria-hidden
              />
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-[620px] text-[14px] leading-relaxed text-[#8b94b8]">
            Select one or more AI services to power your next project.
            Each service can be configured and customized to your needs.
          </p>
        </div>

        {/* Service grid */}
        <div className="mt-12 grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <ServiceCard
              key={s.id}
              icon={s.icon}
              iconGradient={s.iconGradient}
              glow={s.glow}
              title={s.title}
              description={s.description}
              badge={s.badge}
              disabled={s.disabled}
              selected={selected.has(s.id)}
              onSelect={() => {
                if (s.route) {
                  navigate(s.route);
                  return;
                }
                toggle(s.id);
              }}
            />
          ))}
        </div>

      </main>
    </div>
  );
}
