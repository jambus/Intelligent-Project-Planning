import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { FolderKanban, Info } from 'lucide-react';

const priorityWeight: Record<string, number> = {
  'High': 3,
  'Medium': 2,
  'Low': 1,
  '高': 3,
  '中': 2,
  '低': 1,
  'P0': 4,
  'P1': 3,
  'P2': 2,
  'P3': 1
};

const getPriorityWeight = (p: string) => {
  return priorityWeight[p] || 0;
};

export const Projects = () => {
  const projects = useLiveQuery(() => db.projects.toArray());

  const sortedProjects = projects?.sort((a, b) => {
    return getPriorityWeight(b.priority) - getPriorityWeight(a.priority);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">项目管理</h2>
          <p className="text-gray-500 mt-1">查看待排期的项目详情及其优先级（按优先级从高到低排序）</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium border border-blue-100">
          <FolderKanban size={18} />
          <span>共计 {projects?.length || 0} 个项目</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">项目名称</th>
                <th className="p-4 font-semibold">优先级</th>
                <th className="p-4 font-semibold">负责人</th>
                <th className="p-4 font-semibold">业务方</th>
                <th className="p-4 font-semibold">状态</th>
                <th className="p-4 font-semibold text-center">开发人天</th>
                <th className="p-4 font-semibold text-center">测试人天</th>
                <th className="p-4 font-semibold">起止日期</th>
              </tr>
            </thead>
            <tbody>
              {(!sortedProjects || sortedProjects.length === 0) ? (
                <tr>
                  <td colSpan={8} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 space-y-2">
                      <Info size={40} className="opacity-20" />
                      <p>暂无项目数据，请前往“系统设置”上传文件导入。</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {sortedProjects?.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</div>
                    {p.comments && <div className="text-xs text-gray-400 mt-1 truncate max-w-xs">{p.comments}</div>}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      getPriorityWeight(p.priority) >= 3 
                        ? 'bg-red-100 text-red-700' 
                        : getPriorityWeight(p.priority) === 2 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {p.priority}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-600 font-medium">{p.digitalResponsible || '-'}</td>
                  <td className="p-4 text-sm text-gray-500">{p.businessOwner || '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="px-2 py-0.5 border border-gray-200 rounded text-gray-500 bg-gray-50 uppercase text-[10px] font-bold">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-sm font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {p.devTotalMd}d
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-sm font-mono font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded">
                      {p.testTotalMd}d
                    </span>
                  </td>
                  <td className="p-4 text-xs text-gray-400 whitespace-nowrap">
                    {p.startDate} <br/> {p.endDate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
