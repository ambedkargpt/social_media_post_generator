import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Send, SlidersHorizontal, LogOut } from 'lucide-react';

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

export default function Dashboard() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState('dashboard');

  const [posts,            setPosts]           = useState([]);
  const [profileAnswers,   setProfileAnswers]  = useState([]);
  const [dataLoading,      setDataLoading]     = useState(true);
  const [quota,            setQuota]           = useState(null);
  const [quotaLoading,     setQuotaLoading]    = useState(true);

  useEffect(() => {
    if (!currentUser?.id) return;
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

  const topbarUser  = { name: displayName };
  const profileUser = { name: displayName, email: displayEmail, joined: joinedLabel, postCount: totalPosts };

  const first = displayName.split('_')[0];

  return (
    <div
      className="flex h-screen overflow-hidden text-[#e5e7eb]"
      style={{ background: 'radial-gradient(1200px 700px at 20% 0%, #0d1636 0%, #070b1c 55%, #05081a 100%)' }}
    >
      <Sidebar active={active} onSelect={setActive} />

      <div className="relative flex-1 min-w-0 overflow-y-auto">
        <MilestoneBanner totalPosts={quota?.total_posts} />
        <div className="px-6 md:px-10">
        <div className="pointer-events-none fixed top-0 right-0 h-[420px] w-[420px] rounded-full bg-[#3f9fff]/10 blur-[130px]" />
        <div className="pointer-events-none fixed bottom-0 left-[22%] h-[360px] w-[360px] rounded-full bg-[#7b5cff]/10 blur-[130px]" />

        <Topbar user={topbarUser} />

        {/* ── Welcome ── */}
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-[28px] md:text-[32px] font-bold leading-tight tracking-tight">
              <span className="text-white">Welcome back, </span>
              <span className="gradient-text-blue">{first}</span>
            </h1>
            <p className="mt-1.5 text-[13.5px] text-[#8b94b8]">
              Your AI journey continues. Let&apos;s make today productive and insightful!
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="hidden md:inline-flex items-center gap-2 rounded-full border border-[#1e3260]/70 bg-[#0d1531]/50 px-4 py-2 text-[12.5px] font-medium text-[#8b94b8] transition hover:border-[#3a6bc4]/60 hover:text-white"
          >
            <LogOut size={13} strokeWidth={1.9} />
            Log out
          </button>
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
        <div className="mt-5 grid gap-5 grid-cols-1 lg:grid-cols-3">
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

        {/* ── Achievements ── */}
        <div className="mt-5">
          <AchievementsGrid totalPosts={totalPosts} prefsAnswered={prefsAnswered} />
        </div>

        <DashboardFooter />
        </div>{/* end px wrapper */}
      </div>
    </div>
  );
}
