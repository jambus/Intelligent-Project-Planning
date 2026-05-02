import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Plus, Briefcase, Cpu, X, Save, Upload, Download, FileDown, CheckCircle2 } from 'lucide-react';
import { importSkillsFromFile } from '../../services/fileImport';

export const Skills = () => {
  const skills = useLiveQuery(() => db.skills.toArray());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillType, setNewSkillType] = useState<'business' | 'technical'>('business');
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  // Initial data seeding
  useEffect(() => {
    const seedSkills = async () => {
      const count = await db.skills.count();
      if (count === 0) {
        const businessSkills = [
          'Order', 'Stock', 'Fulfillment', 'Finance', 'Transaction', 
          'Checkout & Payment', 'POS', 'Product Offer', 'In-Store Ops'
        ].map(name => ({ name, type: 'business' as const }));

        const technicalSkills = [
          'AI Coding', 'Automation Test', 'AI Agent/MCP/Skills', 'Big Data', 'Data Quality', 'App'
        ].map(name => ({ name, type: 'technical' as const }));

        await db.skills.bulkAdd([...businessSkills, ...technicalSkills]);
      }
    };
    seedSkills();
  }, []);

  const handleAddSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    
    await db.skills.add({
      name: newSkillName.trim(),
      type: newSkillType
    });
    
    setNewSkillName('');
    setShowModal(false);
  };

  const handleDeleteSkill = async (id?: number) => {
    if (id && window.confirm('确认删除该技能标签吗？')) {
      await db.skills.delete(id);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const count = await importSkillsFromFile(file);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
      console.log(`Successfully imported ${count} unique skills.`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('导入失败，请检查文件格式。');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const downloadTemplate = () => {
    const link = document.createElement('a');
    link.href = '/sample_skills.csv';
    link.download = 'sample_skills.csv';
    link.click();
  };

  const exportToCSV = () => {
    if (!skills || skills.length === 0) return;
    
    const headers = ['Name', 'Type'];
    const csvContent = [
      headers.join(','),
      ...skills.map(s => [
        `"${s.name}"`,
        `"${s.type}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `skills_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const businessSkills = skills?.filter(s => s.type === 'business') || [];
  const technicalSkills = skills?.filter(s => s.type === 'technical') || [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">人员技能管理</h2>
          <p className="text-gray-500 mt-1">管理团队的业务领域知识与技术栈能力标签</p>
        </div>

        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden" 
            accept=".csv,.xlsx"
          />

          <button 
            onClick={downloadTemplate}
            className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm text-xs font-bold transition-all"
            title="下载导入模板"
          >
            <FileDown size={16} />
            <span>模板下载</span>
          </button>

          <button 
            onClick={exportToCSV}
            disabled={!skills || skills.length === 0}
            className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm text-xs font-bold transition-all disabled:opacity-50"
            title="导出当前标签"
          >
            <Download size={16} />
            <span>标签导出</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              importSuccess 
                ? 'bg-green-50 border-green-200 text-green-600' 
                : 'bg-white hover:bg-gray-50 text-blue-600 border-blue-200 shadow-sm'
            }`}
          >
            {importSuccess ? <CheckCircle2 size={16} /> : <Upload size={16} />}
            <span>{isImporting ? '导入中...' : importSuccess ? '导入成功' : '批量导入'}</span>
          </button>

          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 text-sm font-bold transition-all transform hover:-translate-y-0.5 ml-2"
          >
            <Plus size={18} />
            <span>新增技能</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Business Domain Skills */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center space-x-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
              <Briefcase size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">业务领域能力</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Business Domain Expertise</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {businessSkills.length === 0 && <p className="text-gray-400 text-sm italic">暂无业务技能标签</p>}
              {businessSkills.map(skill => (
                <div 
                  key={skill.id} 
                  className="group flex items-center space-x-2 px-3 py-1.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-lg text-sm font-medium hover:bg-orange-100 transition-all"
                >
                  <span>{skill.name}</span>
                  <button 
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-orange-200 rounded transition-opacity text-orange-400 hover:text-orange-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technical Skills */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <Cpu size={20} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">技术领域能力</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Technical Stack & Skills</p>
            </div>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-2">
              {technicalSkills.length === 0 && <p className="text-gray-400 text-sm italic">暂无技术技能标签</p>}
              {technicalSkills.map(skill => (
                <div 
                  key={skill.id} 
                  className="group flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-sm font-medium hover:bg-blue-100 transition-all"
                >
                  <span>{skill.name}</span>
                  <button 
                    onClick={() => handleDeleteSkill(skill.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-blue-200 rounded transition-opacity text-blue-400 hover:text-blue-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Skill Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[400px] transform animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900">新增技能标签</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSkill} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">技能名称</label>
                <input 
                  required 
                  autoFocus
                  placeholder="请输入技能名称..."
                  value={newSkillName} 
                  onChange={e => setNewSkillName(e.target.value)} 
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">所属类别</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewSkillType('business')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                      newSkillType === 'business' 
                        ? 'border-orange-500 bg-orange-50 text-orange-700 shadow-md' 
                        : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <Briefcase size={16} />
                    <span>业务领域</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewSkillType('technical')}
                    className={`flex items-center justify-center space-x-2 px-4 py-3 rounded-xl border-2 transition-all font-bold text-sm ${
                      newSkillType === 'technical' 
                        ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md' 
                        : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-gray-200'
                    }`}
                  >
                    <Cpu size={16} />
                    <span>技术技能</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl shadow-xl shadow-blue-100 font-bold transition-all active:scale-95"
                >
                  <Save size={18} />
                  <span>保存技能</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
