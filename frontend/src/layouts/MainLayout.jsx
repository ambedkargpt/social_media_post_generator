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
      {/* Film grain over the whole page. Barely visible on its own; it stops
          the large flat navy areas from banding and gives the dark ground a
          printed texture. */}
      <div className="grain-overlay" aria-hidden="true" />
      {/* Padding = navbar height, plus the banner from md where it is pinned. */}
      <main
        className={
          bannerVisible
            ? 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[72px] text-white transition-all duration-300 md:pt-32'
            : 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[72px] text-white transition-all duration-300 md:pt-20'
        }
      >
        {/* In the flow on a phone, pinned from md.
            The banner's sentence needs three lines at 360px, and pinned under
            the navbar that is ~96px of a 640px screen covered for the whole
            visit: it sat over section headings on every scroll. In the flow it
            scrolls away after it has been read. From md it is one line and
            stays under the navbar exactly as before. */}
        <MilestoneBanner
          className="relative z-30 md:fixed md:inset-x-0 md:top-20"
          onHide={() => setBannerVisible(false)}
        />
        <div className="relative z-10">{children}</div>
        <Footer />
      </main>
    </>
  );
}
