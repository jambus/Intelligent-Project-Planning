import { useState } from 'react';
import { useDashboard } from '../../../context/DashboardContext';
import { FolderKanban, Search, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export const ProjectResults = () => {
  const { 
    readyProjects, pendingProjects, fullyScheduledProjects, partiallyScheduledProjects, unscheduledProjects 
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'fully'>('pending');

  const getStatusBadge = (p: any) => {
    if (p.devTotalMd === 0 && p.testTotalMd === 0) return <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold text-[10px]">待评估</span>;
    if (p.isFullyScheduled) return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-[10px]">已排满</span>;
    if (p.hasAllocations) return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px]">部分排上</span>;
    return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-[10px]">排不上</span>;
  };

  const renderProjectTable = (projects: any[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20">
            <th className="p-4 w-12 text-center">ID</th>
            <th className="p-4">项目名称</th>
            <th className="p-4 text-center">状态</th>
            <th className="p-4 text-center">开发 (总/缺口)</th>
            <th className="p-4 text-center">测试 (总/缺口)</th>
            <th className="p-4">负责人员</th>
            <th className="p-4">备注/未排上原因</th>
          </tr>
        </thead>
        <tbody>
          {projects.length === 0 ? (
            <tr><td colSpan={7} className="p-8 text-center text-gray-400 italic font-medium">{emptyMessage}</td></tr>
          ) : (
            projects.map((p, idx) => {
              const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30';
              return (
                <tr key={p.id} className={`border-b border-gray-50 hover:bg-blue-50/30 transition-colors ${rowBg}`}>
                  <td className="p-4 text-center font-bold text-gray-400">#{p.id}</td>
                  <td className="p-4">
                    <div className="font-bold text-gray-900">{p.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 flex space-x-2">
                      <span>Tech: {p.projectTechLead || '-'}</span>
                      <span>QA: {p.projectQualityLead || '-'}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">{getStatusBadge(p)}</td>
                  <td className="p-4 text-center">
                    <div className="font-mono text-xs">
                      <span className="text-gray-900 font-bold">{p.devTotalMd}d</span>
                      {p.devGap !== undefined && p.devGap > 0 && (
                        <span className="text-orange-500 font-bold ml-1">(-{Math.ceil(p.devGap)}d)</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="font-mono text-xs">
                      <span className="text-gray-900 font-bold">{p.testTotalMd}d</span>
                      {p.testGap !== undefined && p.testGap > 0 && (
                        <span className="text-orange-500 font-bold ml-1">(-{Math.ceil(p.testGap)}d)</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-[10px] text-gray-600 leading-relaxed max-w-xs">
                    {p.assignedDevs && <div><span className="font-bold text-gray-400">Dev:</span> {p.assignedDevs}</div>}
                    {p.assignedTesters && <div><span className="font-bold text-gray-400">QA:</span> {p.assignedTesters}</div>}
                    {!p.assignedDevs && !p.assignedTesters && <span className="text-gray-300 italic">未分配</span>}
                  </td>
                  <td className="p-4 text-[10px] text-red-500 font-bold">
                    {p.unscheduledReason || '-'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">项目排期结果</h2>
          <p className="text-xs font-bold text-gray-400 mt-1.5">分类查看所有项目的排期状态与资源缺口</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs Header */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-2 px-6 py-4 text-sm font-bold transition-colors relative ${
              activeTab === 'pending' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle size={16} />
            <span>待处理事项</span>
            <span className="ml-2 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-[10px]">
              {unscheduledProjects.length + partiallyScheduledProjects.length + pendingProjects.length}
            </span>
            {activeTab === 'pending' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
          </button>
          
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-6 py-4 text-sm font-bold transition-colors relative ${
              activeTab === 'all' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FolderKanban size={16} />
            <span>全部项目</span>
            <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-[10px]">
              {readyProjects.length}
            </span>
            {activeTab === 'all' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
          </button>

          <button
            onClick={() => setActiveTab('fully')}
            className={`flex items-center space-x-2 px-6 py-4 text-sm font-bold transition-colors relative ${
              activeTab === 'fully' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>已排满项目</span>
            <span className="ml-2 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[10px]">
              {fullyScheduledProjects.length}
            </span>
            {activeTab === 'fully' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>}
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {activeTab === 'pending' && (
            <div className="divide-y divide-gray-100">
              {/* Unscheduled */}
              <div className="p-0">
                <div className="px-4 py-3 bg-red-50/50 flex items-center space-x-2">
                  <XCircle size={16} className="text-red-500" />
                  <h3 className="font-bold text-red-900 text-sm">排不上项目 ({unscheduledProjects.length})</h3>
                </div>
                {renderProjectTable(unscheduledProjects, "太棒了，没有完全排不上的项目！")}
              </div>

              {/* Partially Scheduled */}
              <div className="p-0">
                <div className="px-4 py-3 bg-blue-50/50 flex items-center space-x-2">
                  <AlertTriangle size={16} className="text-blue-500" />
                  <h3 className="font-bold text-blue-900 text-sm">部分排上项目 ({partiallyScheduledProjects.length})</h3>
                </div>
                {renderProjectTable(partiallyScheduledProjects, "太棒了，所有能排上的项目都已排满！")}
              </div>

              {/* Pending Assessment */}
              <div className="p-0">
                <div className="px-4 py-3 bg-orange-50/50 flex items-center space-x-2">
                  <Search size={16} className="text-orange-500" />
                  <h3 className="font-bold text-orange-900 text-sm">待评估项目 ({pendingProjects.length})</h3>
                </div>
                {renderProjectTable(pendingProjects, "太棒了，没有需要补充工时评估的项目！")}
              </div>
            </div>
          )}

          {activeTab === 'all' && (
            <div>
              {renderProjectTable(readyProjects, "暂无项目数据")}
            </div>
          )}

          {activeTab === 'fully' && (
            <div>
              {renderProjectTable(fullyScheduledProjects, "目前还没有完全排满的项目")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
