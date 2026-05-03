import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { useScheduling } from '../../context/SchedulingContext';
import { Users, ChevronDown, ArrowRight, ClipboardList, AlertTriangle, FileWarning, Search, TriangleAlert, User, Briefcase, RefreshCcw, CheckCircle2, Settings2, Zap, X } from 'lucide-react';
import { calculateMonthlyMD, getWorkingDays } from '../../utils/dateUtils';

export const Dashboard = () => {
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  const allocations = useLiveQuery(() => db.allocations.toArray());
  
  const { isScheduling, scheduleStatus, currentStep, error, strategy, setStrategy, handleGenerateSchedule, stopScheduling, clearError } = useScheduling();
  const [groupMode, setGroupMode] = useState<'resource' | 'project'>('resource');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentQuarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
  const currentQuarterEnd = currentQuarterStart + 2;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(currentQuarterStart);
  const [endMonth, setEndMonth] = useState(currentQuarterEnd);

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const displayMonths = useMemo(() => {
    const list = [];
    for (let m = startMonth; m <= endMonth; m++) {
      list.push({ year: selectedYear, month: m });
    }
    return list;
  }, [selectedYear, startMonth, endMonth]);

  // UI-only audit logic for display
  const runAuditForUI = (currentProjects: any[], currentResources: any[], currentAllocations: any[]) => {
    const gaps = currentProjects.map(p => {
      const pAllocations = currentAllocations.filter(a => Number(a.projectId) === Number(p.id));
      let dev = 0, test = 0;
      pAllocations.forEach(a => {
        const res = currentResources.find(r => Number(r.id) === Number(a.resourceId));
        const workingDays = getWorkingDays(new Date(a.startDate), new Date(a.endDate));
        const md = Math.round((workingDays * (a.allocationPercentage || 0)) / 100);
        if (a.allocationType === 'test' || res?.role === '测试工程师') test += md; else dev += md;
      });
      return { ...p, devGap: Math.max(0, p.devTotalMd - dev), testGap: Math.max(0, p.testTotalMd - test) };
    }).filter(p => p.devGap >= 1 || p.testGap >= 1);

    const idle = currentResources.map(r => {
      const rAllocations = currentAllocations.filter(a => Number(a.resourceId) === Number(r.id));
      let totalAllocatedMdInRange = 0;
      displayMonths.forEach(m => {
        rAllocations.forEach(a => {
          totalAllocatedMdInRange += Math.round(calculateMonthlyMD(a.startDate, a.endDate, a.allocationPercentage, m.year, m.month));
        });
      });
      
      const rangeStart = new Date(selectedYear, startMonth - 1, 1);
      const rangeEnd = new Date(selectedYear, endMonth, 0);
      const totalWorkingDaysInRange = getWorkingDays(rangeStart, rangeEnd);
      const capacityMd = Math.round((totalWorkingDaysInRange * r.capacity) / 100);
      const utilization = capacityMd > 0 ? (totalAllocatedMdInRange / capacityMd) * 100 : 0;
      return { ...r, idleMd: Math.max(0, capacityMd - totalAllocatedMdInRange), utilization };
    }).filter(r => r.idleMd >= 1);

    return { gaps, idle };
  };

  const { readyProjects, pendingProjects, projectGaps, resourceIdle } = useMemo(() => {
    if (!projects || !resources || !allocations) return { readyProjects: [], pendingProjects: [], projectGaps: [], resourceIdle: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    const pending = projects.filter(p => p.devTotalMd === 0 && p.testTotalMd === 0);
    const { gaps, idle } = runAuditForUI(ready, resources, allocations);
    return { readyProjects: ready, pendingProjects: pending, projectGaps: gaps, resourceIdle: idle };
  }, [projects, resources, allocations, selectedYear, startMonth, endMonth, displayMonths]);

  const scheduledProjectsList = useMemo(() => {
    if (!projects || !allocations || !resources) return [];
    return projects.filter(p => {
      const pAllocs = allocations.filter(a => Number(a.projectId) === Number(p.id));
      if (pAllocs.length === 0) return false;
      const hasDevReq = p.devTotalMd > 0, hasTestReq = p.testTotalMd > 0;
      const hasDevAlloc = pAllocs.some(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'dev' || (res && ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(res.role));
      });
      const hasTestAlloc = pAllocs.some(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'test' || (res && res.role === '测试工程师');
      });
      if (hasDevReq && hasTestReq) return hasDevAlloc && hasTestAlloc;
      if (hasDevReq) return hasDevAlloc;
      if (hasTestReq) return hasTestAlloc;
      return false;
    }).map(p => {
      const pAllocs = allocations.filter(a => Number(a.projectId) === Number(p.id));
      const devs = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'dev' || (res && ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(res.role));
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      const testers = Array.from(new Set(pAllocs.filter(a => {
        const res = resources.find(r => Number(r.id) === Number(a.resourceId));
        return a.allocationType === 'test' || (res && res.role === '测试工程师');
      }).map(a => resources.find(r => r.id === a.resourceId)?.name))).filter(Boolean);
      return { ...p, assignedDevs: devs.join(', '), assignedTesters: testers.join(', '), allPersonnel: [...new Set([...devs, ...testers])].join(', ') };
    });
  }, [projects, allocations, resources]);

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

          <div className="flex items-center space-x-2 px-2 border-l border-gray-100">
            <Settings2 size={14} className="text-gray-400" />
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as any)} className="appearance-none py-2 pr-4 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer bg-transparent">
              <option value="focused">专注模式 (1人1项目 100%)</option>
              <option value="balanced">均衡模式 (分时多任务 50%)</option>
              <option value="urgent">紧急模式 (加急推进 100%+)</option>
            </select>
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
            <button 
              onClick={() => handleGenerateSchedule(selectedYear, startMonth, endMonth)}
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

      {/* Scheduled Projects Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-blue-50/20 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span>已排项目 (共 {scheduledProjectsList.length} 个)</span>
          </h3>
        </div>
        <div className="p-0 overflow-x-auto">
          {scheduledProjectsList.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-xs italic">当前暂无完整排期的项目</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  <th className="p-4">项目名称</th>
                  <th className="p-4">开发负责人</th>
                  <th className="p-4">测试负责人</th>
                  <th className="p-4">所有参与人员</th>
                </tr>
              </thead>
              <tbody>
                {scheduledProjectsList.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-green-50/10 transition-colors">
                    <td className="p-4 font-black text-gray-900">{p.name}</td>
                    <td className="p-4 text-gray-600 font-medium">{p.projectTechLead || '-'}</td>
                    <td className="p-4 text-gray-600 font-medium">{p.projectQualityLead || '-'}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {p.allPersonnel.split(', ').map((name: string) => (
                          <span key={name} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-[10px] font-bold">
                            {name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm">已排期任务详情</h3>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setGroupMode('resource')} className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'resource' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><User size={14} /><span>按人员分组</span></button>
            <button onClick={() => setGroupMode('project')} className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><Briefcase size={14} /><span>按项目分组</span></button>
          </div>
        </div>
        <div className="p-0 overflow-x-auto">
          {allocations?.length === 0 ? <p className="text-gray-400 text-center py-16 text-sm font-medium">暂无排期数据</p> : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  <th className="p-4 min-w-[150px]">{groupMode === 'resource' ? '研发资源' : '承接项目'}</th>
                  <th className="p-4 min-w-[200px]">{groupMode === 'resource' ? '承接项目' : '参与人员'}</th>
                  <th className="p-4 text-center">投入比</th>
                  {displayMonths.map(m => <th key={`${m.year}-${m.month}`} className="p-4 text-center border-l border-gray-50 min-w-[70px]">{m.month}月</th>)}
                </tr>
              </thead>
              <tbody>
                {groupMode === 'resource' ? allocations?.map((alloc) => {
                  const resource = resources?.find(r => Number(r.id) === Number(alloc.resourceId));
                  const project = projects?.find(p => Number(p.id) === Number(alloc.projectId));
                  return (
                    <tr key={alloc.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                      <td className="p-4 border-r border-gray-50 bg-gray-50/5"><div className="font-black text-gray-900">{resource?.name || 'Unknown'}</div><div className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{resource?.role}</div></td>
                      <td className="p-4"><div className="text-blue-600 font-black leading-tight">{project?.name || 'Unknown'}</div><div className="text-[10px] text-gray-400 mt-1 font-medium">{alloc.startDate} ~ {alloc.endDate}</div></td>
                      <td className="p-4 text-center"><span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{alloc.allocationPercentage}%</span></td>
                      {displayMonths.map(m => {
                        const md = Math.round(calculateMonthlyMD(alloc.startDate, alloc.endDate, alloc.allocationPercentage, m.year, m.month));
                        return <td key={`${m.year}-${m.month}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/10' : 'text-gray-200'}`}>{md > 0 ? md : '-'}</td>;
                      })}
                    </tr>
                  );
                }) : projects?.filter(p => allocations?.some(a => Number(a.projectId) === Number(p.id))).map(p => {
                  const projectAllocations = allocations?.filter(a => Number(a.projectId) === Number(p.id)) || [];
                  return projectAllocations.map((alloc, idx) => {
                    const resource = resources?.find(r => Number(r.id) === Number(alloc.resourceId));
                    return (
                      <tr key={alloc.id} className={`border-b border-gray-100 hover:bg-indigo-50/20 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                        <td className="p-4 border-r border-gray-50 bg-indigo-50/5">{idx === 0 && <div className="font-black text-indigo-700 leading-tight">{p.name}</div>}</td>
                        <td className="p-4"><div className="font-bold text-gray-900">{resource?.name || 'Unknown'}</div><div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div></td>
                        <td className="p-4 text-center"><span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{alloc.allocationPercentage}%</span></td>
                        {displayMonths.map(m => {
                          const md = Math.round(calculateMonthlyMD(alloc.startDate, alloc.endDate, alloc.allocationPercentage, m.year, m.month));
                          return <td key={`${m.year}-${m.month}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/10' : 'text-gray-200'}`}>{md > 0 ? md : '-'}</td>;
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-orange-100 bg-orange-50/50"><h3 className="font-bold text-orange-900 text-sm flex items-center space-x-2"><AlertTriangle size={16} /><span>待跟进项目 (资源未完全满足)</span></h3></div>
          <div className="p-0">{(!projectGaps.length) ? <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有项目均已获得足额排期</p> : (
            <table className="w-full text-left border-collapse text-xs">
              <thead><tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20"><th className="p-3">项目名称</th><th className="p-3 text-center text-orange-600">开发缺口</th><th className="p-3 text-center text-teal-600">测试缺口</th></tr></thead>
              <tbody>{projectGaps.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-3 font-bold text-gray-900">{p.name}</td>
                  <td className="p-3 text-center">{p.devGap > 0 ? <span className="font-mono font-bold text-orange-600">{Math.round(p.devGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                  <td className="p-3 text-center">{p.testGap > 0 ? <span className="font-mono font-bold text-teal-600">{Math.round(p.testGap)}d</span> : <span className="text-gray-200">-</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/50"><h3 className="font-bold text-indigo-900 text-sm flex items-center space-x-2"><Users size={16} /><span>待补充任务 (人员仍有闲置)</span></h3></div>
          <div className="p-0">{(!resourceIdle.length) ? <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有人员均已满载排期</p> : (
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
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2"><FileWarning size={18} className="text-orange-500" /><h3 className="font-bold text-gray-900 text-sm">待评估项目 (未填写开发/测试工时，不参与排期)</h3></div>
        <div className="p-0">{pendingProjects.length === 0 ? <p className="text-gray-400 text-center py-8 text-xs italic">暂无待评估项目</p> : (
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
      </div>
    </div>
  );
};
