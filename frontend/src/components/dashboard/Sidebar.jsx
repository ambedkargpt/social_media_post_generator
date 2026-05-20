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
} from 'lucide-react';

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',        Icon: LayoutGrid },
  { id: 'bheembot',   label: 'BheemBot',         Icon: Bot, route: '/bheembot' },
  { id: 'searches',   label: 'Post History',      Icon: Search, route: '/posts' },
  { id: 'prefs',      label: 'Preferences',      Icon: SlidersHorizontal, route: '/preferences' },
  { id: 'saved',      label: 'Saved Prompts',    Icon: Bookmark },
  { id: 'analytics',  label: 'Analytics',        Icon: BarChart3 },
  { id: 'profile',    label: 'Profile',          Icon: User },
  { id: 'settings',   label: 'Settings',         Icon: Settings },
];

export default function Sidebar({ active = 'dashboard', onSelect }) {
  const navigate = useNavigate();
  return (
    <aside
      className="hidden lg:flex flex-col w-[232px] shrink-0 border-r border-[#141d3a]/70"
      style={{ background: 'linear-gradient(180deg,#0a1024 0%,#070b1c 100%)' }}
    >
      {/* brand */}
      <div className="px-6 pt-7 pb-9">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#3f9fff] to-[#7b5cff] shadow-[0_0_18px_rgba(79,107,255,0.35)]">
            <span className="font-display text-[13px] font-bold text-white">AI</span>
          </div>
          <span className="font-display text-[16px] font-semibold tracking-tight gradient-text-blue">
            AI Dashboard
          </span>
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 px-4 space-y-1.5">
        {NAV.map((item) => {
          const isActive = item.id === active;
          const IconComp = item.Icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => { if (item.route) { navigate(item.route); } else { onSelect?.(item.id); } }}
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

      <div className="px-6 py-6 text-[11px] font-count text-[#4e5a80] tracking-wide">
        v1.0 · AmbedkarGPT
      </div>
    </aside>
  );
}
