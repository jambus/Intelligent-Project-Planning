
import { useDashboard } from '../../../context/DashboardContext';
import { Users } from 'lucide-react';

export const TeamCapacity = () => {
  const { teamCapacities, resourceIdle } = useDashboard();

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">团队容量</h2>
          <p className="text-xs font-bold text-gray-400 mt-1.5">Scrum 团队负载水位线与成员空置状态</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center space-x-2">
          <Users size={16} className="text-gray-600" />
          <h3 className="font-bold text-gray-900 text-sm">Scrum 团队容量 (当前选定时段)</h3>
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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex items-center space-x-2">
          <Users size={16} className="text-indigo-600" />
          <h3 className="font-bold text-indigo-900 text-sm">待补充任务 (人员仍有闲置)</h3>
        </div>
        <div className="p-0">
          {!resourceIdle.length ? (
            <p className="text-gray-400 text-center py-8 text-xs font-medium italic">所有人员均已满载排期</p>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-black uppercase tracking-tighter bg-gray-50/20">
                  <th className="p-4">人员姓名</th>
                  <th className="p-4 text-center">闲置天数</th>
                  <th className="p-4 text-center">饱和度</th>
                  <th className="p-4">空闲可用窗口摘要</th>
                </tr>
              </thead>
              <tbody>
                {resourceIdle.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-gray-900">{r.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase mt-0.5">{r.role}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-mono font-bold text-indigo-600">{Math.round(r.idleMd)}d</span>
                    </td>
                    <td className="p-4 text-center w-1/4">
                      <div className="flex items-center justify-center space-x-3">
                        <div className="w-full max-w-[120px] bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-400 h-full rounded-full" 
                            style={{width: `${Math.min(100, r.utilization)}%`}}
                          ></div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 w-8">{r.utilization.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 font-mono text-[10px] break-words whitespace-pre-wrap">
                      {r.scheduleSummary}
                    </td>
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
