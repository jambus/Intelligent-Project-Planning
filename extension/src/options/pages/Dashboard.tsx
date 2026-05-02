import { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { suggestAllocationsForBatch, type AIMicroAllocation, type SchedulingStrategy } from '../../services/ai';
import { Users, ChevronDown, ArrowRight, ClipboardList, AlertTriangle, FileWarning, Search, TriangleAlert, User, Briefcase, RefreshCcw, CheckCircle2, Settings2, Zap } from 'lucide-react';
import { calculateMonthlyMD, getWorkingDays, calculateEndDate, isWorkingDay, isValidDateStr } from '../../utils/dateUtils';

interface DailySlot {
  date: string;
  totalCapacity: number;
  usedCapacity: number;
  available: number;
}

export const Dashboard = () => {
  const projects = useLiveQuery(() => db.projects.toArray());
  const resources = useLiveQuery(() => db.resources.toArray());
  const allocations = useLiveQuery(() => db.allocations.toArray());
  
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [currentStep, setCurrentStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [groupMode, setGroupMode] = useState<'resource' | 'project'>('resource');
  const [strategy, setStrategy] = useState<SchedulingStrategy>('balanced');

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

  const lastDay = new Date(selectedYear, endMonth, 0).getDate();
  const scheduleMaxDate = `${selectedYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const defaultStart = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01`;

  // --- Reusable Time Slot Logic (方案 A) ---
  const generateResourceCalendar = (res: any, currentAllocations: any[]) => {
    const calendar: DailySlot[] = [];
    const rangeStart = new Date(selectedYear, startMonth - 1, 1);
    const rangeEnd = new Date(selectedYear, endMonth, 0);
    
    let current = new Date(rangeStart);
    while (current <= rangeEnd) {
      if (isWorkingDay(current)) {
        const dateStr = current.toISOString().split('T')[0];
        let used = 0;
        currentAllocations.filter(a => Number(a.resourceId) === Number(res.id)).forEach(a => {
          if (dateStr >= a.startDate && dateStr <= a.endDate) {
            used += (a.allocationPercentage || 0);
          }
        });
        calendar.push({
          date: dateStr,
          totalCapacity: res.capacity,
          usedCapacity: used,
          available: Math.max(0, res.capacity - used)
        });
      }
      current.setDate(current.getDate() + 1);
    }
    return calendar;
  };

  const getAvailableWindows = (calendar: DailySlot[]) => {
    const windows: { from: string, to: string, dailyAvailable: number }[] = [];
    if (calendar.length === 0) return windows;

    let currentWindow: any = null;

    calendar.forEach(slot => {
      if (slot.available >= 1) {
        if (!currentWindow || currentWindow.dailyAvailable !== slot.available) {
          if (currentWindow) windows.push(currentWindow);
          currentWindow = { from: slot.date, to: slot.date, dailyAvailable: slot.available };
        } else {
          currentWindow.to = slot.date;
        }
      } else {
        if (currentWindow) {
          windows.push(currentWindow);
          currentWindow = null;
        }
      }
    });
    if (currentWindow) windows.push(currentWindow);
    return windows;
  };

  const runAudit = (currentProjects: any[], currentResources: any[], currentAllocations: any[]) => {
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
      const calendar = generateResourceCalendar(r, currentAllocations);
      const availableWindows = getAvailableWindows(calendar);
      const idleMd = calendar.reduce((sum, slot) => sum + (slot.available / 100), 0);
      const capacityMd = calendar.length * (r.capacity / 100);
      const utilization = capacityMd > 0 ? ((capacityMd - idleMd) / capacityMd) * 100 : 0;
      
      const summary = availableWindows.map(w => `${w.from}~${w.to} (${w.dailyAvailable}%)`).join(', ');
      return { ...r, idleMd: Math.round(idleMd), utilization, scheduleSummary: summary ? `Free Slots: ${summary}` : 'Full' };
    }).filter(r => r.idleMd >= 1);

    return { gaps, idle };
  };

  const { readyProjects, pendingProjects, projectGaps, resourceIdle } = useMemo(() => {
    if (!projects || !resources || !allocations) return { readyProjects: [], pendingProjects: [], projectGaps: [], resourceIdle: [] };
    const ready = projects.filter(p => p.devTotalMd > 0 || p.testTotalMd > 0);
    const pending = projects.filter(p => p.devTotalMd === 0 && p.testTotalMd === 0);
    const { gaps, idle } = runAudit(ready, resources, allocations);
    return { readyProjects: ready, pendingProjects: pending, projectGaps: gaps, resourceIdle: idle };
  }, [projects, resources, allocations, selectedYear, startMonth, endMonth]);

  const scheduledProjectsList = useMemo(() => {
    if (!projects || !allocations || !resources) return [];
    
    return projects.filter(p => {
      const pAllocs = allocations.filter(a => Number(a.projectId) === Number(p.id));
      if (pAllocs.length === 0) return false;
      
      const hasDevReq = p.devTotalMd > 0;
      const hasTestReq = p.testTotalMd > 0;
      
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
      
      return {
        ...p,
        assignedDevs: devs.join(', '),
        assignedTesters: testers.join(', '),
        allPersonnel: [...new Set([...devs, ...testers])].join(', ')
      };
    });
  }, [projects, allocations, resources]);

  const findEarliestFitDate = (resourceId: number, currentAllocations: any[], defaultStartDate: string, percentage: number) => {
    const res = resources?.find(r => Number(r.id) === Number(resourceId));
    if (!res) return "9999-12-31";
    const calendar = generateResourceCalendar(res, currentAllocations);
    const fit = calendar.find(slot => slot.date >= defaultStartDate && slot.available >= percentage);
    return fit ? fit.date : "9999-12-31";
  };

  const calculateTestStartDate = (projectId: number, currentAllocations: any[], defaultStartDate: string) => {
    const projAllocs = currentAllocations.filter(a => Number(a.projectId) === Number(projectId));
    if (projAllocs.length === 0) return defaultStartDate;
    let earliest = new Date('2099-12-31');
    projAllocs.forEach(a => {
      const s = new Date(a.startDate);
      if (s < earliest) earliest = s;
    });
    if (earliest.getFullYear() === 2099) return defaultStartDate;
    let d = new Date(earliest);
    while(!isWorkingDay(d)) d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const handleGenerateSchedule = async () => {
    if (!resources || !readyProjects.length) return;
    setIsScheduling(true);
    setError(null);
    setShowErrorModal(false);
    
    try {
      console.group('🚀 方案 A：时间槽位像素级调度启动');
      setCurrentStep(1);
      setScheduleStatus('🚀 像素建模：构建每日资源容量矩阵...');
      await db.allocations.clear();
      let currentAllocations: any[] = [];
      let totalAllocatedThisSession = 0;

      const applySuggestions = async (suggestions: AIMicroAllocation[], phase: 'dev' | 'test', pool: any[]) => {
        let count = 0;
        console.group(`[Hard Logic] Applying ${suggestions.length} AI suggestions for ${phase.toUpperCase()}`);
        
        for (const sug of suggestions) {
          const project = pool.find(p => Number(p.id) === Number(sug.projectId));
          const resource = resources.find(r => Number(r.id) === Number(sug.resourceId));
          if (!project || !resource) {
             console.warn(`[Logic Error] AI suggested non-existent project/resource: ProjID ${sug.projectId}, ResID ${sug.resourceId}`);
             continue;
          }

          const { gaps: cGaps, idle: cIdle } = runAudit(readyProjects, resources, currentAllocations);
          const pGap = cGaps.find(g => Number(g.id) === Number(project.id));
          const rIdle = cIdle.find(r => Number(r.id) === Number(resource.id));
          
          if (!pGap || !rIdle) {
             console.log(`[Skipped] ${resource.name} -> ${project.name}: No remaining gap or idle capacity.`);
             continue;
          }

          const targetGap = phase === 'dev' ? pGap.devGap : pGap.testGap;
          const finalMd = Math.min(Math.max(1, Math.round(sug.allocatedMd)), targetGap, rIdle.idleMd);

          console.log(`[Analyzing] ${resource.name} -> ${project.name} | AI Suggested: ${sug.allocatedMd}d | Hard Cap: ${finalMd}d (Gap: ${targetGap}d, Idle: ${rIdle.idleMd}d)`);

          if (finalMd >= 1) {
            const perc = sug.allocationPercentage || 100;
            let start = isValidDateStr(project.startDate) ? project.startDate! : defaultStart;
            if (phase === 'test') start = calculateTestStartDate(project.id!, currentAllocations, start);
            
            const startDate = findEarliestFitDate(resource.id!, currentAllocations, start, perc);
            
            if (startDate > scheduleMaxDate) {
               console.log(`[Reject] Start date ${startDate} exceeds boundary ${scheduleMaxDate}`);
               continue;
            }
            
            let endDate = calculateEndDate(startDate, finalMd, perc);
            if (endDate > scheduleMaxDate) {
               console.log(`[Truncate] End date ${endDate} was cut to ${scheduleMaxDate}`);
               endDate = scheduleMaxDate;
            }

            const newAlloc = { resourceId: resource.id!, projectId: project.id!, allocationPercentage: perc, startDate, endDate, allocationType: phase };
            currentAllocations.push(newAlloc);
            await db.allocations.add(newAlloc as any);
            count++;
            totalAllocatedThisSession += finalMd;
            console.log(`[Success] ✅ Assigned ${resource.name} to ${project.name} (${phase}) | ${startDate} to ${endDate} | %: ${perc}`);
          } else {
            console.log(`[Reject] Final calculated MD was < 1`);
          }
        }
        console.groupEnd();
        return count;
      };

      // PASS 1: Priority Mini-Batches
      setCurrentStep(2);
      const BATCH_SIZE = 3;
      for (let i = 0; i < readyProjects.length; i += BATCH_SIZE) {
        const batch = readyProjects.slice(i, i + BATCH_SIZE);
        setScheduleStatus(`🛠️ 阶段一：像素匹配 [${i+1}~${Math.min(i+BATCH_SIZE, readyProjects.length)}]...`);
        const { gaps: dGaps, idle: dIdle } = runAudit(readyProjects, resources, currentAllocations);
        const bDev = batch.map(p => ({ ...p, gap: dGaps.find(g => g.id === p.id)?.devGap || 0 })).filter(p => p.gap > 0);
        if (bDev.length && dIdle.some(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role))) {
          const sug = await suggestAllocationsForBatch(bDev as any, dIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role)), 'dev', strategy, false);
          await applySuggestions(sug, 'dev', batch);
        }
        const { gaps: tGaps, idle: tIdle } = runAudit(readyProjects, resources, currentAllocations);
        const bTest = batch.map(p => ({ ...p, gap: tGaps.find(g => g.id === p.id)?.testGap || 0 })).filter(p => p.gap > 0);
        if (bTest.length && tIdle.some(r => r.role === '测试工程师')) {
          const sug = await suggestAllocationsForBatch(bTest as any, tIdle.filter(r => r.role === '测试工程师'), 'test', strategy, false);
          await applySuggestions(sug, 'test', batch);
        }
      }

      // PASS 2: Integrity Audit
      setScheduleStatus(`🛡️ 阶段二：完整性审计回滚...`);
      let retryQueue: any[] = [];
      const { gaps: aGaps } = runAudit(readyProjects, resources, currentAllocations);
      for (const project of readyProjects) {
        const g = aGaps.find(pg => Number(pg.id) === Number(project.id));
        if (g && project.devTotalMd > 0 && project.testTotalMd > 0) {
          if ((g.devGap < project.devTotalMd && g.testGap === project.testTotalMd) || (g.devGap === project.devTotalMd && g.testGap < project.testTotalMd)) {
            currentAllocations = currentAllocations.filter(a => Number(a.projectId) !== Number(project.id));
            await db.allocations.where('projectId').equals(project.id!).delete();
            retryQueue.push(project);
          }
        }
      }

      // PASS 3: Convergence Loops
      setCurrentStep(3);
      let loop = 1;
      let progress = true;
      while (progress && loop <= 3) {
        setScheduleStatus(`🌾 阶段三：循环收割 (轮次 ${loop}/3)...`);
        const startMD = totalAllocatedThisSession;
        const { gaps: hGaps, idle: hIdle } = runAudit(readyProjects, resources, currentAllocations);
        if (hGaps.length === 0 || hIdle.length === 0) break;
        const pool = [...retryQueue, ...readyProjects.filter(p => !retryQueue.includes(p))];
        
        const devG = hGaps.map(g => ({ ...g, gap: g.devGap })).filter(g => g.gap > 0);
        const devI = hIdle.filter(r => ['前端工程师', '后端工程师', 'APP工程师', '全栈工程师'].includes(r.role));
        if (devG.length && devI.length) {
          const sug = await suggestAllocationsForBatch(devG as any, devI, 'dev', strategy, true);
          await applySuggestions(sug, 'dev', pool);
        }

        const { gaps: hGaps2, idle: hIdle2 } = runAudit(readyProjects, resources, currentAllocations);
        const testG = hGaps2.map(g => ({ ...g, gap: g.testGap })).filter(g => g.gap > 0);
        const testI = hIdle2.filter(r => r.role === '测试工程师');
        if (testG.length && testI.length) {
          const sug = await suggestAllocationsForBatch(testG as any, testI, 'test', strategy, true);
          await applySuggestions(sug, 'test', pool);
        }
        progress = totalAllocatedThisSession > startMD;
        loop++;
      }

      setCurrentStep(4);
      setScheduleStatus('✨ 方案 A 像素级调度完成！');
      console.groupEnd();
      setTimeout(() => { setScheduleStatus(''); setCurrentStep(0); }, 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
      setShowErrorModal(true);
      setCurrentStep(0);
    } finally {
      setIsScheduling(false);
    }
  };

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
            <select value={strategy} onChange={(e) => setStrategy(e.target.value as SchedulingStrategy)} className="appearance-none py-2 pr-4 text-sm font-medium text-gray-600 border-none focus:ring-0 cursor-pointer bg-transparent">
              <option value="focused">专注模式 (1人1项目 100%)</option>
              <option value="balanced">均衡模式 (分时多任务 50%)</option>
              <option value="urgent">紧急模式 (加急推进 100%+)</option>
            </select>
          </div>

          <button 
            onClick={handleGenerateSchedule}
            disabled={isScheduling || !readyProjects.length || !resources?.length}
            className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
              isScheduling 
                ? 'bg-blue-100 text-blue-400 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-blue-100'
            }`}
          >
            <Zap size={16} className={isScheduling ? "animate-pulse" : ""} />
            <span>{isScheduling ? '正在进行统筹优化...' : '一键 AI 智能排期'}</span>
          </button>
        </div>
      </div>

      {showErrorModal && (
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
                <button onClick={() => setShowErrorModal(false)} className="flex-1 bg-gray-100 py-3 rounded-2xl font-bold text-sm">我知道了</button>
                <button onClick={() => { setShowErrorModal(false); window.location.hash = '#/settings'; }} className="flex-1 bg-blue-600 text-white py-3 rounded-2xl font-bold text-sm shadow-lg">去检查系统设置</button>
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
