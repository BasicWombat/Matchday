import { useState, useEffect } from 'react';
import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSeason } from '../context/SeasonContext';
import { api } from '../api';

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
  {
    to: '/settings', label: 'Settings',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
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
  const { user, logout } = useAuth();
  const { seasons, selectedSeason, selectedSeasonId, setSelectedSeasonId, isViewingNonActive } = useSeason();
  const [myTeamName, setMyTeamName] = useState(null);

  useEffect(() => {
    if (!user?.my_team_id) { setMyTeamName(null); return; }
    api.getTeam(user.my_team_id)
      .then(t => setMyTeamName(t.name))
      .catch(() => setMyTeamName(null));
  }, [user?.my_team_id]);

  return (
    <div className="min-h-screen">
      {/* ── Desktop sidebar ─────────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-56 bg-pitch-950 flex-col z-30 shadow-xl">
        <div className="px-5 py-6 border-b border-white/5">
          {seasons.length > 1 ? (
            <select
              value={selectedSeasonId ?? ''}
              onChange={e => setSelectedSeasonId(Number(e.target.value))}
              className="text-gold-500 text-[10px] font-bold tracking-[0.2em] uppercase bg-transparent border-none cursor-pointer focus:outline-none w-full appearance-none"
            >
              {seasons.map(s => (
                <option key={s.id} value={s.id} className="text-pitch-900 font-normal normal-case tracking-normal">
                  {s.name}{s.is_active ? ' ★' : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-gold-500 text-[10px] font-bold tracking-[0.2em] uppercase">
              {selectedSeason?.name ?? 'Matchday'}
            </p>
          )}
          <h1 className="font-bebas text-white text-3xl tracking-widest leading-none mt-0.5">
            Matchday
          </h1>
          {myTeamName && (
            <p className="text-pitch-400 text-xs mt-1.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {myTeamName}
            </p>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(item => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* User area */}
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-white text-sm font-semibold truncate">{user?.display_name}</p>
          <p className="text-pitch-500 text-xs truncate">{user?.username}</p>
          <div className="flex gap-2 mt-2">
            <Link to="/account" className="flex-1 text-center text-[11px] font-medium text-pitch-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1.5 rounded-lg transition-colors">
              My Account
            </Link>
            <button
              onClick={logout}
              className="flex-1 text-[11px] font-medium text-pitch-400 hover:text-red-400 bg-white/5 hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────── */}
      <main className="md:ml-56 min-h-screen pb-20 md:pb-0">
        {/* Mobile season bar */}
        <div className="md:hidden bg-pitch-950 border-b border-white/10 px-4 py-2 flex items-center gap-2">
          <span className="text-gold-500 text-[10px] font-bold tracking-[0.15em] uppercase shrink-0">Season</span>
          {seasons.length > 1 ? (
            <select
              value={selectedSeasonId ?? ''}
              onChange={e => setSelectedSeasonId(Number(e.target.value))}
              className="flex-1 text-gold-400 text-xs font-semibold bg-transparent border-none cursor-pointer focus:outline-none"
            >
              {seasons.map(s => (
                <option key={s.id} value={s.id} className="text-pitch-900 font-normal">
                  {s.name}{s.is_active ? ' ★' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-gold-400 text-xs font-semibold">{selectedSeason?.name ?? '—'}</span>
          )}
        </div>

        {/* Non-active season banner */}
        {isViewingNonActive && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 text-center">
            Viewing <strong>{selectedSeason?.name}</strong> — this is not the current season
          </div>
        )}

        <Outlet />
      </main>

      {/* ── Mobile bottom nav ───────────────────────────────── */}
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
