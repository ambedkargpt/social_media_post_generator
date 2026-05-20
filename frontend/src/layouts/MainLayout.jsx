import { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import MilestoneBanner from '../components/MilestoneBanner';

export default function MainLayout({ children }) {
  const [bannerVisible, setBannerVisible] = useState(true);

  return (
    <>
      {/*
        Both Navbar and MilestoneBanner live outside <main>.
        CSS spec: overflow != visible on an ancestor creates a containing block
        for fixed descendants — keeping them outside avoids that trap.
      */}
      <Navbar />
      {/* Stacked directly below Navbar — fixed so it scrolls with viewport like the Navbar */}
      <MilestoneBanner
        className="fixed inset-x-0 top-[72px] z-30 md:top-[80px]"
        onHide={() => setBannerVisible(false)}
      />
      {/* Padding accounts for Navbar (72/80px) + Banner (48px) when visible */}
      <main
        className={
          bannerVisible
            ? 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[120px] text-white transition-all duration-300 md:pt-[128px]'
            : 'relative min-h-screen overflow-x-hidden bg-[#05081a] pt-[72px] text-white transition-all duration-300 md:pt-[80px]'
        }
      >
        <div className="relative z-10">{children}</div>
        <Footer />
      </main>
    </>
  );
}
