
import { useDashboard } from '../../../context/DashboardContext';
import { useScheduling } from '../../../context/SchedulingContext';
import { useNavigate } from 'react-router-dom';
import { 
  Users, ArrowRight, ClipboardList, AlertTriangle, Search, TriangleAlert, 
  RefreshCcw, CheckCircle2, Zap, X, Play, ChevronDown, ChevronRight
} from 'lucide-react';

export const DashboardOverview = () => {
  const navigate = useNavigate();
  const { 
    selectedYear, setSelectedYear,
    startMonth, setStartMonth,
    endMonth, setEndMonth,
    readyProjects, pendingProjects, projectGaps, resourceIdle, teamCapacities,
    resources
  } = useDashboard();
  
  const { 
    isScheduling, scheduleStatus, currentStep, error, 
    handleGenerateSchedule, stopScheduling, clearError 
  } = useScheduling();

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const yearOptions = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);



  return (
    <div className="space-y-6 pb-20">
      {/* Top Control Bar */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">全局概览</h2>
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
                disabled={isScheduling || !readyProjects.length || !resources.length}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                  isScheduling || !readyProjects.length || !resources.length
                    ? 'bg-blue-100 text-blue-400 cursor-not-allowed shadow-none' 
                    : 'bg-white text-blue-600 border border-blue-100 hover:bg-blue-50 shadow-blue-50'
                }`}
              >
                <Play size={16} />
                <span>继续排期</span>
              </button>
              <button 
                onClick={() => handleGenerateSchedule(selectedYear, startMonth, endMonth, true)}
                disabled={isScheduling || !readyProjects.length || !resources.length}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                  isScheduling || !readyProjects.length || !resources.length
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

      {/* Error Modal */}
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

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">待排期项目</span>
            <ClipboardList size={16} className="text-blue-500" />
          </div>
          <p className="text-2xl font-black text-gray-900">{readyProjects.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:border-orange-300 transition-colors" onClick={() => navigate('/project-results')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">待评估项目</span>
            <Search size={16} className="text-orange-400" />
          </div>
          <p className="text-2xl font-black text-gray-900">{pendingProjects.length}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-sm border transition-colors cursor-pointer ${projectGaps.length ? 'bg-orange-50 border-orange-200 hover:border-orange-400' : 'bg-white border-gray-100 hover:border-gray-300'}`} onClick={() => navigate('/project-results')}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${projectGaps.length ? 'text-orange-500' : 'text-gray-400'}`}>需求缺口项目</span>
            <AlertTriangle size={16} className={projectGaps.length ? 'text-orange-500' : 'text-gray-300'} />
          </div>
          <p className={`text-2xl font-black ${projectGaps.length ? 'text-orange-600' : 'text-gray-900'}`}>{projectGaps.length}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-sm border transition-colors cursor-pointer ${resourceIdle.length ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-400' : 'bg-white border-gray-100 hover:border-gray-300'}`} onClick={() => navigate('/team-capacity')}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-black uppercase tracking-widest ${resourceIdle.length ? 'text-indigo-500' : 'text-gray-400'}`}>未满载人员</span>
            <Users size={16} className={resourceIdle.length ? 'text-indigo-500' : 'text-gray-300'} />
          </div>
          <p className={`text-2xl font-black ${resourceIdle.length ? 'text-indigo-600' : 'text-gray-900'}`}>{resourceIdle.length}</p>
        </div>
      </div>

      {/* Scrum Team Capacities Box */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mt-8">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Users size={16} className="text-gray-600" />
            <h3 className="font-bold text-gray-900 text-sm">Scrum 团队容量 (当前选定时段)</h3>
          </div>
          <button 
            onClick={() => navigate('/team-capacity')} 
            className="flex items-center space-x-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>查看完整容量大盘</span>
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-widest bg-gray-50/50">
                <th className="p-4">Scrum 团队</th>
                <th className="p-4 text-center">成员数</th>
                <th className="p-4 text-center">总容量</th>
                <th className="p-4 text-center">已用容量</th>
                <th className="p-4 text-center">剩余总容量</th>
                <th className="p-4 text-center text-blue-600">开发剩余</th>
                <th className="p-4 text-center text-teal-600">测试剩余</th>
                <th className="p-4 text-center">饱和度</th>
              </tr>
            </thead>
            <tbody>
              {teamCapacities.map(team => (
                <tr key={team.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-bold text-gray-900">{team.name}</td>
                  <td className="p-4 text-center text-gray-600">{team.memberCount}</td>
                  <td className="p-4 text-center text-gray-600 font-mono">{Math.round(team.totalCapacityMd)}d</td>
                  <td className="p-4 text-center text-gray-600 font-mono">{Math.round(team.allocatedMd)}d</td>
                  <td className="p-4 text-center font-bold text-gray-900 font-mono">{Math.round(team.idleMd)}d</td>
                  <td className="p-4 text-center font-bold text-blue-600 font-mono">{Math.round(team.devIdleMd)}d</td>
                  <td className="p-4 text-center font-bold text-teal-600 font-mono">{Math.round(team.testIdleMd)}d</td>
                  <td className="p-4 text-center w-1/4">
                    <div className="flex items-center justify-center space-x-3">
                      <div className="w-full max-w-[120px] bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${team.utilization > 90 ? 'bg-red-400' : team.utilization > 70 ? 'bg-orange-400' : 'bg-green-400'}`} 
                          style={{ width: `${Math.min(100, team.utilization)}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] font-bold text-gray-700 w-8">{team.utilization.toFixed(0)}%</span>
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
    </div>
  );
};
