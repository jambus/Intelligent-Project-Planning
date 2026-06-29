import { Outlet, Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Users2, Settings, FolderKanban, CalendarDays, Tags, Wrench, RefreshCw } from 'lucide-react';
import { useTranslation } from '../context/I18nContext';

export const Layout = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { 
      name: t('nav.dashboard'), 
      icon: <LayoutDashboard size={20} />,
      subItems: [
        { name: t('nav.overview'), path: '/' },
        { name: t('nav.teamCapacity'), path: '/team-capacity' },
        { name: t('nav.projectResults'), path: '/project-results' },
        { name: t('nav.scheduleDetails'), path: '/schedule-details' },
      ]
    },
    { name: t('nav.projects'), path: '/projects', icon: <FolderKanban size={20} /> },
    { name: t('nav.jiraSync'), path: '/jira-sync', icon: <RefreshCw size={20} /> },
    { name: t('nav.resources'), path: '/resources', icon: <Users size={20} /> },
    { name: t('nav.scrum'), path: '/scrum', icon: <Users2 size={20} /> },
    { name: t('nav.skills'), path: '/skills', icon: <Tags size={20} /> },
    { name: t('nav.productOps'), path: '/product-ops', icon: <Wrench size={20} /> },
    { name: t('nav.holidays'), path: '/holidays', icon: <CalendarDays size={20} /> },
    { name: t('nav.settings'), path: '/settings', icon: <Settings size={20} /> },
  ];

  const version = typeof chrome !== 'undefined' && chrome.runtime?.getManifest 
    ? chrome.runtime.getManifest().version 
    : '1.0.8';

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3 mb-1">
            <img src="/icons/icon_128.png" alt="IRP Logo" className="w-8 h-8 rounded-lg shadow-sm" />
            <h1 className="text-xl font-bold text-blue-600 tracking-tight">{t('nav.appTitle')}</h1>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider ml-11">IRP Assistant</p>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            if (item.subItems) {
              return (
                <div key={item.name} className="space-y-1 mb-2">
                  <div className="flex items-center space-x-3 px-4 py-2.5 rounded-lg font-bold text-gray-800">
                    {item.icon}
                    <span>{item.name}</span>
                  </div>
                  <div className="ml-7 border-l-2 border-gray-100 pl-2 space-y-1">
                    {item.subItems.map(sub => {
                      const isActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`flex items-center px-4 py-2 rounded-lg transition-colors text-sm ${
                            isActive 
                              ? 'bg-blue-50 text-blue-700 font-bold' 
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
                          }`}
                        >
                          {sub.name}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path || item.name}
                to={item.path!}
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

        {/* Sidebar Footer / Version */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Version</span>
            <span className="text-[10px] font-bold text-blue-400 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              v{version}
            </span>
          </div>
        </div>
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
