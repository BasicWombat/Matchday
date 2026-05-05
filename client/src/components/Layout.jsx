import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  {
    to: '/', end: true, label: 'Dashboard',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ),
  },
  {
    to: '/games', label: 'Games',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        <path d="M2 12h20" />
      </svg>
    ),
  },
  {
    to: '/players', label: 'Players',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
  {
    to: '/stats', label: 'Stats',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <rect x="3"  y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7"  width="4" height="14" rx="1" />
        <rect x="17" y="3"  width="4" height="18" rx="1" />
      </svg>
    ),
  },
];

function NavItem({ to, end, label, icon, mobile }) {
  if (mobile) {
    return (
      <NavLink
        to={to}
        end={end}
        className={({ isActive }) =>
          `flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-medium tracking-wide transition-colors ${
            isActive ? 'text-gold-400' : 'text-pitch-400'
          }`
        }
      >
        {icon}
        {label}
      </NavLink>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-gold-500/15 text-gold-400 border-l-[3px] border-gold-500 pl-[9px]'
            : 'text-pitch-300 hover:text-white hover:bg-white/5'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 bg-pitch-950 flex-col z-30 shadow-xl">
        <div className="px-5 py-6 border-b border-white/5">
          <p className="text-gold-500 text-[10px] font-bold tracking-[0.2em] uppercase">Season 2024</p>
          <h1 className="font-bebas text-white text-3xl tracking-widest leading-none mt-0.5">
            Matchday
          </h1>
          <p className="text-pitch-400 text-xs mt-1.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Thunder FC
          </p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/5">
          <p className="text-pitch-600 text-[10px] text-center uppercase tracking-widest">Matchday v1.0</p>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────── */}
      <main className="md:ml-56 min-h-screen pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-pitch-950 border-t border-white/10 z-30">
        <div className="flex safe-area-inset-bottom">
          {NAV.map(item => (
            <NavItem key={item.to} {...item} mobile />
          ))}
        </div>
      </nav>
    </div>
  );
}
