import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MilestoneBanner from '../components/MilestoneBanner';

export default function MainLayout({ children }) {
  const [bannerVisible, setBannerVisible] = useState(true);
  const { pathname, hash } = useLocation();

  // Scroll to #section after a route change. Nothing did this, so a link from
  // another page to "/#contact" landed at the top of the home page and the
  // reader had to find the section themselves. The section may not be mounted
  // on the first frame, so retry briefly before giving up.
  useEffect(() => {
    if (!hash) return undefined;
    const id = hash.slice(1);
    let tries = 0;
    const timer = setInterval(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        clearInterval(timer);
      } else if (++tries > 20) {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [pathname, hash]);

  return (
    <>
      {/*
        Both Navbar and MilestoneBanner live outside <main>.
        CSS spec: overflow != visible on an ancestor creates a containing block
        for fixed descendants — keeping them outside avoids that trap.
      */}
      <Navbar />
      {/* Stacked directly below Navbar — mobile navbar is now 72px, md+ is 80px (no scroll-pills row) */}
      <MilestoneBanner
        className="fixed inset-x-0 top-[72px] z-30 md:top-20"
        onHide={() => setBannerVisible(false)}
      />
      {/* Padding = navbar height + banner (48px) when visible */}
      <main
        className={
          bannerVisible
            ? 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[120px] text-white transition-all duration-300 md:pt-32'
            : 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[72px] text-white transition-all duration-300 md:pt-20'
        }
      >
        <div className="relative z-10">{children}</div>
        <Footer />
      </main>
    </>
  );
}
