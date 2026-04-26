import { createRoot } from 'react-dom/client';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Calendar, Users, Settings } from 'lucide-react';
import '../index.css';

const PopupApp = () => {
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  const allocations = useLiveQuery(() => db.allocations.toArray());

  return (
    <div className="p-5 flex flex-col h-full bg-gray-50 min-w-[300px]">
      <div className="text-center mb-6 flex flex-col items-center">
        <img src="/icons/icon_128.png" alt="Logo" className="w-12 h-12 rounded-xl shadow-md mb-3" />
        <h2 className="text-lg font-bold text-gray-900 tracking-tight">智能资源排期系统</h2>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">IRP Assistant</p>
      </div>

      <div className="flex-1 space-y-3">
        <div className="bg-white p-3 rounded-lg border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3 text-gray-600">
            <Users size={18} className="text-blue-500" />
            <span className="text-sm font-medium">团队人员</span>
          </div>
          <span className="font-bold text-gray-900">{resources?.length || 0}</span>
        </div>

        <div className="bg-white p-3 rounded-lg border border-gray-100 flex items-center justify-between shadow-sm">
          <div className="flex items-center space-x-3 text-gray-600">
            <Calendar size={18} className="text-indigo-500" />
            <span className="text-sm font-medium">待排项目</span>
          </div>
          <span className="font-bold text-gray-900">{projects?.length || 0}</span>
        </div>

        <div className="bg-white p-3 rounded-lg border border-gray-100 flex flex-col shadow-sm mt-4">
          <span className="text-xs text-gray-500 mb-1">全局资源利用率概览</span>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all" 
              style={{ width: `${Math.min((allocations?.length || 0) * 10, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <button 
          className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg shadow hover:bg-blue-700 transition-colors font-medium flex items-center justify-center space-x-2 text-sm"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <Calendar size={16} />
          <span>打开全局大盘</span>
        </button>
        <button 
          className="w-full bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center space-x-2 text-sm"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          <Settings size={16} />
          <span>系统设置</span>
        </button>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<PopupApp />);
}
