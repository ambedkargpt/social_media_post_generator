import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, SlidersHorizontal, Bot, Sparkles, Music, ChevronRight } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { getPosts, getDailyQuota } from '../api/posts';
import { getProfileAnswers } from '../api/profile';
import MilestoneBanner from '../components/MilestoneBanner';
import DailyQuotaWidget from '../components/dashboard/DailyQuotaWidget';

import Sidebar              from '../components/dashboard/Sidebar';
import Topbar               from '../components/dashboard/Topbar';
import StatCard             from '../components/dashboard/StatCard';
import SearchActivityChart  from '../components/dashboard/SearchActivityChart';
import DailyActivityChart   from '../components/dashboard/DailyActivityChart';
import CategoriesPieChart   from '../components/dashboard/CategoriesPieChart';
import ImageGenerationCard  from '../components/dashboard/ImageGenerationCard';
import ProfileCard          from '../components/dashboard/ProfileCard';
import PreferencesCard      from '../components/dashboard/PreferencesCard';
import RecentSearchesTable  from '../components/dashboard/RecentSearchesTable';
import SavedPromptsGrid     from '../components/dashboard/SavedPromptsGrid';
import AchievementsGrid     from '../components/dashboard/AchievementsGrid';
import DashboardFooter      from '../components/dashboard/DashboardFooter';
import { partyLogo }        from '../utils/politicalParties';

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [posts,            setPosts]           = useState([]);
  const [profileAnswers,   setProfileAnswers]  = useState([]);
  const [dataLoading,      setDataLoading]     = useState(true);
  const [quota,            setQuota]           = useState(null);
  const [quotaLoading,     setQuotaLoading]    = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;
    // Reset loading states on every mount so re-login always shows fresh data
    setDataLoading(true);
    setQuotaLoading(true);
    Promise.all([
      getPosts({ limit: 100 }).catch(() => []),
      getProfileAnswers(currentUser.id).catch(() => []),
    ]).then(([p, a]) => {
      setPosts(p ?? []);
      setProfileAnswers(a ?? []);
    }).finally(() => setDataLoading(false));

    getDailyQuota().then(setQuota).catch(() => {}).finally(() => setQuotaLoading(false));
  }, [currentUser?.id]);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function handleNavSelect(id) {
    setActive(id);
    if (id === 'profile') {
      document.getElementById('profile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Resolved from the full party list, not the offered one, so an account
  // carrying a party we no longer offer still shows its own mark.
  const welcomeLogo  = partyLogo(currentUser?.political_party);
  const displayName  = currentUser?.username ?? '—';
  const displayEmail = currentUser?.email ?? currentUser?.phone ?? '—';
  const joinedLabel  = (() => {
    const t = currentUser?.created_at;
    if (!t) return '';
    const d = new Date(t);
    return `Joined ${d.toLocaleString('en-US', { month: 'long', year: 'numeric' })}`;
  })();

  const totalPosts     = posts.length;
  const publishedPosts = posts.filter((p) => p.status === 'published').length;
  const draftPosts     = posts.filter((p) => p.status === 'draft').length;
  const prefsAnswered  = profileAnswers.length;

  const topbarUser  = {
    name: displayName,
    email: displayEmail,
    party: currentUser?.political_party ?? '',
  };
  const profileUser = { name: displayName, email: displayEmail, joined: joinedLabel, postCount: totalPosts };

  const first = displayName.split('_')[0];

  return (
    <div
      className="flex h-screen overflow-hidden text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 20% 0%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      <Sidebar
        active={active}
        onSelect={handleNavSelect}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
        onLogout={handleLogout}
      />

      <div className="relative flex-1 min-w-0 overflow-y-auto">
        <MilestoneBanner totalPosts={quota?.total_streak_posts} />
        <div className="px-6 md:px-10">
        <div className="pointer-events-none fixed top-0 right-0 h-[420px] w-[420px] rounded-full bg-[#3f9fff]/10 blur-[130px]" />
        <div className="pointer-events-none fixed bottom-0 left-[22%] h-[360px] w-[360px] rounded-full bg-[#7b5cff]/10 blur-[130px]" />

        {/* totalPosts comes from the same source the milestone banner counts
            from, so the bell and the banner cannot disagree. */}
        <Topbar
          user={topbarUser}
          onMenuOpen={() => setMobileSidebarOpen(true)}
          totalPosts={quota?.total_streak_posts ?? totalPosts}
          onLogout={handleLogout}
        />

        {/* ── Welcome ── */}
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-[28px] md:text-[32px] font-bold leading-tight tracking-tight">
              <span>
                <span className="text-white">Welcome back, </span>
                <span className="gradient-text-blue">{first}</span>
              </span>
              {/* The party mark, at a size you can actually read it at. It
                  sits on a white disc at 54px, roughly the cap height of the
                  heading beside it, so it reads as part of the line rather
                  than a decoration hung off the end. The source files are
                  250px square, so this is still well inside their resolution
                  even on a 2x screen. */}
              {welcomeLogo && (
                <span
                  className="inline-flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_rgba(63,159,255,0.35),0_4px_16px_rgba(0,0,0,0.35)]"
                  title={currentUser?.political_party || ''}
                >
                  <img
                    src={welcomeLogo}
                    alt={currentUser?.political_party || 'Party'}
                    className="h-[54px] w-[54px] object-contain"
                    onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
                  />
                </span>
              )}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[#8b94b8]">
              Your AI journey continues. Let&apos;s make today productive and insightful!
            </p>
          </div>

        </div>

        {/* ── Quick actions ──
            The Topbar's Generate button routes to an intermediate services page,
            which was the only way in. These surface the destinations directly. */}
        <div className="mb-7 grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[
            {
              label: 'Social Post',
              desc: 'Turn today’s news into a post',
              Icon: Sparkles,
              route: '/generate/social-media',
              accent: '#3f9fff',
            },
            {
              label: 'Music Studio',
              desc: 'Compose an Ambedkarite track',
              Icon: Music,
              route: '/generate/music',
              accent: '#7b5cff',
            },
            {
              label: 'BheemBot',
              desc: 'Ask the corpus a question',
              Icon: Bot,
              route: '/bheembot',
              accent: '#22c55e',
            },
          ].map(({ label, desc, Icon, route, accent }) => (
            <button
              key={label}
              type="button"
              onClick={() => navigate(route)}
              className="group flex items-center gap-3.5 rounded-2xl border p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
              style={{
                borderColor: 'rgba(30,50,96,0.7)',
                background: 'linear-gradient(135deg, rgba(13,21,49,0.9) 0%, rgba(10,17,48,0.6) 100%)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${accent}66`;
                e.currentTarget.style.boxShadow = `0 10px 30px ${accent}22`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(30,50,96,0.7)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${accent}1f`, color: accent }}
              >
                <Icon size={19} strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-semibold text-white">{label}</span>
                <span className="mt-0.5 block truncate text-[12.5px] text-[#8b94b8]">{desc}</span>
              </span>
              <ChevronRight
                size={16}
                strokeWidth={2}
                className="ml-auto shrink-0 text-[#3f6aaa] transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: accent }}
              />
            </button>
          ))}
        </div>

        {/* ── Stat cards ── */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Posts Generated"
            value={dataLoading ? '…' : String(totalPosts)}
            delta={null}
            icon={<FileText size={15} strokeWidth={2} />}
            iconGradient="bg-gradient-to-br from-[#3f9fff] to-[#2664d6]"
          />
          <StatCard
            label="Published Posts"
            value={dataLoading ? '…' : String(publishedPosts)}
            delta={null}
            icon={<Send size={15} strokeWidth={2} />}
            iconGradient="bg-gradient-to-br from-[#a855f7] to-[#7b3fd4]"
          />
          <StatCard
            label="Draft Posts"
            value={dataLoading ? '…' : String(draftPosts)}
            delta={null}
            icon={<FileText size={15} strokeWidth={2} />}
            iconGradient="bg-gradient-to-br from-[#22c55e] to-[#16a34a]"
          />
          <StatCard
            label="Preferences Set"
            value={dataLoading ? '…' : String(prefsAnswered)}
            delta={null}
            icon={<SlidersHorizontal size={15} strokeWidth={2} />}
            iconGradient="bg-gradient-to-br from-[#ffb056] to-[#ff7a2d]"
          />
        </div>

        {/* ── Charts row ── */}
        <div className="mt-5 grid gap-5 grid-cols-1 lg:grid-cols-2">
          <SearchActivityChart posts={posts} />
          <DailyActivityChart posts={posts} />
        </div>

        {/* ── Categories pie + image generation ── */}
        <div className="mt-5 grid gap-5 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CategoriesPieChart posts={posts} />
          </div>
          <ImageGenerationCard postCount={totalPosts} />
        </div>

        {/* ── Profile + Quota + Preferences ── */}
        <div id="profile-section" className="mt-5 grid gap-5 grid-cols-1 lg:grid-cols-3 scroll-mt-6">
          <div className="flex flex-col gap-5">
            <ProfileCard user={profileUser} />
            <DailyQuotaWidget quota={quota} loading={quotaLoading} />
          </div>
          <div className="lg:col-span-2">
            <PreferencesCard answers={profileAnswers} />
          </div>
        </div>

        {/* ── Recent posts ── */}
        <div className="mt-5">
          <RecentSearchesTable posts={posts} loading={dataLoading} />
        </div>

        {/* ── Published posts ── */}
        <div className="mt-5">
          <SavedPromptsGrid posts={posts.filter((p) => p.status === 'published')} />
        </div>

        {/* ── BheemBot + Achievements row ── */}
        <div className="mt-5 grid gap-5 grid-cols-1 lg:grid-cols-3">
          {/* BheemBot card */}
          <div
            className="relative overflow-hidden rounded-2xl border border-[#1e3260]/60 p-5"
            style={{ background: 'linear-gradient(135deg, #070f24 0%, #0d1a3e 100%)' }}
          >
            {/* Background glow */}
            <div className="pointer-events-none absolute -top-8 -right-8 h-32 w-32 rounded-full bg-[#2d6fff]/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-24 w-24 rounded-full bg-[#7b5cff]/15 blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2d6fff] to-[#7b5cff] shadow-[0_0_18px_rgba(79,107,255,0.4)]">
                  <Bot size={18} strokeWidth={2} className="text-white" />
                </div>
                <div>
                  <h3 className="font-display text-[15px] font-semibold text-white">BheemBot</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e] shadow-[0_0_5px_rgba(34,197,94,0.7)]" />
                    <span className="text-[11px] text-[#22c55e]">Online</span>
                  </div>
                </div>
              </div>

              <p className="text-[12.5px] leading-relaxed text-[#7a98bc] mb-4">
                Chat with Ambedkar&apos;s AI — ask about constitutional law, social justice, or his philosophy.
              </p>

              <div className="flex flex-wrap gap-1.5 mb-4">
                {['Constitution', 'Social Justice', 'Writings'].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[#1e3260]/60 bg-[#0a1428] px-2.5 py-0.5 text-[10.5px] text-[#5a7a9e]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <button
                type="button"
                onClick={() => navigate('/bheembot')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#2d6fff] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_18px_rgba(45,111,255,0.35)] transition hover:bg-[#3d7fff] hover:-translate-y-0.5"
              >
                <Sparkles size={13} strokeWidth={2} />
                Open Chat →
              </button>
            </div>
          </div>

          {/* Achievements — takes remaining 2 cols */}
          <div className="lg:col-span-2">
            <AchievementsGrid totalPosts={totalPosts} prefsAnswered={prefsAnswered} />
          </div>
        </div>

        <DashboardFooter />
        </div>{/* end px wrapper */}
      </div>
    </div>
  );
}
