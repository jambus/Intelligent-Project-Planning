import { useState, useMemo, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useScheduling } from '../../context/SchedulingContext';
import { Users, ChevronDown, ChevronUp, ArrowRight, ClipboardList, AlertTriangle, FileWarning, Search, TriangleAlert, User, Briefcase, RefreshCcw, CheckCircle2, Zap, X, Play } from 'lucide-react';
import { getWeeksInRange, calculateWeeklyMD } from '../../utils/dateUtils';
import { computeProjectGaps } from '../../utils/audit';

const ProjectScheduleSection = ({ 
  title, count, projects, isExpanded, setIsExpanded, 
  icon: Icon, bgColor, textColor, hoverColor,
  showGaps, showReason, emptyMessage 
}: any) => {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6`}>
      <div 
        className={`p-4 border-b border-gray-100 ${bgColor} flex justify-between items-center cursor-pointer ${hoverColor} transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className={`font-bold ${textColor} text-sm flex items-center space-x-2`}>
          <Icon size={16} />
          <span>{title} (共 {count} 个)</span>
        </h3>
        <button className="text-gray-400 hover:text-gray-600 transition-colors">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>
      {isExpanded && (
        <div className="p-0 overflow-x-auto animate-in slide-in-from-top-2 duration-200">
          {projects.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-xs italic">{emptyMessage}</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  <th className="p-4">项目名称</th>
                  {showGaps ? (
                    <>
                      <th className="p-4 text-center">开发缺口</th>
                      <th className="p-4 text-center">测试缺口</th>
                    </>
                  ) : (
                    <>
                      <th className="p-4">开发负责人</th>
                      <th className="p-4">测试负责人</th>
                    </>
                  )}
                  {showReason ? (
                    <th className="p-4 text-center">推测原因</th>
                  ) : (
                    <th className="p-4">所有参与人员</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {projects.map((p: any) => (
                  <tr key={p.id} className={`border-b border-gray-100 hover:bg-gray-50/50 transition-colors`}>
                    <td className="p-4 font-black text-gray-900">{p.name}</td>
                    {showGaps ? (
                      <>
                        <td className="p-4 text-center">{p.devGap > 0 ? <span className="font-mono font-bold text-orange-600">{Math.round(p.devGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                        <td className="p-4 text-center">{p.testGap > 0 ? <span className="font-mono font-bold text-teal-600">{Math.round(p.testGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                      </>
                    ) : (
                      <>
                        <td className="p-4 text-gray-600 font-medium">{p.projectTechLead || '-'}</td>
                        <td className="p-4 text-gray-600 font-medium">{p.projectQualityLead || '-'}</td>
                      </>
                    )}
                    {showReason ? (
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 bg-red-50 text-red-600 border border-red-100 rounded-md text-[10px] font-bold`}>
                          {p.unscheduledReason}
                        </span>
                      </td>
                    ) : (
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 items-center">
                          {p.allPersonnel && p.allPersonnel.split(', ').map((name: string) => (
                            <span key={name} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold">
                              {name}
                            </span>
                          ))}
                          {p.devViaJira && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold">开发·Jira工时已消耗</span>}
                          {p.testViaJira && <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold">测试·Jira工时已消耗</span>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export const Dashboard = ({ view = 'all' }: { view?: 'all' | 'scheduled' | 'allocations' | 'gaps' }) => {
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  const allocations = useLiveQuery(() => db.allocations.toArray());
  const operations = useLiveQuery(() => db.productOperations.toArray());
  const scrumTeams = useLiveQuery(() => db.scrumTeams.toArray());
  
  const { isScheduling, scheduleStatus, currentStep, error, handleGenerateSchedule, stopScheduling, clearError } = useScheduling();
  const [groupMode, setGroupMode] = useState<'resource' | 'project'>('resource');

  // Collapse states
  const [isScheduledExpanded, setIsScheduledExpanded] = useState(true);
  const [isPartiallyScheduledExpanded, setIsPartiallyScheduledExpanded] = useState(true);
  const [isUnscheduledExpanded, setIsUnscheduledExpanded] = useState(true);
  const [isMainTableExpanded, setIsMainTableExpanded] = useState(true);
  const [isGapsExpanded, setIsGapsExpanded] = useState(true);
  const [isIdleExpanded, setIsIdleExpanded] = useState(true);
  const [isPendingExpanded, setIsPendingExpanded] = useState(false);

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentMonth);
  const [endMonth, setEndMonth] = useState(Math.min(12, currentMonth + 2));

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const displayWeeks = useMemo(() => {
    return getWeeksInRange(startMonth, endMonth, selectedYear);
  }, [selectedYear, startMonth, endMonth]);

  const displayWeeksGrouped = useMemo(() => {
    const groups: { month: number, span: number }[] = [];
    displayWeeks.forEach(w => {
      const last = groups[groups.length - 1];
      if (last && last.month === w.month) {
        last.span += 1;
      } else {
        groups.push({ month: w.month, span: 1 });
      }
    });
    return groups;
  }, [displayWeeks]);

  // UI-only audit logic for display. Project gaps use the shared auditor so the
  // dashboard never drifts from the scheduling engine; idle is computed against
  // the currently displayed week range for the grid.
  const runAuditForUI = (currentProjects: any[], currentResources: any[], currentAllocations: any[], currentScrumTeams: any[], currentWorkingDaySet: Set<string>) => {
    const gaps = computeProjectGaps(currentProjects, currentResources, currentAllocations, currentWorkingDaySet)
      .filter(p => Math.ceil(p.devGap) >= 1 || Math.ceil(p.testGap) >= 1);

    const idle = currentResources.map(r => {
      const rAllocations = currentAllocations.filter(a => Number(a.resourceId) === Number(r.id));
      let totalAllocatedMdInRange = 0;
      displayWeeks.forEach(w => {
        rAllocations.forEach(a => {
          totalAllocatedMdInRange += calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, currentWorkingDaySet);
        });
      });

      const leaveDays = new Set(Array.isArray(r.unavailableDates) ? r.unavailableDates : []);
      let activeWorkingDays = 0;
      currentWorkingDaySet.forEach(d => {
        if (!leaveDays.has(d)) activeWorkingDays++;
      });
      const capacityMd = (activeWorkingDays * r.capacity) / 100;
      const utilization = capacityMd > 0 ? (totalAllocatedMdInRange / capacityMd) * 100 : 0;
      return { ...r, idleMd: Math.max(0, capacityMd - totalAllocatedMdInRange), allocatedMd: totalAllocatedMdInRange, capacityMd, utilization };
    });

    const activeIdle = idle.filter(r => Math.round(r.idleMd) >= 1);

    const teamCapacities = (currentScrumTeams || []).map(team => {
      const teamResources = idle.filter(r => r.scrumTeamId === team.id);
      let totalCapacityMd = 0; let allocatedMd = 0; let idleMd = 0; let devIdleMd = 0; let testIdleMd = 0;

      teamResources.forEach(r => {
        totalCapacityMd += r.capacityMd;
        allocatedMd += r.allocatedMd;
        idleMd += r.idleMd;
        if (['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)) devIdleMd += r.idleMd;
        else if (r.role === '测试工程师') testIdleMd += r.idleMd;
      });

      return {
        ...team, totalCapacityMd, allocatedMd, idleMd, devIdleMd, testIdleMd,
        memberCount: teamResources.length,
        utilization: totalCapacityMd > 0 ? (allocatedMd / totalCapacityMd) * 100 : 0
      };
    });

    const unassignedResources = idle.filter(r => !r.scrumTeamId);
    if (unassignedResources.length > 0) {
      let totalCapacityMd = 0; let allocatedMd = 0; let idleMd = 0; let devIdleMd = 0; let testIdleMd = 0;
      unassignedResources.forEach(r => {
        totalCapacityMd += r.capacityMd; allocatedMd += r.allocatedMd; idleMd += r.idleMd;
        if (['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)) devIdleMd += r.idleMd;
        else if (r.role === '测试工程师') testIdleMd += r.idleMd;
      });
      teamCapacities.push({
        id: -1, name: '未分配 Scrum 团队', totalCapacityMd, allocatedMd, idleMd, devIdleMd, testIdleMd,
        memberCount: unassignedResources.length, utilization: totalCapacityMd > 0 ? (allocatedMd / totalCapacityMd) * 100 : 0
      });
    }

    return { gaps, idle: activeIdle, teamCapacities };
  };

  const [workingDaySet, setWorkingDaySet] = useState<Set<string>>(new Set());

  useEffect(() => {
    import('../../utils/dateUtils').then(m => {
      const rangeStart = new Date(selectedYear, startMonth - 1, 1);
      const rangeEnd = new Date(selectedYear, endMonth, 0);
      m.buildWorkingDaySet(rangeStart, rangeEnd).then(setWorkingDaySet);
    });
  }, [selectedYear, startMonth, endMonth]);

  const { readyProjects, pendingProjects, projectGaps, resourceIdle, teamCapacities } = useMemo(() => {
    if (!projects || !resources || !allocations || workingDaySet.size === 0) return { readyProjects: [], pendingProjects: [], projectGaps: [], resourceIdle: [], teamCapacities: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    const pending = projects.filter(p => p.devTotalMd === 0 && p.testTotalMd === 0);
    const { gaps, idle, teamCapacities } = runAuditForUI(ready, resources, allocations, scrumTeams || [], workingDaySet);
    return { readyProjects: ready, pendingProjects: pending, projectGaps: gaps, resourceIdle: idle, teamCapacities };
  }, [projects, resources, allocations, scrumTeams, selectedYear, startMonth, endMonth, displayWeeks, workingDaySet]);

  const { fullyScheduledProjects, partiallyScheduledProjects, unscheduledProjects } = useMemo(() => {
    if (!projects || !allocations || !resources) return { fullyScheduledProjects: [], partiallyScheduledProjects: [], unscheduledProjects: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    
    const gapById = new Map(
      computeProjectGaps(ready, resources, allocations, workingDaySet).map(g => [Number(g.id), g])
    );

    let globalDevIdle = 0;
    let globalTestIdle = 0;
    resourceIdle.forEach(r => {
      if (['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)) globalDevIdle += r.idleMd;
      if (r.role === '测试工程师') globalTestIdle += r.idleMd;
    });

    const enriched = ready.map(p => {
      const g = gapById.get(Number(p.id)) || { devGap: p.devTotalMd, testGap: p.testTotalMd };
      const devDone = p.devTotalMd <= 0 || Math.ceil(g.devGap) < 1;
      const testDone = p.testTotalMd <= 0 || Math.ceil(g.testGap) < 1;
      
      const pAllocs = allocations.filter(a => Number(a.projectId) === Number(p.id));
      const devs = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'dev' || (res && ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(res.role));
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      const testers = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'test' || (res && res.role === '测试工程师');
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      
      const devViaJira = p.devTotalMd > 0 && devs.length === 0 && Math.ceil(g.devGap) < 1;
      const testViaJira = p.testTotalMd > 0 && testers.length === 0 && Math.ceil(g.testGap) < 1;
      
      const isFullyScheduled = devDone && testDone;
      const hasAllocations = pAllocs.length > 0;

      const reasonMap: Record<string, string> = {
        'lead_not_idle': 'Lead 不可用',
        'no_dev_capacity': '开发容量不足',
        'no_test_capacity': '测试容量不足',
        'date_window_exceeded': '时间窗口不足',
        'weekly_exclusivity_conflict': '单周并行冲突',
        'scrum_constraint_violated': '指定团队容量不足'
      };

      let reason = '';
      if (!isFullyScheduled && p.rejectionReason) {
        reason = reasonMap[p.rejectionReason] || p.rejectionReason;
      }

      return { 
        ...p, 
        assignedDevs: devs.join(', '), 
        assignedTesters: testers.join(', '), 
        allPersonnel: [...new Set([...devs, ...testers])].join(', '), 
        devViaJira, 
        testViaJira,
        devGap: g.devGap,
        testGap: g.testGap,
        isFullyScheduled,
        hasAllocations,
        unscheduledReason: reason
      };
    }).sort((a, b) => Number(a.id) - Number(b.id));

    return {
      fullyScheduledProjects: enriched.filter(p => p.isFullyScheduled),
      partiallyScheduledProjects: enriched.filter(p => !p.isFullyScheduled && p.hasAllocations),
      unscheduledProjects: enriched.filter(p => !p.isFullyScheduled && !p.hasAllocations)
    };
  }, [projects, allocations, resources, resourceIdle]);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">全局排期大盘</h2>
            <div className="flex items-center space-x-3 mt-1.5 min-h-[20px]">
              {isScheduling && <RefreshCcw size={14} className="animate-spin text-blue-600" />}
              {!isScheduling && currentStep === 4 && <CheckCircle2 size={14} className="text-green-500" />}
              <span className={`text-xs font-bold ${isScheduling ? 'text-blue-600' : currentStep === 4 ? 'text-green-600' : 'text-gray-400'}`}>
                {scheduleStatus || '像素级统筹架构：矩阵建模 -> 并行分批 -> 循环收割'}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-4">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                currentStep >= step ? 'bg-blue-500 scale-125' : 'bg-gray-200'
              }`} />
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-3 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-bold text-blue-700 bg-blue-50 border-none rounded-lg focus:ring-0 cursor-pointer"
            >
              {yearOptions.map(year => (
                <option key={year} value={year}>{year} 年</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
          </div>

          <div className="flex items-center space-x-2 px-2 border-l border-gray-100">
            <select value={startMonth} onChange={(e) => setStartMonth(Number(e.target.value))} className="appearance-none py-2 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer">
              {months.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <ArrowRight size={14} className="text-gray-300" />
            <select value={endMonth} onChange={(e) => setEndMonth(Number(e.target.value))} className="appearance-none py-2 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer">
              {months.map(m => <option key={m} value={m} disabled={m < startMonth}>{m}月</option>)}
            </select>
          </div>

          <div className="flex items-center space-x-1 px-2 border-l border-gray-100">
            <button onClick={() => { setStartMonth(currentMonth); setEndMonth(Math.min(12, currentMonth + 2)); }} className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded">本月起3个月</button>
            <button onClick={() => { const qStart = Math.floor((currentMonth - 1) / 3) * 3 + 1; setStartMonth(qStart); setEndMonth(qStart + 2); }} className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded">本季度</button>
            <button onClick={() => { const nextQStart = Math.floor((currentMonth - 1) / 3) * 3 + 4; if (nextQStart <= 10) { setStartMonth(nextQStart); setEndMonth(nextQStart + 2); } }} className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded" title={Math.floor((currentMonth - 1) / 3) * 3 + 4 > 10 ? "已至四季度" : ""}>下季度</button>
          </div>
          {isScheduling ? (
            <button 
              onClick={stopScheduling}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 transition-all shadow-sm shadow-red-50"
            >
              <X size={16} />
              <span>停止排期</span>
            </button>
          ) : (
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => handleGenerateSchedule(selectedYear, startMonth, endMonth, false)}
                disabled={isScheduling || !readyProjects.length || !resources?.length}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                  isScheduling 
                    ? 'bg-blue-100 text-blue-400 cursor-not-allowed shadow-none' 
                    : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50 shadow-blue-50'
                }`}
              >
                <Play size={16} />
                <span>继续排期</span>
              </button>
              <button 
                onClick={() => handleGenerateSchedule(selectedYear, startMonth, endMonth, true)}
                disabled={isScheduling || !readyProjects.length || !resources?.length}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                  isScheduling 
                    ? 'bg-blue-100 text-blue-400 cursor-not-allowed shadow-none' 
                    : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-100'
                }`}
              >
                <Zap size={16} className={isScheduling ? "animate-pulse" : ""} />
                <span>一键 AI 智能排期</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-white p-0 rounded-3xl shadow-2xl w-[500px] overflow-hidden transform animate-in zoom-in-95 duration-200 border border-red-100">
            <div className="bg-red-50 p-6 flex items-center space-x-4 border-b border-red-100">
              <div className="p-3 bg-red-100 rounded-2xl text-red-600">
                <TriangleAlert size={24} />
              </div>
              <h3 className="text-lg font-black text-red-900">AI 智能排期出错</h3>
            </div>
            <div className="p-8">
              <p className="text-gray-600 text-sm mb-6 leading-relaxed">系统在与 AI 排期引擎通信时遇到了问题。这通常是由于 API Key 配置错误、余额不足或网络波动导致的。</p>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-8 max-h-40 overflow-auto">
                <code className="text-xs text-red-600 break-words font-mono">{error || '未知错误'}</code>
              </div>
              <div className="flex space-x-3">
                <button onClick={clearError} className="flex-1 bg-gray-100 py-3 rounded-2xl font-bold text-sm">我知道了</button>
                <button onClick={() => { clearError(); window.location.hash = '#/settings'; }} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm shadow-lg">去检查系统设置</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">待排期项目</span>
            <ClipboardList size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-gray-900">{readyProjects.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">待评估项目</span>
            <Search size={16} className="text-orange-400" />
          </div>
          <p className="text-2xl font-black text-gray-900">{pendingProjects.length}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-sm border transition-colors ${projectGaps.length ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${projectGaps.length ? 'text-orange-500' : 'text-gray-400'}`}>需求缺口项目</span>
            <AlertTriangle size={16} className={projectGaps.length ? 'text-orange-500' : 'text-gray-300'} />
          </div>
          <p className={`text-2xl font-black ${projectGaps.length ? 'text-orange-600' : 'text-gray-900'}`}>{projectGaps.length}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-sm border transition-colors ${resourceIdle.length ? 'bg-indigo-50 border-indigo-100' : 'bg-white border-gray-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${resourceIdle.length ? 'text-indigo-500' : 'text-gray-400'}`}>未满载人员</span>
            <Users size={16} className={resourceIdle.length ? 'text-indigo-500' : 'text-gray-300'} />
          </div>
          <p className={`text-2xl font-black ${resourceIdle.length ? 'text-indigo-600' : 'text-gray-900'}`}>{resourceIdle.length}</p>
        </div>
      </div>

      {/* Scrum Team Capacities Box */}
      {(view === 'all' || view === 'gaps') && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
            <Users size={16} className="text-gray-600" />
            <h3 className="font-bold text-gray-900 text-sm">Scrum 团队容量 (当前选定时段)</h3>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                  <th className="p-3">Scrum 团队</th>
                  <th className="p-3 text-center">成员数</th>
                  <th className="p-3 text-center">总容量</th>
                  <th className="p-3 text-center">已用容量</th>
                  <th className="p-3 text-center">剩余总容量</th>
                  <th className="p-3 text-center text-blue-600">开发剩余</th>
                  <th className="p-3 text-center text-teal-600">测试剩余</th>
                  <th className="p-3 text-center">饱和度</th>
                </tr>
              </thead>
              <tbody>
                {teamCapacities.map(team => (
                  <tr key={team.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-bold text-gray-900">{team.name}</td>
                    <td className="p-3 text-center text-gray-600">{team.memberCount}</td>
                    <td className="p-3 text-center text-gray-600 font-mono">{Math.round(team.totalCapacityMd)}d</td>
                    <td className="p-3 text-center text-gray-600 font-mono">{Math.round(team.allocatedMd)}d</td>
                    <td className="p-3 text-center font-bold text-gray-900 font-mono">{Math.round(team.idleMd)}d</td>
                    <td className="p-3 text-center font-bold text-blue-600 font-mono">{Math.round(team.devIdleMd)}d</td>
                    <td className="p-3 text-center font-bold text-teal-600 font-mono">{Math.round(team.testIdleMd)}d</td>
                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-16 bg-gray-100 h-1.5 rounded-full mb-1 overflow-hidden">
                          <div className={`h-full rounded-full ${team.utilization > 90 ? 'bg-red-400' : team.utilization > 70 ? 'bg-orange-400' : 'bg-green-400'}`} style={{ width: `${Math.min(100, team.utilization)}%` }}></div>
                        </div>
                        <span className="text-[9px] font-bold text-gray-500">{team.utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {teamCapacities.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400 italic">暂无团队人员数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scheduled Projects Box */}
      {(view === 'all' || view === 'scheduled') && (
      <>
      {/* Fully Scheduled */}
      <ProjectScheduleSection
        title="已排满项目"
        count={fullyScheduledProjects.length}
        projects={fullyScheduledProjects}
        isExpanded={isScheduledExpanded}
        setIsExpanded={setIsScheduledExpanded}
        icon={CheckCircle2}
        bgColor="bg-green-50/30"
        textColor="text-green-800"
        borderColor="border-green-200"
        hoverColor="hover:bg-green-50/50"
        showGaps={false}
        showReason={false}
        emptyMessage="暂无完全排满的项目"
      />

      {/* Partially Scheduled */}
      <ProjectScheduleSection
        title="部分排上项目"
        count={partiallyScheduledProjects.length}
        projects={partiallyScheduledProjects}
        isExpanded={isPartiallyScheduledExpanded}
        setIsExpanded={setIsPartiallyScheduledExpanded}
        icon={AlertTriangle}
        bgColor="bg-orange-50/30"
        textColor="text-orange-800"
        borderColor="border-orange-200"
        hoverColor="hover:bg-orange-50/50"
        showGaps={true}
        showReason={false}
        emptyMessage="暂无部分排上的项目"
      />

      {/* Unscheduled */}
      <ProjectScheduleSection
        title="排不上项目"
        count={unscheduledProjects.length}
        projects={unscheduledProjects}
        isExpanded={isUnscheduledExpanded}
        setIsExpanded={setIsUnscheduledExpanded}
        icon={X}
        bgColor="bg-red-50/30"
        textColor="text-red-800"
        borderColor="border-red-200"
        hoverColor="hover:bg-red-50/50"
        showGaps={true}
        showReason={true}
        emptyMessage="暂无排不上的项目"
      />
      </>
      )}

      {/* Main Table */}
      {(view === 'all' || view === 'allocations') && (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div 
          className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => setIsMainTableExpanded(!isMainTableExpanded)}
        >
          <div className="flex items-center space-x-2">
            <h3 className="font-bold text-gray-900 text-sm">已排期任务详情</h3>
            <button className="text-gray-400 hover:text-gray-600 transition-colors">
              {isMainTableExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-xl" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setGroupMode('resource')} className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'resource' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><User size={14} /><span>按人员分组</span></button>
            <button onClick={() => setGroupMode('project')} className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Briefcase size={14} /><span>按项目分组</span></button>
          </div>
        </div>
        {isMainTableExpanded && (
          <div className="p-0 overflow-x-auto animate-in slide-in-from-top-2 duration-200">
            {allocations?.length === 0 ? <p className="text-gray-400 text-center py-16 text-sm font-medium">暂无排期数据</p> : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  <th rowSpan={2} className="p-4 min-w-[150px]">{groupMode === 'resource' ? '研发资源' : '承接项目'}</th>
                  <th rowSpan={2} className="p-4 min-w-[200px]">{groupMode === 'resource' ? '承接项目' : '参与人员'}</th>
                  <th rowSpan={2} className="p-4 text-center">投入比</th>
                  {displayWeeksGrouped.map((g, idx) => <th key={idx} colSpan={g.span} className="py-2 text-center border-l border-gray-200 text-gray-500 bg-gray-100/50">{g.month} 月</th>)}
                </tr>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  {displayWeeks.map(w => <th key={`${w.year}-${w.week}`} className="py-2 text-center border-l border-gray-50 min-w-[70px] text-[10px]">{w.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {groupMode === 'resource' ? (() => {
                  const map = new Map<string, any[]>();
                  allocations?.forEach(a => {
                    const key = `${a.resourceId}_${a.projectId}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(a);
                  });
                  return Array.from(map.values()).map((group) => {
                    const alloc = group[0];
                    const resource = resources?.find(r => Number(r.id) === Number(alloc.resourceId));
                    const isOp = Number(alloc.projectId) <= -1000000;
                    const opId = isOp ? -Number(alloc.projectId) - 1000000 : null;
                    const operation = isOp ? operations?.find(o => Number(o.id) === opId) : null;
                    const project = isOp ? null : projects?.find(p => Number(p.id) === Number(alloc.projectId));
                    const projName = isOp ? `[运维] ${operation?.productName || 'Unknown'}` : (project?.name || 'Unknown');
                    
                    const minStart = group.map(a => a.startDate).sort()[0];
                    const maxEnd = group.map(a => a.endDate).sort().reverse()[0];
                    const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                    const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';

                    return (
                      <tr key={`${alloc.resourceId}_${alloc.projectId}`} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                        <td className="p-4 border-r border-gray-50 bg-gray-50/5"><div className="font-black text-gray-900">{resource?.name || 'Unknown'}</div><div className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{resource?.role}</div></td>
                        <td className="p-4"><div className="text-blue-600 font-black leading-tight">{projName}</div><div className="text-[10px] text-gray-400 mt-1 font-medium">{minStart} ~ {maxEnd}</div></td>
                        <td className="p-4 text-center"><span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span></td>
                        {displayWeeks.map(w => {
                          const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                          return <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/10' : 'text-gray-200'}`}>{md > 0 ? md : '-'}</td>;
                        })}
                      </tr>
                    );
                  });
                })() : [
                  ...(projects?.filter(p => allocations?.some(a => Number(a.projectId) === Number(p.id))).map(p => {
                    const projectAllocations = allocations?.filter(a => Number(a.projectId) === Number(p.id)) || [];
                    const map = new Map<string, any[]>();
                    projectAllocations.forEach(a => {
                      const key = `${a.resourceId}`;
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(a);
                    });
                    const grouped = Array.from(map.values());
                    return grouped.map((group, idx) => {
                      const alloc = group[0];
                      const resource = resources?.find(r => Number(r.id) === Number(alloc.resourceId));
                      const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                      const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';
                      return (
                        <tr key={`${p.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/20 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 border-r border-gray-50 bg-indigo-50/5">{idx === 0 && <div className="font-black text-indigo-700 leading-tight">{p.name}</div>}</td>
                          <td className="p-4"><div className="font-bold text-gray-900">{resource?.name || 'Unknown'}</div><div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div></td>
                          <td className="p-4 text-center"><span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span></td>
                          {displayWeeks.map(w => {
                            const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                            return <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/10' : 'text-gray-200'}`}>{md > 0 ? md : '-'}</td>;
                          })}
                        </tr>
                      );
                    });
                  }) || []),
                  ...(operations?.filter(op => allocations?.some(a => Number(a.projectId) === -(Number(op.id) + 1000000))).map(op => {
                    const opAllocations = allocations?.filter(a => Number(a.projectId) === -(Number(op.id) + 1000000)) || [];
                    const map = new Map<string, any[]>();
                    opAllocations.forEach(a => {
                      const key = `${a.resourceId}`;
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(a);
                    });
                    const grouped = Array.from(map.values());
                    return grouped.map((group, idx) => {
                      const alloc = group[0];
                      const resource = resources?.find(r => Number(r.id) === Number(alloc.resourceId));
                      const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                      const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';
                      return (
                        <tr key={`${op.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/20 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 border-r border-gray-50 bg-indigo-50/5">{idx === 0 && <div className="font-black text-indigo-700 leading-tight">[运维] {op.productName}</div>}</td>
                          <td className="p-4"><div className="font-bold text-gray-900">{resource?.name || 'Unknown'}</div><div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div></td>
                          <td className="p-4 text-center"><span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span></td>
                          {displayWeeks.map(w => {
                            const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                            return <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/10' : 'text-gray-200'}`}>{md > 0 ? md : '-'}</td>;
                          })}
                        </tr>
                      );
                    });
                  }) || [])
                ]}
              </tbody>
            </table>
          )}
          </div>
        )}
      </div>
      )}

      {(view === 'all' || view === 'gaps') && (
      <>
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div 
            className="p-4 border-b border-orange-100 bg-orange-50/50 flex justify-between items-center cursor-pointer hover:bg-orange-50/80 transition-colors"
            onClick={() => setIsGapsExpanded(!isGapsExpanded)}
          >
            <h3 className="font-bold text-orange-900 text-sm flex items-center space-x-2">
              <AlertTriangle size={16} />
              <span>待跟进项目 (资源未完全满足)</span>
            </h3>
            <button className="text-orange-400 hover:text-orange-600 transition-colors">
              {isGapsExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {isGapsExpanded && (
          <div className="p-0 animate-in slide-in-from-top-2 duration-200">{(!unscheduledProjects.length && !partiallyScheduledProjects.length) ? <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有项目均已获得足额排期</p> : (
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20"><th className="p-3">项目名称</th><th className="p-3 text-center text-orange-600">开发缺口</th><th className="p-3 text-center text-teal-600">测试缺口</th></tr></thead>
              <tbody>{[...partiallyScheduledProjects, ...unscheduledProjects].map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-3 font-bold text-gray-900">{p.name}</td>
                  <td className="p-3 text-center">{p.devGap > 0 ? <span className="font-mono font-bold text-orange-600">{Math.round(p.devGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                  <td className="p-3 text-center">{p.testGap > 0 ? <span className="font-mono font-bold text-teal-600">{Math.round(p.testGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div 
            className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex justify-between items-center cursor-pointer hover:bg-indigo-50/80 transition-colors"
            onClick={() => setIsIdleExpanded(!isIdleExpanded)}
          >
            <h3 className="font-bold text-indigo-900 text-sm flex items-center space-x-2">
              <Users size={16} />
              <span>待补充任务 (人员仍有闲置)</span>
            </h3>
            <button className="text-indigo-400 hover:text-indigo-600 transition-colors">
              {isIdleExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
          {isIdleExpanded && (
          <div className="p-0 animate-in slide-in-from-top-2 duration-200">{(!resourceIdle.length) ? <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有人员均已满载排期</p> : (
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20"><th className="p-3">人员姓名</th><th className="p-3 text-center">闲置天数</th><th className="p-3 text-center">饱和度</th></tr></thead>
              <tbody>{resourceIdle.map(r => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-3"><div className="font-bold text-gray-900">{r.name}</div><div className="text-[10px] text-gray-400">{r.role}</div></td>
                  <td className="p-3 text-center"><span className="font-mono font-bold text-indigo-600">{Math.round(r.idleMd)}d</span></td>
                  <td className="p-3 text-center"><div className="flex flex-col items-center"><div className="w-16 bg-gray-100 h-1 rounded-full mb-1"><div className="bg-indigo-400 h-1 rounded-full" style={{width: `${r.utilization}%`}}></div></div><span className="text-[9px] font-bold text-gray-500">{r.utilization.toFixed(0)}%</span></div></td>
                </tr>
              ))}</tbody>
            </table>
          )}</div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div 
          className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center cursor-pointer hover:bg-gray-100/80 transition-colors"
          onClick={() => setIsPendingExpanded(!isPendingExpanded)}
        >
          <div className="flex items-center space-x-2">
            <FileWarning size={18} className="text-orange-500" />
            <h3 className="font-bold text-gray-900 text-sm">待评估项目 (未填写开发/测试工时，不参与排期)</h3>
          </div>
          <button className="text-gray-400 hover:text-gray-600 transition-colors">
            {isPendingExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
        {isPendingExpanded && (
        <div className="p-0 animate-in slide-in-from-top-2 duration-200">{pendingProjects.length === 0 ? <p className="text-gray-400 text-center py-8 text-xs italic">暂无待评估项目</p> : (
          <table className="w-full text-left border-collapse text-xs">
            <thead><tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10"><th className="p-3">项目名称</th><th className="p-3">业务负责人</th><th className="p-3">优先级</th><th className="p-3">状态</th><th className="p-3">备注</th></tr></thead>
            <tbody>{pendingProjects.map(p => (
              <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                <td className="p-3 font-medium text-gray-700">{p.name}</td>
                <td className="p-3 text-gray-500">{p.businessOwner || '-'}</td>
                <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{p.priority}</span></td>
                <td className="p-3"><span className="text-[10px] text-gray-400 uppercase font-bold">{p.status}</span></td>
                <td className="p-3 text-gray-400 italic truncate max-w-[200px]">{p.comments || '-'}</td>
              </tr>
            ))}</tbody>
          </table>
        )}</div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
