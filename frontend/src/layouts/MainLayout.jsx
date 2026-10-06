import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MilestoneBanner from '../components/MilestoneBanner';
import RadioLiveStrip from '../components/RadioLiveStrip';
import NewsTicker from '../components/NewsTicker';

// Tailwind needs these spellings present in the source to emit the classes,
// so they are a lookup rather than a computed `md:pt-${n}`.
const PINNED_PAD = ['md:pt-20', 'md:pt-[122px]', 'md:pt-[170px]', 'md:pt-[204px]'];

export default function MainLayout({ children }) {
  const [bannerVisible, setBannerVisible] = useState(true);
  const [radioStripVisible, setRadioStripVisible] = useState(true);
  const { pathname, hash } = useLocation();
  // Not on the landing page: a visitor being told what the product is should
  // not be reading today's politics crawl past the pitch.
  const showTicker = pathname !== '/';

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
      {/* Padding = navbar height, plus one 48px row per pinned strip from md.
          Either strip can be dismissed independently, so the offset is counted
          rather than hard-coded: with both hard-coded, dismissing the top one
          left a 48px gap under the navbar. */}
      <main
        className={`relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[72px] text-white transition-all duration-300 ${PINNED_PAD[Number(bannerVisible) + Number(radioStripVisible) + Number(showTicker)]}`}
      >
        {/* In the flow on a phone, pinned from md.
            The banner's sentence needs three lines at 360px, and pinned under
            the navbar that is ~96px of a 640px screen covered for the whole
            visit: it sat over section headings on every scroll. In the flow it
            scrolls away after it has been read. From md it is one line and
            stays under the navbar exactly as before. */}
        {/* One pinned stack rather than two independently positioned strips:
            stacking them by hand meant the second one's `top` had to track
            whether the first was still there. Each keeps `relative` because
            both paint an absolutely positioned texture over themselves. */}
        <div className="relative z-30 md:fixed md:inset-x-0 md:top-20">
          {/* First in the stack: the crawl is the live thing on the page, and
              a promotion sitting above it would read as the more urgent of
              the two. */}
          {showTicker && <NewsTicker />}
          <MilestoneBanner
            className="relative"
            onHide={() => setBannerVisible(false)}
          />
          <RadioLiveStrip
            className="relative"
            onHide={() => setRadioStripVisible(false)}
          />
        </div>
        <div className="relative z-10">{children}</div>
        <Footer />
      </main>
    </>
  );
}
