import { useState } from 'react';
import { useDashboard } from '../../../context/DashboardContext';
import { calculateWeeklyMD } from '../../../utils/dateUtils';
import { User, Briefcase } from 'lucide-react';

export const ScheduleDetails = () => {
  const { 
    displayWeeks, displayWeeksGrouped, workingDaySet,
    allocations, projects, resources, operations
  } = useDashboard();

  const [groupMode, setGroupMode] = useState<'resource' | 'project'>('resource');

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">排期明细矩阵</h2>
          <p className="text-xs font-bold text-gray-400 mt-1.5">细化到周的人力资源分配详情</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-160px)]">
        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm">按时间展开的排期明细表</h3>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setGroupMode('resource')} 
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'resource' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <User size={14} /><span>按人员分组</span>
            </button>
            <button 
              onClick={() => setGroupMode('project')} 
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Briefcase size={14} /><span>按项目分组</span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-0">
          {!allocations || allocations.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm font-medium italic">当前时间范围内暂无排期数据，请回「全局概览」调整时间或执行排期</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs relative">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50">
                  <th rowSpan={2} className="p-4 min-w-[150px] sticky left-0 z-20 bg-gray-50 border-r border-gray-200">{groupMode === 'resource' ? '研发资源' : '承接项目'}</th>
                  <th rowSpan={2} className="p-4 min-w-[200px] sticky left-[150px] z-20 bg-gray-50 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{groupMode === 'resource' ? '承接项目' : '参与人员'}</th>
                  <th rowSpan={2} className="p-4 text-center bg-gray-50">投入比</th>
                  {displayWeeksGrouped.map((g, idx) => (
                    <th key={idx} colSpan={g.span} className="py-2 text-center border-l border-gray-200 text-gray-500 bg-gray-100">
                      {g.month} 月
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50">
                  {displayWeeks.map(w => (
                    <th key={`${w.year}-${w.week}`} className="py-2 text-center border-l border-gray-100 min-w-[70px] text-[10px] bg-gray-50/80">
                      {w.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupMode === 'resource' ? (() => {
                  const map = new Map<string, any[]>();
                  allocations.forEach(a => {
                    const key = `${a.resourceId}_${a.projectId}`;
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(a);
                  });
                  
                  return Array.from(map.values()).map((group) => {
                    const alloc = group[0];
                    const resource = resources.find(r => Number(r.id) === Number(alloc.resourceId));
                    const isOp = Number(alloc.projectId) <= -1000000;
                    const opId = isOp ? -Number(alloc.projectId) - 1000000 : null;
                    const operation = isOp ? operations.find(o => Number(o.id) === opId) : null;
                    const project = isOp ? null : projects.find(p => Number(p.id) === Number(alloc.projectId));
                    const projName = isOp ? `[运维] ${operation?.productName || 'Unknown'}` : (project?.name || 'Unknown');
                    
                    const minStart = group.map(a => a.startDate).sort()[0];
                    const maxEnd = group.map(a => a.endDate).sort().reverse()[0];
                    const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                    const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';

                    return (
                      <tr key={`${alloc.resourceId}_${alloc.projectId}`} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-blue-50/30 transition-colors">
                          <div className="font-black text-gray-900">{resource?.name || 'Unknown'}</div>
                          <div className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{resource?.role}</div>
                        </td>
                        <td className="p-4 sticky left-[150px] z-10 bg-white border-r border-gray-100 group-hover:bg-blue-50/30 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                          <div className="text-blue-600 font-black leading-tight">{projName}</div>
                          <div className="text-[10px] text-gray-400 mt-1 font-medium">{minStart} ~ {maxEnd}</div>
                        </td>
                        <td className="p-4 text-center bg-white group-hover:bg-blue-50/30 transition-colors">
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span>
                        </td>
                        {displayWeeks.map(w => {
                          const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                          return (
                            <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-blue-50/30' : 'text-gray-200 bg-white'} group-hover:bg-blue-50/50 transition-colors`}>
                              {md > 0 ? md : '-'}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })() : [
                  ...(projects.filter(p => allocations.some(a => Number(a.projectId) === Number(p.id))).map(p => {
                    const projectAllocations = allocations.filter(a => Number(a.projectId) === Number(p.id));
                    const map = new Map<string, any[]>();
                    projectAllocations.forEach(a => {
                      const key = `${a.resourceId}`;
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(a);
                    });
                    const grouped = Array.from(map.values());
                    
                    return grouped.map((group, idx) => {
                      const alloc = group[0];
                      const resource = resources.find(r => Number(r.id) === Number(alloc.resourceId));
                      const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                      const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';
                      
                      return (
                        <tr key={`${p.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors">
                            {idx === 0 && <div className="font-black text-indigo-700 leading-tight">{p.name}</div>}
                          </td>
                          <td className="p-4 sticky left-[150px] z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="font-bold text-gray-900">{resource?.name || 'Unknown'}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div>
                          </td>
                          <td className="p-4 text-center bg-white group-hover:bg-indigo-50/30 transition-colors">
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span>
                          </td>
                          {displayWeeks.map(w => {
                            const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                            return (
                              <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-indigo-50/30' : 'text-gray-200 bg-white'} group-hover:bg-indigo-50/50 transition-colors`}>
                                {md > 0 ? md : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  })),
                  ...(operations.filter(op => allocations.some(a => Number(a.projectId) === -(Number(op.id) + 1000000))).map(op => {
                    const opAllocations = allocations.filter(a => Number(a.projectId) === -(Number(op.id) + 1000000));
                    const map = new Map<string, any[]>();
                    opAllocations.forEach(a => {
                      const key = `${a.resourceId}`;
                      if (!map.has(key)) map.set(key, []);
                      map.get(key)!.push(a);
                    });
                    const grouped = Array.from(map.values());
                    
                    return grouped.map((group, idx) => {
                      const alloc = group[0];
                      const resource = resources.find(r => Number(r.id) === Number(alloc.resourceId));
                      const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                      const percStr = percs.length === 1 ? `${percs[0]}%` : 'Mixed';
                      
                      return (
                        <tr key={`${op.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors">
                            {idx === 0 && <div className="font-black text-indigo-700 leading-tight">[运维] {op.productName}</div>}
                          </td>
                          <td className="p-4 sticky left-[150px] z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="font-bold text-gray-900">{resource?.name || 'Unknown'}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div>
                          </td>
                          <td className="p-4 text-center bg-white group-hover:bg-indigo-50/30 transition-colors">
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span>
                          </td>
                          {displayWeeks.map(w => {
                            const md = group.reduce((sum, a) => sum + Math.round(calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet)), 0);
                            return (
                              <td key={`${w.year}-${w.week}`} className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${md > 0 ? 'text-gray-900 bg-indigo-50/30' : 'text-gray-200 bg-white'} group-hover:bg-indigo-50/50 transition-colors`}>
                                {md > 0 ? md : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  }))
                ]}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
