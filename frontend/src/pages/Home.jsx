import { useEffect } from 'react';

import MainLayout from '../layouts/MainLayout';
import RevealOnScroll from '../components/ui/RevealOnScroll';

import HeroSection         from '../components/landing/HeroSection';
import KnowledgeSection    from '../components/landing/KnowledgeSection';
import UseCasesGrid        from '../components/landing/UseCasesGrid';
import DalitHistoryMakers  from '../components/landing/DalitHistoryMakers';
import DalitCorpusSection  from '../components/landing/DalitCorpusSection';
import TeamSection         from '../components/landing/TeamSection';
import ContactSection      from '../components/landing/ContactSection';

export default function Home() {
  // support deep-linking to a section after navigating from another route
  useEffect(() => {
    const pending = sessionStorage.getItem('pending-section-scroll');
    if (!pending) return;
    const t = setTimeout(() => {
      const target = document.getElementById(pending);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      sessionStorage.removeItem('pending-section-scroll');
    }, 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <MainLayout>
      <HeroSection />

      <RevealOnScroll delayMs={60}>
        <DalitHistoryMakers />
      </RevealOnScroll>

      <KnowledgeSection />

      <RevealOnScroll delayMs={60}>
        <UseCasesGrid />
      </RevealOnScroll>

      <RevealOnScroll delayMs={60}>
        <DalitCorpusSection />
      </RevealOnScroll>

      <RevealOnScroll delayMs={60}>
        <TeamSection />
      </RevealOnScroll>

      <RevealOnScroll delayMs={60}>
        <ContactSection />
      </RevealOnScroll>
    </MainLayout>
  );
}
