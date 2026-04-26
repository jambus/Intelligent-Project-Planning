import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Trash2, Edit2, UserPlus, Save, X, Users } from 'lucide-react';
import { addResource, deleteResource, updateResource } from '../../db/services';

export const Resources = () => {
  const resources = useLiveQuery(() => db.resources.toArray());
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({ 
    name: '', 
    role: '前端工程师', 
    capacity: 100, 
    skills: '' 
  });

  const roles = [
    '前端工程师',
    '后端工程师',
    '全栈工程师',
    'APP工程师',
    '测试工程师'
  ];

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ name: '', role: '前端工程师', capacity: 100, skills: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (r: any) => {
    setEditingId(r.id);
    setFormData({ 
      name: r.name, 
      role: r.role, 
      capacity: r.capacity, 
      skills: r.skills.join(', ') 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      role: formData.role,
      capacity: Number(formData.capacity),
      skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean)
    };

    if (editingId) {
      await updateResource(editingId, data);
    } else {
      await addResource(data);
    }
    
    setShowModal(false);
  };

  const handleDelete = async (id?: number) => {
    if (id && window.confirm('确认删除此资源吗？')) {
      await deleteResource(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">团队人员管理</h2>
          <p className="text-gray-500 mt-1">维护团队角色与技能图谱，支持实时数据修正</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 text-sm font-bold transition-all transform hover:-translate-y-0.5 active:scale-95"
        >
          <UserPlus size={18} />
          <span>添加新成员</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-200 text-gray-400 text-[10px] font-black uppercase tracking-widest">
              <th className="p-4">团队成员</th>
              <th className="p-4">专业角色</th>
              <th className="p-4 text-center">当前负荷</th>
              <th className="p-4">技能标签</th>
              <th className="p-4 text-right">操作管理</th>
            </tr>
          </thead>
          <tbody>
            {resources?.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-16 text-center">
                  <div className="flex flex-col items-center space-y-3">
                    <div className="p-4 bg-gray-50 rounded-full"><Users size={32} className="text-gray-200" /></div>
                    <p className="text-gray-400 text-sm font-medium">暂无人员数据，请点击上方按钮录入团队成员。</p>
                  </div>
                </td>
              </tr>
            ) : null}
            {resources?.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-blue-50/10 transition-colors group">
                <td className="p-4">
                  <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{r.name}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black border uppercase ${
                    r.role === '测试工程师' 
                      ? 'bg-teal-50 text-teal-700 border-teal-100' 
                      : r.role === '全栈工程师'
                      ? 'bg-purple-50 text-purple-700 border-purple-100'
                      : 'bg-blue-50 text-blue-700 border-blue-100'
                  }`}>
                    {r.role}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex flex-col items-center space-y-1">
                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{width: `${r.capacity}%`}}></div>
                    </div>
                    <span className="text-[10px] text-gray-500 font-bold font-mono">{r.capacity}%</span>
                  </div>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-1.5 max-w-[300px]">
                    {r.skills.length > 0 ? r.skills.map(s => (
                      <span key={s} className="px-2 py-0.5 bg-white text-gray-600 text-[10px] rounded-md border border-gray-200 font-bold shadow-sm">
                        {s}
                      </span>
                    )) : <span className="text-gray-300 text-xs">-</span>}
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenEdit(r)} 
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="编辑人员信息"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(r.id)} 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="删除该成员"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unified Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[480px] transform animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-black text-gray-900">
                {editingId ? '修正成员信息' : '新增团队成员'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">成员姓名</label>
                <input 
                  required 
                  placeholder="例如：张三"
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">专业角色</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setFormData({...formData, role})}
                      className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-all ${
                        formData.role === role 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100' 
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">可用负荷: {formData.capacity}%</label>
                <input 
                  type="range" 
                  min="1" 
                  max="100" 
                  step="5"
                  value={formData.capacity} 
                  onChange={e => setFormData({...formData, capacity: Number(e.target.value)})}
                  className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">核心技能 (逗号分隔)</label>
                <textarea 
                  placeholder="React, Vue, Node.js..." 
                  rows={3}
                  value={formData.skills} 
                  onChange={e => setFormData({...formData, skills: e.target.value})} 
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-medium resize-none" 
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button 
                  type="submit" 
                  className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl shadow-xl shadow-blue-100 font-bold transition-all active:scale-95"
                >
                  <Save size={18} />
                  <span>{editingId ? '更新信息' : '确认添加'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
