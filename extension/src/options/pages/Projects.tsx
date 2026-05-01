import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { FolderKanban, Info, UploadCloud, Download } from 'lucide-react';
import { importProjectsFromFile } from '../../services/fileImport';

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
  'P3': 1,
  'Must Win': 5,
  'Compliance': 4
};

const getPriorityWeight = (p: string) => {
  return priorityWeight[p] || 0;
};

export const Projects = () => {
  // Use projects directly as they are stored in the order of insertion (ID)
  const projects = useLiveQuery(() => db.projects.toArray());
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // We no longer manually sort here because the physical order in CSV is the source of truth.
  // The database IDs (auto-increment) preserve the import order.
  const displayProjects = projects;

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const count = await importProjectsFromFile(file);
      setMessage({ type: 'success', text: `成功导入 ${count} 个排期项目！` });
    } catch (err: any) {
      setMessage({ type: 'error', text: `导入失败: ${err.message}` });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ''; // reset input
      }
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">项目管理</h2>
          <p className="text-gray-500 mt-1">查看待排期的项目详情（按 CSV 导入顺序执行严格优先级排期）</p>
        </div>
        <div className="flex flex-col items-end space-y-2">
          <div className="flex items-center space-x-3">
            <a
              href="/sample_projects.csv"
              download="irp_sample_projects.csv"
              className="flex items-center space-x-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors shadow-sm"
              title="下载带有标准表头的模板文件"
            >
              <Download size={18} />
              <span>下载模板 (CSV)</span>
            </a>
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileImport}
              disabled={isImporting}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="flex items-center space-x-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              <UploadCloud size={18} />
              <span>{isImporting ? '正在导入...' : '导入项目 (CSV/Excel)'}</span>
            </button>
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium border border-blue-100">
              <FolderKanban size={18} />
              <span>共计 {projects?.length || 0} 个项目</span>
            </div>
          </div>
          {message && (
            <div className={`px-3 py-1 rounded text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200 ${
              message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold w-16">顺序</th>
                <th className="p-4 font-semibold min-w-[200px]">项目名称 / Epic</th>
                <th className="p-4 font-semibold">优先级</th>
                <th className="p-4 font-semibold">负责人 (DR/Tech/QA)</th>
                <th className="p-4 font-semibold">业务方</th>
                <th className="p-4 font-semibold">状态</th>
                <th className="p-4 font-semibold text-center">开发人天</th>
                <th className="p-4 font-semibold text-center">测试人天</th>
                <th className="p-4 font-semibold">上线时间 / 周期</th>
              </tr>
            </thead>
            <tbody>
              {(!displayProjects || displayProjects.length === 0) ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400 space-y-2">
                      <Info size={40} className="opacity-20" />
                      <p>暂无项目数据，请点击上方按钮导入 CSV/Excel 文件。</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {displayProjects?.map((p, index) => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors group">
                  <td className="p-4 text-xs font-mono text-gray-400">#{index + 1}</td>
                  <td className="p-4">
                    <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{p.name}</div>
                    <div className="flex items-center space-x-2 mt-1">
                      {p.jiraEpicKey && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono" title="Jira Epic">{p.jiraEpicKey}</span>}
                      {p.techStack && <span className="text-[10px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium" title="Tech Stack">{p.techStack}</span>}
                      {p.domain && <span className="text-[10px] bg-teal-50 text-teal-500 px-1.5 py-0.5 rounded font-medium" title="Domain">{p.domain}</span>}
                    </div>
                    {p.comments && <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={p.comments}>{p.comments}</div>}
                  </td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      getPriorityWeight(p.priority) >= 4 
                        ? 'bg-red-100 text-red-700' 
                        : getPriorityWeight(p.priority) >= 2 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {p.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col space-y-0.5 text-xs text-gray-600">
                      {p.digitalResponsible && <div><span className="text-gray-400">DR:</span> <span className="font-medium">{p.digitalResponsible}</span></div>}
                      {p.projectTechLead && <div><span className="text-gray-400">Tech:</span> {p.projectTechLead}</div>}
                      {p.projectQualityLead && <div><span className="text-gray-400">QA:</span> {p.projectQualityLead}</div>}
                      {!p.digitalResponsible && !p.projectTechLead && !p.projectQualityLead && <span className="text-gray-300">-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-500">{p.businessOwner || '-'}</td>
                  <td className="p-4 text-sm">
                    <span className="px-2 py-0.5 border border-gray-200 rounded text-gray-500 bg-gray-50 uppercase text-[10px] font-bold">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center" title={p.detailsProductDevMd || 'No details'}>
                      <span className="text-sm font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                        {p.devTotalMd}d
                      </span>
                      {p.detailsProductDevMd && <span className="text-[9px] text-gray-400 mt-1 max-w-[100px] truncate">{p.detailsProductDevMd}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col items-center" title={p.detailsProductTestMd || 'No details'}>
                      <span className="text-sm font-mono font-semibold text-teal-600 bg-teal-50 px-2 py-1 rounded">
                        {p.testTotalMd}d
                      </span>
                      {p.detailsProductTestMd && <span className="text-[9px] text-gray-400 mt-1 max-w-[100px] truncate">{p.detailsProductTestMd}</span>}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-gray-400 whitespace-nowrap">
                    {p.estimatedGoLiveTime && <div className="text-blue-600 font-semibold mb-1">Go-live: {p.estimatedGoLiveTime}</div>}
                    <div className="opacity-70">{p.startDate} ~ {p.endDate}</div>
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
