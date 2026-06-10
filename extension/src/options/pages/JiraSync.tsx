import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { syncEpicLoggedHours, type UnmatchedAuthor } from '../../services/jira';
import { RefreshCcw, FileWarning, CheckSquare, Square, AlertCircle, Clock, UserPlus, X } from 'lucide-react';
import { ErrorModal } from '../components/ErrorModal';
import { useTranslation } from '../../context/I18nContext';

export const JiraSync = () => {
  const { t } = useTranslation();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<{title: string, message: string, details?: string} | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());
  const [syncProgress, setSyncProgress] = useState<{current: number, total: number} | null>(null);
  const [syncErrorsList, setSyncErrorsList] = useState<Array<{projectName: string, epicKey: string, message: string}>>([]);
  const [unmatchedAuthors, setUnmatchedAuthors] = useState<UnmatchedAuthor[]>([]);
  const [authorAssign, setAuthorAssign] = useState<Record<string, number>>({});

  const now = new Date();
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const formatDate = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [startDate, setStartDate] = useState(formatDate(defaultStart));
  const [endDate, setEndDate] = useState(formatDate(defaultEnd));
  
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  
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
    setUnmatchedAuthors([]);
    setAuthorAssign({});
    setSyncProgress({ current: 0, total: targets.length });

    const errors: Array<{projectName: string, epicKey: string, message: string}> = [];
    const unmatchedCollector: Record<string, UnmatchedAuthor> = {};

    try {
      const keys = targets.map(p => p.jiraEpicKey);
      const hoursMap = await syncEpicLoggedHours(keys, (resources || []).map(r => ({
        name: r.name,
        role: r.role,
        aliases: (r.jiraAliases || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean)
      })), unmatchedCollector, startDate, endDate);

      let done = 0;
      for (const p of targets) {
        const stats = hoursMap[p.jiraEpicKey];
        if (stats) {
          await db.projects.update(p.id!, {
            totalLoggedMd: stats.totalLoggedMd,
            devLoggedMd: stats.devLoggedMd,
            testLoggedMd: stats.testLoggedMd,
            jiraEpicStatus: stats.status,
            jiraStoryCount: stats.storyCount,
            jiraTaskCount: stats.taskCount,
            jiraBugCount: stats.bugCount,
            lastJiraSyncAt: Date.now()
          });
        } else {
          // Batch returned no data for this Epic (e.g. wrong key or no worklog).
          errors.push({ projectName: p.name, epicKey: p.jiraEpicKey, message: '未获取到该 Epic 的工时数据（请检查 Epic Key 是否正确或是否有登记工时）' });
        }
        done += 1;
        setSyncProgress({ current: done, total: targets.length });
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

    // Surface worklog authors that couldn't be mapped to any team member so the
    // user can configure their Jira identity instead of silently ignoring them.
    const unmatched = Object.values(unmatchedCollector).sort((a, b) => b.totalSeconds - a.totalSeconds);
    if (unmatched.length > 0) {
      setUnmatchedAuthors(unmatched);
    }
  };

  // Map an unmatched Jira author to a roster member by appending their identity
  // (accountId / email / display name) to that member's jiraAliases.
  const authorKey = (a: UnmatchedAuthor) => (a.accountId || a.email || a.displayName || '').toLowerCase();
  const assignAuthor = async (author: UnmatchedAuthor) => {
    const key = authorKey(author);
    const resourceId = authorAssign[key];
    if (!resourceId) return;
    const resource = (resources || []).find(r => r.id === resourceId);
    if (!resource) return;
    // Prefer the most reliable identifier: accountId > email > display name.
    const identifier = author.accountId || author.email || author.displayName;
    if (!identifier) return;
    const existing = (resource.jiraAliases || '').split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
    if (!existing.includes(identifier)) existing.push(identifier);
    await db.resources.update(resource.id!, { jiraAliases: existing.join(', ') });
    setUnmatchedAuthors(prev => prev.filter(a => authorKey(a) !== key));
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
          <h1 className="text-2xl font-bold text-gray-900">{t('jiraSync.title')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('jiraSync.desc')}</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <span className="text-sm text-gray-500 font-medium">同步范围:</span>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium cursor-pointer"
            />
            <span className="text-gray-400">至</span>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="bg-transparent border-none text-sm outline-none text-gray-700 font-medium cursor-pointer"
            />
          </div>
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
            <span>{isSyncing ? t('jiraSync.syncing') : t('jiraSync.syncSelected').replace('{count}', selectedProjects.size.toString())}</span>
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

      {unmatchedAuthors.length > 0 && (
        <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center space-x-2 text-amber-800 font-bold">
              <UserPlus size={18} />
              <span>发现 {unmatchedAuthors.length} 个未匹配的 Jira 用户</span>
            </div>
            <button onClick={() => setUnmatchedAuthors([])} className="p-1.5 text-amber-400 hover:bg-amber-100 rounded-full" title="忽略">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-amber-600 mb-4">以下 Jira worklog 作者无法对应到任何团队成员，其工时暂时按 Issue 类型估算。请为他们指定对应成员，系统会把其 Jira 身份（accountId / 邮箱 / 昵称）写入该成员的别名。配置后请重新同步以获得精确的开发/测试工时拆分。</p>
          <div className="space-y-2">
            {unmatchedAuthors.map(author => {
              const key = authorKey(author);
              const idLabel = author.accountId ? `accountId: ${author.accountId}` : author.email ? `邮箱: ${author.email}` : `昵称: ${author.displayName}`;
              return (
                <div key={key} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-amber-100">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{author.displayName || author.email || author.accountId || '未知用户'}</div>
                    <div className="text-[10px] text-gray-400 font-mono truncate">{idLabel} · {(author.totalSeconds / 3600).toFixed(1)}h</div>
                  </div>
                  <select
                    value={authorAssign[key] || ''}
                    onChange={e => setAuthorAssign(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="text-sm px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                  >
                    <option value="">选择对应成员…</option>
                    {(resources || []).map(r => (
                      <option key={r.id} value={r.id}>{r.name}（{r.role}）</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignAuthor(author)}
                    disabled={!authorAssign[key]}
                    className="flex items-center space-x-1 bg-amber-500 text-white px-3 py-2 rounded-lg font-bold text-sm hover:bg-amber-600 transition-colors disabled:bg-amber-200 disabled:cursor-not-allowed"
                  >
                    <UserPlus size={14} />
                    <span>绑定</span>
                  </button>
                </div>
              );
            })}
          </div>
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
                  <th className="p-4">Epic 状态</th>
                  <th className="p-4 text-center">Story / Task / Bug</th>
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
                    <td className="p-4">
                      {p.jiraEpicStatus ? <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] rounded font-bold">{p.jiraEpicStatus}</span> : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="p-4 text-center">
                      {(p.jiraStoryCount !== undefined || p.jiraTaskCount !== undefined || p.jiraBugCount !== undefined) ? (
                        <div className="flex items-center justify-center gap-1">
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-600 text-[10px] rounded font-bold" title="Story">S {p.jiraStoryCount || 0}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-bold" title="Task">T {p.jiraTaskCount || 0}</span>
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] rounded font-bold" title="Bug">B {p.jiraBugCount || 0}</span>
                        </div>
                      ) : <span className="text-gray-300">-</span>}
                    </td>
                    
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
