import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, FolderKanban } from 'lucide-react';

export const Layout = () => {
  const location = useLocation();

  const navItems = [
    { name: '仪表盘', path: '/', icon: <LayoutDashboard size={20} /> },
    { name: '项目管理', path: '/projects', icon: <FolderKanban size={20} /> },
    { name: '人员管理', path: '/resources', icon: <Users size={20} /> },
    { name: '系统设置', path: '/settings', icon: <Settings size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-blue-600 tracking-tight">智能排期系统</h1>
          <p className="text-xs text-gray-500 mt-1">Intelligent Resource Planner</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
