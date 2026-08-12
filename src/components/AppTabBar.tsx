import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../lib/useTheme';
import { LayoutDashboard, CreditCard, Settings as SettingsIcon, Moon, Sun } from 'lucide-react';

/**
 * Phone-width primary navigation: a fixed bottom tab bar (Rooms / Billing /
 * Settings / Theme) shared by the three main app screens. Desktop keeps the
 * side rails; below 720px this bar replaces them, so the same destinations
 * stay reachable without recall. Theme rides along so the toggle is never
 * hidden on small screens.
 */
export function AppTabBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { label: 'Rooms', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Billing', icon: CreditCard, path: '/billing' },
    { label: 'Settings', icon: SettingsIcon, path: '/settings' },
  ];

  return (
    <nav className="app-tabbar" aria-label="Primary">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            className={`app-tab${active ? ' active' : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={() => navigate(tab.path)}
          >
            <Icon size={18} />
            <span>{tab.label}</span>
          </button>
        );
      })}
      <button className="app-tab" onClick={toggleTheme} aria-label="Toggle theme">
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        <span>Theme</span>
      </button>
    </nav>
  );
}
