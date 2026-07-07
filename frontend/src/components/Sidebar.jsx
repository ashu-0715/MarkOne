import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const links = [
  { to: '/teacher/dashboard', label: 'Dashboard' },
  { to: '/teacher/question-bank', label: 'Question Bank' },
  { to: '/teacher/create-test', label: 'Create Test' },
];

const Sidebar = () => {
  const { user, logout } = useAuth();

  return (
    <aside className="teacher-sidebar">
      <div className="teacher-sidebar-header px-6 py-6">
        <span className="font-display font-bold text-xl">
          Mark<span className="text-accent">One</span>
        </span>
        <p className="text-xs text-muted mt-1 truncate">{user?.fullName}</p>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {links.map((l) => (
          <NavLink
            key={l.label}
            to={l.to}
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
