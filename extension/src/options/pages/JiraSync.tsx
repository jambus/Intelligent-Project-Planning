import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { syncEpicLoggedHours } from '../../services/jira';
import { RefreshCcw, FileWarning, CheckSquare, Square, AlertCircle, Clock } from 'lucide-react';
import { ErrorModal } from '../components/ErrorModal';

export const JiraSync = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<{title: string, message: string, details?: string} | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [syncProgress, setSyncProgress] = useState<{current: number, total: number} | null>(null);
  const [syncErrorsList, setSyncErrorsList] = useState<Array<{projectName: string, epicKey: string, message: string}>>([]);

  
  const projects = useLiveQuery(() => db.projects.toArray());
  
  // Only show projects that have a jiraEpicKey
  const epicProjects = projects?.filter(p => p.jiraEpicKey && p.jiraEpicKey.trim() !== '') || [];

  // Toggle project selection
  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedProjects);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setSelectedProjects(newSet);
  };
  const toggleAll = () => {
    if (selectedProjects.size === epicProjects.length) setSelectedProjects(new Set());
    else setSelectedProjects(new Set(epicProjects.map(p => p.id!)));
  };

  const handleSync = async () => {
    const targets = epicProjects.filter(p => selectedProjects.has(p.id!));
    if (targets.length === 0) return;

    // Check for recent syncs (within 30 mins)
    const now = Date.now();
    const recentSyncs = targets.filter(p => p.lastJiraSyncAt && (now - p.lastJiraSyncAt) < 30 * 60 * 1000);
    if (recentSyncs.length > 0) {
      if (!window.confirm(`有 ${recentSyncs.length} 个项目在 30 分钟内已经同步过，频繁同步可能会触发 Jira API 限制。是否继续强制同步？`)) {
        return;
      }
    }

    setIsSyncing(true);
    setSyncError(null);
    setSyncErrorsList([]);
    setSyncProgress({ current: 0, total: targets.length });

    const errors: Array<{projectName: string, epicKey: string, message: string}> = [];

    try {
      const keys = targets.map(p => p.jiraEpicKey);
      const hoursMap = await syncEpicLoggedHours(keys);

      for (const p of targets) {
        const stats = hoursMap[p.jiraEpicKey];
        if (stats) {
          await db.projects.update(p.id!, {
            totalLoggedMd: stats.totalLoggedMd,
            devLoggedMd: stats.devLoggedMd,
            testLoggedMd: stats.testLoggedMd,
            lastJiraSyncAt: Date.now()
          });
        }
      }
    } catch (err: any) {
      console.error("Jira Sync Error:", err);
      if (err.message === 'JIRA_AUTH_ERROR') {
        setSyncError({
          title: '未登录 Jira',
          message: '检测到您尚未登录 Jira，或登录态已失效。请先登录 Jira 然后再尝试同步。',
          details: '请在新标签页中打开 Jira 并登录。如果您配置了 API Token，请检查 Token 是否有效。'
        });
      } else {
        errors.push({ projectName: '全局', epicKey: '-', message: err.message || '未知错误' });
      }
    }

    setSyncProgress(null);
    setIsSyncing(false);
    
    if (errors.length > 0) {
      setSyncErrorsList(errors);
    }
  };

  const formatTime = (ts?: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.getMonth()+1}-${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jira 管理</h1>
          <p className="text-gray-500 text-sm mt-1">同步 Epic 已录入工时，系统排期时将自动扣减这些已发生工时。</p>
        </div>
        <div className="flex items-center space-x-4">
          {syncProgress && (
            <div className="flex items-center space-x-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <div className="w-32 h-2 bg-blue-200 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}></div>
              </div>
              <span className="text-sm font-bold text-blue-700">{syncProgress.current} / {syncProgress.total}</span>
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={isSyncing || selectedProjects.size === 0}
            className="flex items-center space-x-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={18} className={isSyncing ? "animate-spin" : ""} />
            <span>{isSyncing ? '正在同步...' : `同步选中项目 (${selectedProjects.size})`}</span>
          </button>
        </div>
      </div>
      
      {syncErrorsList.length > 0 && (
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex items-center space-x-2 text-red-800 font-bold mb-2">
            <AlertCircle size={18} />
            <span>部分项目同步失败 ({syncErrorsList.length})</span>
          </div>
          <ul className="list-disc pl-5 text-sm text-red-600 space-y-1">
            {syncErrorsList.map((err, i) => (
              <li key={i}><strong>{err.projectName} ({err.epicKey})</strong>: {err.message}</li>
            ))}
          </ul>
        </div>
      )}

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
                  <th className="p-4 w-12 text-center cursor-pointer" onClick={toggleAll}>
                    {selectedProjects.size === epicProjects.length && epicProjects.length > 0 ? <CheckSquare size={16} className="text-blue-600 mx-auto" /> : <Square size={16} className="mx-auto" />}
                  </th>
                  <th className="p-4">项目名称</th>
                  <th className="p-4">Epic Key</th>
                  <th className="p-4 text-center border-l border-gray-100">已消费 / 评估开发</th>
                  <th className="p-4 text-center border-l border-gray-100">已消费 / 评估测试</th>
                  <th className="p-4 text-center text-blue-600 bg-blue-50/10">已消费总工时</th>
                  <th className="p-4 text-center text-green-600 bg-green-50/10 border-l border-gray-100">剩余总计</th>
                  <th className="p-4 text-center border-l border-gray-100">最近同步</th>
                </tr>
              </thead>
              <tbody>
                {epicProjects.map(p => {
                  const isSelected = selectedProjects.has(p.id!);
                  return (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors ${isSelected ? 'bg-blue-50/10' : ''}`}>
                    <td className="p-4 text-center cursor-pointer" onClick={() => toggleSelection(p.id!)}>
                      {isSelected ? <CheckSquare size={16} className="text-blue-600 mx-auto" /> : <Square size={16} className="text-gray-300 mx-auto" />}
                    </td>
                    <td className="p-4 font-bold text-gray-900 max-w-[200px] truncate" title={p.name}>{p.name}</td>
                    <td className="p-4"><span className="px-2 py-1 bg-gray-100 text-gray-600 font-mono text-[10px] rounded font-bold">{p.jiraEpicKey}</span></td>
                    
                    <td className="p-4 text-center font-mono border-l border-gray-50">
                      <span className="font-bold text-gray-900">{p.devLoggedMd !== undefined ? p.devLoggedMd.toFixed(1) : '-'}</span> / <span className="text-gray-500">{p.devTotalMd}</span>
                    </td>
                    <td className="p-4 text-center font-mono border-l border-gray-50">
                      <span className="font-bold text-gray-900">{p.testLoggedMd !== undefined ? p.testLoggedMd.toFixed(1) : '-'}</span> / <span className="text-gray-500">{p.testTotalMd}</span>
                    </td>
                    
                    <td className="p-4 text-center font-mono font-bold text-blue-600 bg-blue-50/10">
                      {p.totalLoggedMd !== undefined ? p.totalLoggedMd.toFixed(1) : '-'}
                    </td>
                    {(() => {
                      if (p.totalLoggedMd === undefined) {
                        return (
                          <td className="p-4 text-center font-mono font-bold text-gray-400 bg-gray-50/10 border-l border-gray-100">
                            -
                          </td>
                        );
                      }
                      const remaining = (p.devTotalMd + p.testTotalMd) - p.totalLoggedMd;
                      const isOverBudget = remaining < 0;
                      return (
                        <td className={`p-4 text-center font-mono font-bold border-l border-gray-100 ${
                          isOverBudget ? 'text-red-600 bg-red-50/50' : 'text-green-600 bg-green-50/10'
                        }`}>
                          {remaining.toFixed(1)}
                        </td>
                      );
                    })()}
                    <td className="p-4 text-center font-mono text-[10px] text-gray-500 border-l border-gray-100">
                      {p.lastJiraSyncAt ? <div className="flex items-center justify-center space-x-1"><Clock size={12}/><span>{formatTime(p.lastJiraSyncAt)}</span></div> : '-'}
                    </td>
                  </tr>
                )})}
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
