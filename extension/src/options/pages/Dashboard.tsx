import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { generateSchedule } from '../../services/ai';
import { Play, AlertCircle, Users, ChevronDown, ArrowRight, ClipboardList, AlertTriangle, FileWarning, Search } from 'lucide-react';
import { calculateMonthlyMD, getWorkingDays } from '../../utils/dateUtils';

export const Dashboard = () => {
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  const allocations = useLiveQuery(() => db.allocations.toArray());
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // --- Project Filtering & Gap Analysis Logic ---

  const { readyProjects, pendingProjects, projectGaps, resourceIdle } = useMemo(() => {
    if (!projects || !resources || !allocations) {
      return { readyProjects: [], pendingProjects: [], projectGaps: [], resourceIdle: [] };
    }

    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    const pending = projects.filter(p => p.devTotalMd === 0 && p.testTotalMd === 0);

    const gaps = ready.map(p => {
      const pAllocations = allocations.filter(a => a.projectId === p.id);
      let allocatedDevMd = 0;
      let allocatedTestMd = 0;

      pAllocations.forEach(a => {
        const res = resources.find(r => r.id === a.resourceId);
        const totalMd = Math.round((getWorkingDays(new Date(a.startDate), new Date(a.endDate)) * a.allocationPercentage) / 100);
        if (res?.role === '测试工程师') {
          allocatedTestMd += totalMd;
        } else {
          allocatedDevMd += totalMd;
        }
      });

      return {
        ...p,
        devGap: Math.max(0, p.devTotalMd - allocatedDevMd),
        testGap: Math.max(0, p.testTotalMd - allocatedTestMd),
        isUnscheduled: pAllocations.length === 0
      };
    }).filter(p => p.devGap >= 1 || p.testGap >= 1);

    const rangeStart = new Date(selectedYear, startMonth - 1, 1);
    const rangeEnd = new Date(selectedYear, endMonth, 0);
    const totalWorkingDaysInRange = getWorkingDays(rangeStart, rangeEnd);

    const idle = resources.map(r => {
      const rAllocations = allocations.filter(a => a.resourceId === r.id);
      let totalAllocatedMdInRange = 0;

      displayMonths.forEach(m => {
        rAllocations.forEach(a => {
          totalAllocatedMdInRange += Math.round(calculateMonthlyMD(a.startDate, a.endDate, a.allocationPercentage, m.year, m.month));
        });
      });

      const capacityMd = Math.round((totalWorkingDaysInRange * r.capacity) / 100);
      return {
        ...r,
        idleMd: Math.max(0, capacityMd - totalAllocatedMdInRange),
        utilization: capacityMd > 0 ? (totalAllocatedMdInRange / capacityMd) * 100 : 0
      };
    }).filter(r => r.idleMd >= 1);

    return { readyProjects: ready, pendingProjects: pending, projectGaps: gaps, resourceIdle: idle };
  }, [projects, resources, allocations, selectedYear, startMonth, endMonth, displayMonths]);

  const handleGenerateSchedule = async () => {
    if (!resources || !readyProjects.length) return;
    
    console.group('🚀 AI 智能排期流程启动');
    setIsScheduling(true);
    setError(null);
    try {
      console.log('[Dashboard] 🧹 Cleaning up existing allocations...');
      await db.allocations.clear();
      
      const newAllocations = await generateSchedule(resources, readyProjects, selectedYear);
      
      console.log('[Dashboard] 🔍 Validating and saving allocations...');
      let savedCount = 0;
      
      for (const alloc of newAllocations) {
        if (alloc.resourceId && alloc.projectId && alloc.startDate && alloc.endDate) {
          // Double check the MD calculation on the client side
          const workingDays = getWorkingDays(new Date(alloc.startDate), new Date(alloc.endDate));
          const calculatedMd = Math.round((workingDays * (alloc.allocationPercentage || 0)) / 100);
          
          if (calculatedMd >= 1) {
            await db.allocations.add({
              resourceId: alloc.resourceId,
              projectId: alloc.projectId,
              allocationPercentage: alloc.allocationPercentage || 100,
              startDate: alloc.startDate,
              endDate: alloc.endDate,
            });
            savedCount++;
          } else {
            console.warn('[Dashboard] ⚠️ Filtering out invalid 0-day allocation:', alloc);
          }
        }
      }
      console.log(`[Dashboard] ✨ Successfully saved ${savedCount} valid allocations.`);
    } catch (err: any) {
      console.error('[Dashboard] ❌ Scheduling Failed:', err);
      setError(err.message);
    } finally {
      setIsScheduling(false);
      console.groupEnd();
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">全局排期大盘</h2>
          <p className="text-gray-500 mt-1">自动过滤待评估项目，聚焦核心排期任务</p>
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
            <select
              value={startMonth}
              onChange={(e) => setStartMonth(Number(e.target.value))}
              className="appearance-none py-2 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer"
            >
              {months.map(m => <option key={m} value={m}>{m}月</option>)}
            </select>
            <ArrowRight size={14} className="text-gray-300" />
            <select
              value={endMonth}
              onChange={(e) => setEndMonth(Number(e.target.value))}
              className="appearance-none py-2 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer"
            >
              {months.map(m => <option key={m} value={m} disabled={m < startMonth}>{m}月</option>)}
            </select>
          </div>

          <button 
            onClick={handleGenerateSchedule}
            disabled={isScheduling || !readyProjects.length || !resources?.length}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-all ml-2"
          >
            <Play size={16} className={isScheduling ? "animate-pulse" : ""} />
            <span>{isScheduling ? '排期中...' : 'AI 智能排期'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-start space-x-3 text-sm">
          <AlertCircle className="text-red-500 mt-0.5" size={18} />
          <p className="text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Analysis Summary Cards */}
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

      {/* Main Allocations Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="font-bold text-gray-900 text-sm">已排期任务详情</h3>
        </div>
        <div className="p-0 overflow-x-auto">
          {allocations?.length === 0 ? (
            <p className="text-gray-400 text-center py-12 text-sm font-medium">暂无排期数据</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50/30">
                  <th className="p-4 min-w-[120px]">人员</th>
                  <th className="p-4 min-w-[220px]">项目</th>
                  <th className="p-4 text-center">投入比</th>
                  {displayMonths.map(m => (
                    <th key={`${m.year}-${m.month}`} className="p-4 text-center border-l border-gray-50 min-w-[70px]">
                      {m.month}月
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocations?.map((alloc) => {
                  const resource = resources?.find(r => r.id === alloc.resourceId);
                  const project = projects?.find(p => p.id === alloc.projectId);
                  return (
                    <tr key={alloc.id} className="border-b border-gray-100 hover:bg-blue-50/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-900">{resource?.name}</div>
                        <div className="text-[10px] text-gray-400">{resource?.role}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-blue-600 font-bold leading-tight">{project?.name}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{alloc.startDate} ~ {alloc.endDate}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-black border border-green-100">
                          {alloc.allocationPercentage}%
                        </span>
                      </td>
                      {displayMonths.map(m => {
                        const md = Math.round(calculateMonthlyMD(alloc.startDate, alloc.endDate, alloc.allocationPercentage, m.year, m.month));
                        return (
                          <td key={`${m.year}-${m.month}`} className={`p-4 text-center font-mono font-bold border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/5' : 'text-gray-200'}`}>
                            {md > 0 ? md : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Exception Panels */}
      <div className="grid grid-cols-2 gap-6 mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-orange-100 bg-orange-50/50">
            <h3 className="font-bold text-orange-900 text-sm flex items-center space-x-2">
              <AlertTriangle size={16} />
              <span>待跟进项目 (资源未完全满足)</span>
            </h3>
          </div>
          <div className="p-0">
            {(!projectGaps.length) ? (
              <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有项目均已获得足额排期</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20">
                    <th className="p-3">项目名称</th>
                    <th className="p-3 text-center text-orange-600">开发缺口</th>
                    <th className="p-3 text-center text-teal-600">测试缺口</th>
                  </tr>
                </thead>
                <tbody>
                  {projectGaps.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3">
                        <div className={`font-bold ${p.isUnscheduled ? 'text-red-600' : 'text-gray-900'}`}>{p.name}</div>
                      </td>
                      <td className="p-3 text-center">
                        {p.devGap > 0 ? <span className="font-mono font-bold text-orange-600">{Math.round(p.devGap)}d</span> : <span className="text-gray-200">-</span>}
                      </td>
                      <td className="p-3 text-center">
                        {p.testGap > 0 ? <span className="font-mono font-bold text-teal-600">{Math.round(p.testGap)}d</span> : <span className="text-gray-200">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/50">
            <h3 className="font-bold text-indigo-900 text-sm flex items-center space-x-2">
              <Users size={16} />
              <span>待补充任务 (人员仍有闲置)</span>
            </h3>
          </div>
          <div className="p-0">
            {(!resourceIdle.length) ? (
              <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有人员均已满载排期</p>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20">
                    <th className="p-3">人员姓名</th>
                    <th className="p-3 text-center">闲置天数</th>
                    <th className="p-3 text-center">饱和度</th>
                  </tr>
                </thead>
                <tbody>
                  {resourceIdle.map(r => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-gray-900">{r.name}</div>
                        <div className="text-[10px] text-gray-400">{r.role}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-mono font-bold text-indigo-600">{Math.round(r.idleMd)}d</span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-16 bg-gray-100 h-1 rounded-full mb-1">
                            <div className="bg-indigo-400 h-1 rounded-full" style={{width: `${r.utilization}%`}}></div>
                          </div>
                          <span className="text-[9px] font-bold text-gray-500">{r.utilization.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Pending Assessment Section at the bottom */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
          <FileWarning size={18} className="text-orange-500" />
          <h3 className="font-bold text-gray-900 text-sm">待评估项目 (未填写开发/测试工时，不参与排期)</h3>
        </div>
        <div className="p-0">
          {pendingProjects.length === 0 ? (
            <p className="text-gray-400 text-center py-8 text-xs italic">暂无待评估项目</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-widest bg-gray-50/10">
                  <th className="p-3">项目名称</th>
                  <th className="p-3">业务负责人</th>
                  <th className="p-3">优先级</th>
                  <th className="p-3">状态</th>
                  <th className="p-3">备注</th>
                </tr>
              </thead>
              <tbody>
                {pendingProjects.map(p => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 font-medium text-gray-700">{p.name}</td>
                    <td className="p-3 text-gray-500">{p.businessOwner || '-'}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">{p.priority}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">{p.status}</span>
                    </td>
                    <td className="p-3 text-gray-400 italic truncate max-w-[200px]">{p.comments || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
