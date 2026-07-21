import { useState } from 'react';
import { useDashboard } from '../../../context/DashboardContext';
import { useTranslation } from '../../../context/I18nContext';
import { calculateWeeklyMD } from '../../../utils/dateUtils';
import { User, Briefcase, Download, Upload, Plus, X, Lock, Unlock } from 'lucide-react';
import { exportScheduleCsv, importScheduleCsv } from '../../../services/scheduleCsv';
import { updateWeeklyAllocation, transferAllocations, toggleRowLock } from '../../../db/services';

export const ScheduleDetails = () => {
  const { 
    displayWeeks, displayWeeksGrouped, workingDaySet,
    allocations, projects, resources, operations
  } = useDashboard();
  const { t } = useTranslation();

  const [groupMode, setGroupMode] = useState<'resource' | 'project'>('resource');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ resourceId: '', projectId: '', year: '', week: '', md: '' });

  
  const handleToggleLock = async (resourceId: number, projectId: number, currentLockState: boolean) => {
    try {
      await toggleRowLock(resourceId, projectId, !currentLockState);
    } catch (e) {
      console.error('Failed to toggle lock', e);
    }
  };

  const handleSwapResource = async (oldResourceId: number, newResourceId: number, projectId: number) => {
    if (!newResourceId || oldResourceId === newResourceId) return;
    try {
      await transferAllocations(oldResourceId, newResourceId, projectId);
    } catch (e) {
      console.error('Failed to swap resource', e);
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { resourceId, projectId, year, week, md } = addForm;
    if (!resourceId || !projectId || !year || !week || !md) return;
    try {
      await updateWeeklyAllocation(Number(resourceId), Number(projectId), Number(year), Number(week), Number(md), workingDaySet);
      setIsAddModalOpen(false);
      setAddForm({ resourceId: '', projectId: '', year: '', week: '', md: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const [isImporting, setIsImporting] = useState(false);
  const [editingCell, setEditingCell] = useState<{ resourceId: number; projectId: number; year: number; week: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleCellClick = (resourceId: number, projectId: number, year: number, week: number, currentMd: number) => {
    setEditingCell({ resourceId, projectId, year, week });
    setEditValue(currentMd > 0 ? currentMd.toString() : '');
  };

  const handleCellBlurOrEnter = async (resourceId: number, projectId: number, year: number, week: number) => {
    if (!editingCell) return;
    const newMd = Number(editValue) || 0;
    try {
      await updateWeeklyAllocation(resourceId, projectId, year, week, newMd, workingDaySet);
    } catch (e) {
      console.error('Failed to update allocation', e);
    } finally {
      setEditingCell(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, resourceId: number, projectId: number, year: number, week: number) => {
    if (e.key === 'Enter') {
      handleCellBlurOrEnter(resourceId, projectId, year, week);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const handleExport = () => {
    exportScheduleCsv(allocations, projects, resources, operations, displayWeeks, workingDaySet);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsImporting(true);
    try {
      await importScheduleCsv(e.target.files);
      // Optional: Add a success toast here
    } catch (error) {
      console.error('Import failed', error);
      alert(t('common.error'));
    } finally {
      setIsImporting(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('dashboard.scheduleDetailsTitle')}</h2>
          <p className="text-xs font-bold text-gray-400 mt-1.5">{t('dashboard.scheduleDetailsDesc')}</p>
        </div>
        <div className="flex items-center space-x-3">
          <input
            type="file"
            id="import-schedule-csv"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
            onChange={handleImport}
          />
          <button 
            onClick={() => {
               if (window.confirm(t('dashboard.importConfirmDesc'))) {
                 document.getElementById('import-schedule-csv')?.click();
               }
            }}
            disabled={isImporting}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Upload size={16} className="text-gray-500" />
            <span>{isImporting ? t('common.importing') : t('dashboard.importSchedule')}</span>
          </button>
          <button
            onClick={handleExport}
            disabled={!allocations || allocations.length === 0}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm ${
              !allocations || allocations.length === 0 
                ? 'bg-blue-50 text-blue-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
            }`}
          >
            <Download size={16} />
            <span>{t('dashboard.exportSchedule')}</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded text-sm font-bold hover:bg-blue-100 transition-colors ml-2"
          >
            <Plus size={16} />
            <span>新增排期</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-160px)]">
        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex justify-between items-center">
          <h3 className="font-bold text-gray-900 text-sm">{t('dashboard.matrixTitle')}</h3>
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button 
              onClick={() => setGroupMode('resource')} 
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'resource' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <User size={14} /><span>{t('dashboard.groupByResource')}</span>
            </button>
            <button 
              onClick={() => setGroupMode('project')} 
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${groupMode === 'project' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Briefcase size={14} /><span>{t('dashboard.groupByProject')}</span>
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-0">
          {!allocations || allocations.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm font-medium italic">{t('dashboard.noScheduleData')}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs relative">
              <thead className="sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-gray-200 text-gray-400 font-black uppercase tracking-widest bg-gray-50">
                  <th rowSpan={2} className="p-4 min-w-[150px] sticky left-0 z-20 bg-gray-50 border-r border-gray-200">{groupMode === 'resource' ? t('dashboard.colResource') : t('dashboard.colProject')}</th>
                  <th rowSpan={2} className="p-4 min-w-[200px] sticky left-[150px] z-20 bg-gray-50 border-r border-gray-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">{groupMode === 'resource' ? t('dashboard.colProject') : t('dashboard.colParticipant')}</th>
                  <th rowSpan={2} className="p-4 text-center bg-gray-50">{t('dashboard.colRatio')}</th>
                  {displayWeeksGrouped.map((g, idx) => (
                    <th key={idx} colSpan={g.span} className="py-2 text-center border-l border-gray-200 text-gray-500 bg-gray-100">
                      {g.month}{t('dashboard.monthSuffix')}
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

                  const resourceNameById = new Map(resources.map(resource => [Number(resource.id), resource.name]));
                  const projectNameById = new Map(projects.map(project => [Number(project.id), project.name]));
                  operations.forEach(operation => {
                    projectNameById.set(-(Number(operation.id) + 1000000), `${t('dashboard.opPrefix')}${operation.productName}`);
                  });
                  const groupedByResource = Array.from(map.values()).sort((left, right) => {
                    const leftAllocation = left[0];
                    const rightAllocation = right[0];
                    const resourceDifference = (resourceNameById.get(Number(leftAllocation.resourceId)) || '')
                      .localeCompare(resourceNameById.get(Number(rightAllocation.resourceId)) || '', undefined, { sensitivity: 'base', numeric: true });
                    if (resourceDifference !== 0) return resourceDifference;
                    const projectDifference = (projectNameById.get(Number(leftAllocation.projectId)) || '')
                      .localeCompare(projectNameById.get(Number(rightAllocation.projectId)) || '', undefined, { sensitivity: 'base', numeric: true });
                    return projectDifference || Number(leftAllocation.projectId) - Number(rightAllocation.projectId);
                  });

                  return groupedByResource.map((group) => {
                    const alloc = group[0];
                    const resource = resources.find(r => Number(r.id) === Number(alloc.resourceId));
                    const isOp = Number(alloc.projectId) <= -1000000;
                    const opId = isOp ? -Number(alloc.projectId) - 1000000 : null;
                    const operation = isOp ? operations.find(o => Number(o.id) === opId) : null;
                    const project = isOp ? null : projects.find(p => Number(p.id) === Number(alloc.projectId));
                    const projName = isOp ? `${t('dashboard.opPrefix')}${operation?.productName || t('dashboard.unknownProject')}` : (project?.name || t('dashboard.unknownProject'));
                    
                    const minStart = group.map(a => a.startDate).sort()[0];
                    const maxEnd = group.map(a => a.endDate).sort().reverse()[0];
                    const percs = Array.from(new Set(group.map(a => a.allocationPercentage)));
                    const percStr = percs.length === 1 ? `${percs[0]}%` : t('dashboard.mixedRatio');
                    const isLocked = group.some(a => a.isLocked);
                    return (
                      <tr key={`${alloc.resourceId}_${alloc.projectId}`} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-blue-50/30 transition-colors">
                          <div className="flex items-center space-x-1">
                          <button 
                            onClick={() => handleToggleLock(Number(alloc.resourceId), Number(alloc.projectId), isLocked)}
                            className={`p-1 rounded hover:bg-gray-100 transition-colors ${isLocked ? 'text-red-500' : 'text-gray-300'}`}
                            title={isLocked ? '解锁该排期行' : '锁定该排期行，防止AI覆盖'}
                          >
                            {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                          </button>
                          <select 
                            className="font-black text-gray-900 bg-transparent outline-none cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1 appearance-none"
                            value={resource?.id || ''}
                            onChange={(e) => handleSwapResource(Number(resource?.id), Number(e.target.value), Number(alloc.projectId))}
                          >
                            <option value="" disabled>{t('dashboard.unknownResource')}</option>
                            {resources.map(r => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
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
                            const mdRaw = group.reduce((sum, a) => sum + calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet), 0);
                            const formattedMd = Math.round(mdRaw * 10) / 10;
                            const isEditing = editingCell?.resourceId === Number(alloc.resourceId) && editingCell?.projectId === Number(alloc.projectId) && editingCell?.year === w.year && editingCell?.week === w.week;
                            return (
                              <td 
                                key={`${w.year}-${w.week}`} 
                                onClick={() => !isEditing && handleCellClick(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week, formattedMd)}
                                className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${formattedMd > 0 ? 'text-gray-900 bg-blue-50/30' : 'text-gray-200 bg-white'} hover:bg-blue-100 cursor-text transition-colors`}
                              >
                                {isEditing ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    className={`w-12 text-center text-sm font-bold bg-white border border-bg-blue-500 rounded outline-none shadow-sm`}
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleCellBlurOrEnter(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                    onKeyDown={e => handleKeyDown(e, Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                  />
                                ) : (
                                  formattedMd > 0 ? formattedMd : '-'
                                )}
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
                      const percStr = percs.length === 1 ? `${percs[0]}%` : t('dashboard.mixedRatio');
                    const isLocked = group.some(a => a.isLocked);                      
                      return (
                        <tr key={`${p.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors">
                            {idx === 0 && <div className="font-black text-indigo-700 leading-tight">{p.name}</div>}
                          </td>
                          <td className="p-4 sticky left-[150px] z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => handleToggleLock(Number(alloc.resourceId), Number(alloc.projectId), isLocked)}
                                className={`p-1 rounded hover:bg-gray-100 transition-colors ${isLocked ? 'text-red-500' : 'text-gray-300'}`}
                                title={isLocked ? '解锁该排期行' : '锁定该排期行，防止AI覆盖'}
                              >
                                {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                              </button>
                              <select 
                                className="font-bold text-gray-900 bg-transparent outline-none cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1 appearance-none"
                                value={resource?.id || ''}
                                onChange={(e) => handleSwapResource(Number(resource?.id), Number(e.target.value), Number(alloc.projectId))}
                              >
                                <option value="" disabled>{t('dashboard.unknownResource')}</option>
                                {resources.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div>
                          </td>
                          <td className="p-4 text-center bg-white group-hover:bg-indigo-50/30 transition-colors">
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span>
                          </td>
                          {displayWeeks.map(w => {
                            const mdRaw = group.reduce((sum, a) => sum + calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet), 0);
                            const formattedMd = Math.round(mdRaw * 10) / 10;
                            const isEditing = editingCell?.resourceId === Number(alloc.resourceId) && editingCell?.projectId === Number(alloc.projectId) && editingCell?.year === w.year && editingCell?.week === w.week;
                            return (
                              <td 
                                key={`${w.year}-${w.week}`} 
                                onClick={() => !isEditing && handleCellClick(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week, formattedMd)}
                                className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${formattedMd > 0 ? 'text-gray-900 bg-indigo-50/30' : 'text-gray-200 bg-white'} hover:bg-indigo-100 cursor-text transition-colors`}
                              >
                                {isEditing ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    className={`w-12 text-center text-sm font-bold bg-white border border-bg-indigo-500 rounded outline-none shadow-sm`}
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleCellBlurOrEnter(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                    onKeyDown={e => handleKeyDown(e, Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                  />
                                ) : (
                                  formattedMd > 0 ? formattedMd : '-'
                                )}
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
                      const percStr = percs.length === 1 ? `${percs[0]}%` : t('dashboard.mixedRatio');
                    const isLocked = group.some(a => a.isLocked);                      
                      return (
                        <tr key={`${op.id}_${alloc.resourceId}`} className={`border-b border-gray-100 hover:bg-indigo-50/30 transition-colors ${idx === 0 ? 'border-t-2 border-t-gray-100' : ''}`}>
                          <td className="p-4 sticky left-0 z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors">
                            {idx === 0 && <div className="font-black text-indigo-700 leading-tight">{t('dashboard.opPrefix')}{op.productName}</div>}
                          </td>
                          <td className="p-4 sticky left-[150px] z-10 bg-white border-r border-gray-100 group-hover:bg-indigo-50/30 transition-colors shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="flex items-center space-x-1">
                              <button 
                                onClick={() => handleToggleLock(Number(alloc.resourceId), Number(alloc.projectId), isLocked)}
                                className={`p-1 rounded hover:bg-gray-100 transition-colors ${isLocked ? 'text-red-500' : 'text-gray-300'}`}
                                title={isLocked ? '解锁该排期行' : '锁定该排期行，防止AI覆盖'}
                              >
                                {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                              </button>
                              <select 
                                className="font-bold text-gray-900 bg-transparent outline-none cursor-pointer hover:bg-gray-50 rounded px-1 -ml-1 appearance-none"
                                value={resource?.id || ''}
                                onChange={(e) => handleSwapResource(Number(resource?.id), Number(e.target.value), Number(alloc.projectId))}
                              >
                                <option value="" disabled>{t('dashboard.unknownResource')}</option>
                                {resources.map(r => (
                                  <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase">{resource?.role}</div>
                          </td>
                          <td className="p-4 text-center bg-white group-hover:bg-indigo-50/30 transition-colors">
                            <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded-md text-[9px] font-black border border-green-100">{percStr}</span>
                          </td>
                          {displayWeeks.map(w => {
                            const mdRaw = group.reduce((sum, a) => sum + calculateWeeklyMD(a.startDate, a.endDate, a.allocationPercentage, w.year, w.week, workingDaySet), 0);
                            const formattedMd = Math.round(mdRaw * 10) / 10;
                            const isEditing = editingCell?.resourceId === Number(alloc.resourceId) && editingCell?.projectId === Number(alloc.projectId) && editingCell?.year === w.year && editingCell?.week === w.week;
                            return (
                              <td 
                                key={`${w.year}-${w.week}`} 
                                onClick={() => !isEditing && handleCellClick(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week, formattedMd)}
                                className={`p-4 text-center font-mono font-black border-l border-gray-50/50 ${formattedMd > 0 ? 'text-gray-900 bg-indigo-50/30' : 'text-gray-200 bg-white'} hover:bg-indigo-100 cursor-text transition-colors`}
                              >
                                {isEditing ? (
                                  <input
                                    type="number"
                                    autoFocus
                                    className={`w-12 text-center text-sm font-bold bg-white border border-bg-indigo-500 rounded outline-none shadow-sm`}
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={() => handleCellBlurOrEnter(Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                    onKeyDown={e => handleKeyDown(e, Number(alloc.resourceId), Number(alloc.projectId), w.year, w.week)}
                                  />
                                ) : (
                                  formattedMd > 0 ? formattedMd : '-'
                                )}
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
      
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[400px] overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">新增排期</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">选择人员</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={addForm.resourceId}
                  onChange={e => setAddForm({...addForm, resourceId: e.target.value})}
                >
                  <option value="">-- 请选择人员 --</option>
                  {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">选择项目</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={addForm.projectId}
                  onChange={e => setAddForm({...addForm, projectId: e.target.value})}
                >
                  <option value="">-- 请选择项目或日常 --</option>
                  <optgroup label="项目">
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </optgroup>
                  <optgroup label="日常运维">
                    {operations.map(o => <option key={o.id} value={-(Number(o.id) + 1000000)}>{t('dashboard.opPrefix')}{o.productName}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">选择目标周</label>
                <select 
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={`${addForm.year}-${addForm.week}`}
                  onChange={e => {
                    if (!e.target.value) return;
                    const [y, w] = e.target.value.split('-');
                    setAddForm({...addForm, year: y, week: w});
                  }}
                >
                  <option value="-">-- 请选择周 --</option>
                  {displayWeeks.map(w => (
                    <option key={`${w.year}-${w.week}`} value={`${w.year}-${w.week}`}>
                      {w.year}年 第{w.week}周
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">投入人天 (MD)</label>
                <input 
                  type="number"
                  required
                  step="0.1"
                  min="0.1"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={addForm.md}
                  onChange={e => setAddForm({...addForm, md: e.target.value})}
                  placeholder="例如: 3.5"
                />
              </div>
              <div className="pt-2 flex justify-end">
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-colors">
                  保存排期
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
