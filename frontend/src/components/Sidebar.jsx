import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: '□' },
  { to: '/members', label: 'Members', icon: '○' },
  { to: '/policies', label: 'Policies', icon: '◇' },
  { to: '/services', label: 'Services', icon: '△' },
  { to: '/claims', label: 'Claims', icon: '▽' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
      <div className="px-6 py-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">Claims Processing</h1>
        <p className="text-xs text-slate-400 mt-0.5">System</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <span className="text-base">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
