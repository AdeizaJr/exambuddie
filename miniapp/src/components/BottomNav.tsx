import { NavLink } from 'react-router-dom';
import { haptic } from '../telegram';

const tabs = [
  { to: '/',        label: 'Home',     icon: '🏠' },
  { to: '/practice', label: 'Practice', icon: '📚' },
  { to: '/quiz',    label: 'Quiz',     icon: '📋' },
  { to: '/stats',   label: 'Stats',    icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t"
      style={{ background: 'var(--tg-secondary-bg)', borderColor: 'rgba(0,0,0,0.1)' }}>
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.to === '/'}
          onClick={() => haptic('selection')}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center flex-1 py-2 text-xs transition-colors ${
              isActive
                ? 'text-[var(--tg-button)]'
                : 'text-[var(--tg-hint)]'
            }`
          }
        >
          <span className="text-xl leading-none mb-0.5">{tab.icon}</span>
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
