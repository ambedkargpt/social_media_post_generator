import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Search,
  SlidersHorizontal,
  Bookmark,
  BarChart3,
  User,
  Settings,
  Bot,
  X,
  LogOut,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

// Generating a post is the product's primary action, so it leads the nav and is
// styled as a call to action rather than another list item.
const PRIMARY = { id: 'generate', label: 'Generate', Icon: Sparkles, route: '/generate' };

// `soon: true` marks a destination that does not exist yet. Rendering these as
// plain items made them look broken: clicking did nothing and gave no feedback.
const NAV = [
  { id: 'dashboard',  label: 'Dashboard',        Icon: LayoutGrid },
  { id: 'bheembot',   label: 'BheemBot',         Icon: Bot, route: '/bheembot' },
  { id: 'searches',   label: 'Post History',     Icon: Search, route: '/posts' },
  { id: 'prefs',      label: 'Preferences',      Icon: SlidersHorizontal, route: '/preferences' },
  { id: 'saved',      label: 'Saved Prompts',    Icon: Bookmark, soon: true },
  { id: 'analytics',  label: 'Analytics',        Icon: BarChart3, soon: true },
  { id: 'profile',    label: 'Profile',          Icon: User, route: '/profile-setup' },
  { id: 'settings',   label: 'Settings',         Icon: Settings, soon: true },
];

function SidebarContent({ active, onSelect, onClose, onLogout }) {
  const navigate = useNavigate();
  return (
    <>
      {/* brand */}
      <div className="flex items-center justify-between px-6 pt-7 pb-9">
        <button
          type="button"
          onClick={() => { navigate('/dashboard'); onClose?.(); }}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <span className="font-display text-[16px] font-semibold tracking-tight gradient-text-blue">
            Dashboard
          </span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a7a9e] transition hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            <X size={16} strokeWidth={1.8} />
          </button>
        )}
      </div>

      {/* nav */}
      <nav className="flex-1 px-4 space-y-1.5">
        {/* Primary action */}
        <button
          type="button"
          onClick={() => { navigate(PRIMARY.route); onClose?.(); }}
          className="group mb-3 flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-[14px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          style={{
            background: 'linear-gradient(135deg, #1a5fff 0%, #3f9fff 100%)',
            boxShadow: '0 6px 22px rgba(26,95,255,0.38)',
          }}
        >
          <PRIMARY.Icon size={17} strokeWidth={2} />
          <span>{PRIMARY.label}</span>
          <ChevronRight
            size={15}
            strokeWidth={2}
            className="ml-auto transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </button>

        {NAV.map((item) => {
          const isActive = item.id === active;
          const IconComp = item.Icon;
          if (item.soon) {
            // Not navigable yet — say so instead of failing silently on click.
            return (
              <div
                key={item.id}
                title={`${item.label} — coming soon`}
                aria-disabled="true"
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-[#4d587a]"
              >
                <IconComp size={17} strokeWidth={1.8} />
                <span>{item.label}</span>
                <span className="ml-auto rounded-full bg-[#141d3a] px-1.5 py-0.5 font-count text-[9.5px] uppercase tracking-wider text-[#5a6e9a]">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.route) { navigate(item.route); }
                else { onSelect?.(item.id); }
                onClose?.();
              }}
              className={[
                'group relative flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                isActive
                  ? 'text-white'
                  : 'text-[#7b88ad] hover:text-[#c7d1eb] hover:bg-[#0f173a]/70',
              ].join(' ')}
              style={
                isActive
                  ? {
                      background:
                        'linear-gradient(90deg, rgba(63,110,255,0.32) 0%, rgba(79,107,255,0.12) 100%)',
                      border: '1px solid rgba(79,135,255,0.28)',
                      boxShadow: '0 4px 18px rgba(15,40,100,0.35)',
                    }
                  : { border: '1px solid transparent' }
              }
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-[#3f9fff] to-[#7b5cff]" />
              )}
              <IconComp size={17} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-4 pt-2">
        {/* Logout — shown in mobile overlay only */}
        {onLogout && (
          <button
            type="button"
            onClick={() => { onClose?.(); onLogout(); }}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-[#7b88ad] transition hover:bg-[#0f173a]/70 hover:text-red-400 lg:hidden"
            style={{ border: '1px solid transparent' }}
          >
            <LogOut size={17} strokeWidth={1.8} />
            <span>Log Out</span>
          </button>
        )}
        <div className="px-2 pt-2 text-[11px] font-count text-[#4e5a80] tracking-wide">
          v1.0 · AmbedkarGPT
        </div>
      </div>
    </>
  );
}

export default function Sidebar({ active = 'dashboard', onSelect, mobileOpen = false, onMobileClose, onLogout }) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col w-[232px] shrink-0 border-r border-[#141d3a]/70"
        style={{ background: 'linear-gradient(180deg,#0a1024 0%,#070b1c 100%)' }}
      >
        <SidebarContent active={active} onSelect={onSelect} />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside
            className="absolute left-0 top-0 flex h-full w-[260px] flex-col border-r border-[#141d3a]/70"
            style={{ background: 'linear-gradient(180deg,#0a1024 0%,#070b1c 100%)' }}
          >
            <SidebarContent active={active} onSelect={onSelect} onClose={onMobileClose} onLogout={onLogout} />
          </aside>
        </div>
      )}
    </>
  );
}
