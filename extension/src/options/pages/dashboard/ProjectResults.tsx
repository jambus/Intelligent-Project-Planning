import { useState } from 'react';
import { useDashboard } from '../../../context/DashboardContext';
import { useTranslation } from '../../../context/I18nContext';
import { FolderKanban, Search, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export const ProjectResults = () => {
  const { 
    readyProjects, pendingProjects, fullyScheduledProjects, partiallyScheduledProjects, unscheduledProjects 
  } = useDashboard();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'fully'>('pending');

  const getStatusBadge = (p: any) => {
    if (p.devTotalMd === 0 && p.testTotalMd === 0) return <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded font-bold text-[10px]">{t('dashboard.statusPendingAssessment')}</span>;
    if (p.isFullyScheduled) return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold text-[10px]">{t('dashboard.statusFullyScheduled')}</span>;
    if (p.hasAllocations) return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-[10px]">{t('dashboard.statusPartiallyScheduled')}</span>;
    return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold text-[10px]">{t('dashboard.statusUnscheduled')}</span>;
  };

  const renderProjectTable = (projects: any[], emptyMessage: string) => (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20">
            <th className="p-4 w-12 text-center">{t('dashboard.tableId')}</th>
            <th className="p-4">{t('dashboard.tableProjectName')}</th>
            <th className="p-4 text-center">{t('dashboard.tableStatus')}</th>
            <th className="p-4 text-center">{t('dashboard.tableDevReq')}</th>
            <th className="p-4 text-center">{t('dashboard.tableTestReq')}</th>
            <th className="p-4">{t('dashboard.tableAssignee')}</th>
            <th className="p-4">{t('dashboard.tableReason')}</th>
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
                    {!p.assignedDevs && !p.assignedTesters && <span className="text-gray-300 italic">{t('dashboard.notAssigned')}</span>}
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
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('dashboard.projectResultsTitle')}</h2>
          <p className="text-xs font-bold text-gray-400 mt-1.5">{t('dashboard.projectResultsDesc')}</p>
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
            <span>{t('dashboard.tabPending')}</span>
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
            <span>{t('dashboard.tabAll')}</span>
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
            <span>{t('dashboard.tabFully')}</span>
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
                  <h3 className="font-bold text-red-900 text-sm">{t('dashboard.unscheduledProjectsTitle')} ({unscheduledProjects.length})</h3>
                </div>
                {renderProjectTable(unscheduledProjects, t('dashboard.msgNoUnscheduled'))}
              </div>

              {/* Partially Scheduled */}
              <div className="p-0">
                <div className="px-4 py-3 bg-blue-50/50 flex items-center space-x-2">
                  <AlertTriangle size={16} className="text-blue-500" />
                  <h3 className="font-bold text-blue-900 text-sm">{t('dashboard.partiallyScheduledProjectsTitle')} ({partiallyScheduledProjects.length})</h3>
                </div>
                {renderProjectTable(partiallyScheduledProjects, t('dashboard.msgNoPartially'))}
              </div>

              {/* Pending Assessment */}
              <div className="p-0">
                <div className="px-4 py-3 bg-orange-50/50 flex items-center space-x-2">
                  <Search size={16} className="text-orange-500" />
                  <h3 className="font-bold text-orange-900 text-sm">{t('dashboard.pendingAssessmentProjectsTitle')} ({pendingProjects.length})</h3>
                </div>
                {renderProjectTable(pendingProjects, t('dashboard.msgNoPending'))}
              </div>
            </div>
          )}

          {activeTab === 'all' && (
            <div>
              {renderProjectTable(readyProjects, t('dashboard.msgNoData'))}
            </div>
          )}

          {activeTab === 'fully' && (
            <div>
              {renderProjectTable(fullyScheduledProjects, t('dashboard.msgNoFully'))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
