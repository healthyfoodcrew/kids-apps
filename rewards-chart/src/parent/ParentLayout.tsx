import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon, UI_ICONS } from '../components/Icon';
import { useAuth, useNow } from '../lib/store';

const TABS = [
  { to: '/parent', label: 'Today', icon: UI_ICONS.home, end: true },
  { to: '/parent/adjust', label: 'Give / take', icon: UI_ICONS.plusminus, end: false },
  { to: '/parent/payday', label: 'Pay day', icon: UI_ICONS.wallet, end: false },
  { to: '/parent/setup', label: 'Setup', icon: UI_ICONS.settings, end: false },
];

export function ParentLayout({ children }: { children: ReactNode }) {
  const { role, unlockedUntil, lock } = useAuth();
  const now = useNow(15_000);
  const navigate = useNavigate();
  const minsLeft = Math.max(0, Math.ceil((unlockedUntil - now.getTime()) / 60_000));

  return (
    <div className="parent">
      <div className="p-main">
        {role === 'tablet' && (
          <div className="p-banner" role="status">
            <Icon d={UI_ICONS.unlock} size={20} />
            <span className="grow">Parent mode on the kids' iPad · locks in {minsLeft} min</span>
            <button
              className="p-btn"
              onClick={async () => {
                await lock();
                navigate('/');
              }}
            >
              Lock now
            </button>
          </div>
        )}
        {children}
      </div>
      <nav className="p-nav" aria-label="Parent menu">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon d={t.icon} size={22} strokeWidth={1.9} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function KidDot({ name, color }: { name: string; color: string }) {
  return (
    <span className="kid-dot" style={{ background: color }} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Darker shade of a kid's colour that reads well on white. */
export function inkOf(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  // Darken until contrast with white is comfortable.
  const lum = () => {
    const c = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  for (let i = 0; i < 20 && 1.05 / (lum() + 0.05) < 4.6; i++) {
    r = Math.round(r * 0.88);
    g = Math.round(g * 0.88);
    b = Math.round(b * 0.88);
  }
  return `rgb(${r}, ${g}, ${b})`;
}
