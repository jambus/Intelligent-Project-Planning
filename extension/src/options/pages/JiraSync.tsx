import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { syncEpicLoggedHours } from '../../services/jira';
import { RefreshCcw, FileWarning } from 'lucide-react';
import { ErrorModal } from '../components/ErrorModal';

export const JiraSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<{title: string, message: string, details?: string} | null>(null);
  
  const projects = useLiveQuery(() => db.projects.toArray());
  
  // Only show projects that have a jiraEpicKey
  const epicProjects = projects?.filter(p => p.jiraEpicKey && p.jiraEpicKey.trim() !== '') || [];

  const handleSync = async () => {
    if (epicProjects.length === 0) return;
    setIsSyncing(true);
    setSyncError(null);

    try {
      const keys = epicProjects.map(p => p.jiraEpicKey);
      const hoursMap = await syncEpicLoggedHours(keys);

      // Update Dexie database
      const updates = epicProjects.map(p => {
        const stats = hoursMap[p.jiraEpicKey];
        if (stats) {
          return {
            ...p,
            devLoggedMd: stats.devLoggedMd,
            testLoggedMd: stats.testLoggedMd,
          };
        }
        return p;
      });

      await db.projects.bulkPut(updates);
      
    } catch (err: any) {
      console.error("Jira Sync Error:", err);
      setSyncError({
        title: "同步失败",
        message: "从 Jira 拉取工时数据时发生错误，请检查系统设置中的 Jira 配置是否正确，以及网络连接是否正常。",
        details: err.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jira 管理</h1>
          <p className="text-gray-500 text-sm mt-1">同步 Epic 已录入工时，系统排期时将自动扣减这些已发生工时。</p>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing || epicProjects.length === 0}
          className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-300 disabled:cursor-not-allowed"
        >
          <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} />
          <span>{isSyncing ? '正在同步...' : '一键同步 Jira 工时'}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-0 overflow-x-auto">
          {epicProjects.length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 px-4">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                 <FileWarning size={24} className="text-gray-400" />
               </div>
               <p className="text-gray-500 font-medium">当前没有任何关联 Jira Epic Key 的项目</p>
               <p className="text-gray-400 text-sm mt-1">请先在「项目管理」导入包含 Epic Key 的项目</p>
             </div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/50 text-xs">
                  <th className="p-4">项目名称</th>
                  <th className="p-4">Epic Key</th>
                  <th className="p-4 text-center border-l border-gray-100">开发总需求 (MD)</th>
                  <th className="p-4 text-center text-blue-600 bg-blue-50/10">开发已录入 (MD)</th>
                  <th className="p-4 text-center border-l border-gray-100">测试总需求 (MD)</th>
                  <th className="p-4 text-center text-teal-600 bg-teal-50/10">测试已录入 (MD)</th>
                </tr>
              </thead>
              <tbody>
                {epicProjects.map(p => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 font-bold text-gray-900 max-w-[300px] truncate" title={p.name}>{p.name}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 font-mono text-xs rounded font-bold">{p.jiraEpicKey}</span></td>
                    
                    <td className="p-4 text-center font-mono font-medium border-l border-gray-50">{p.devTotalMd}</td>
                    <td className="p-4 text-center font-mono font-bold text-blue-600 bg-blue-50/10">
                      {p.devLoggedMd !== undefined ? p.devLoggedMd.toFixed(1) : '-'}
                    </td>
                    
                    <td className="p-4 text-center font-mono font-medium border-l border-gray-50">{p.testTotalMd}</td>
                    <td className="p-4 text-center font-mono font-bold text-teal-600 bg-teal-50/10">
                      {p.testLoggedMd !== undefined ? p.testLoggedMd.toFixed(1) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {syncError && (
        <ErrorModal
          isOpen={true}
          title={syncError.title}
          message={syncError.message}
          errorDetails={syncError.details}
          onClose={() => setSyncError(null)}
        />
      )}
    </div>
  );
};
