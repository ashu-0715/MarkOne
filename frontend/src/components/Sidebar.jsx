import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/', label: 'Home' },
  { to: '/teacher/dashboard', label: 'Dashboard' },
  { to: '/teacher/question-bank', label: 'Question Bank' },
  { to: '/teacher/create-test', label: 'Create Test' },
  { to: '/teacher/reports', label: 'Reports' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <aside className={`teacher-sidebar ${menuOpen ? 'teacher-sidebar-open' : ''}`}>
      <div className="teacher-sidebar-header px-6 py-6">
        <div className="min-w-0">
          <span className="font-display font-bold text-xl">
            Mark<span className="text-accent">One</span>
          </span>
          <p className="text-xs text-muted mt-1 truncate">{user?.fullName}</p>
        </div>
        <button
          type="button"
          className="teacher-menu-button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close teacher menu' : 'Open teacher menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.label}
            to={l.to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) =>
              `teacher-nav-link ${
                isActive ? 'teacher-nav-link-active' : 'teacher-nav-link-idle'
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <div className="teacher-sidebar-footer p-4">
        <button onClick={logout} className="btn-ghost w-full text-sm">
          Log out
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
