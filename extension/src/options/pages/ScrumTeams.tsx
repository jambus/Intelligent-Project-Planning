import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Plus, Users2, X, Save, Trash2, Edit2, UserPlus, UserMinus } from 'lucide-react';

export const ScrumTeams = () => {
  const scrumTeams = useLiveQuery(() => db.scrumTeams.toArray());
  const allResources = useLiveQuery(() => db.resources.toArray());
  
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  
  const [showMemberModal, setShowMemberModal] = useState(false);

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    
    if (editingTeamId) {
      await db.scrumTeams.update(editingTeamId, { name: teamName.trim(), description: teamDescription.trim() });
    } else {
      const id = await db.scrumTeams.add({ name: teamName.trim(), description: teamDescription.trim() });
      setSelectedTeamId(id as number);
    }
    
    setShowTeamModal(false);
    setTeamName('');
    setTeamDescription('');
    setEditingTeamId(null);
  };

  const handleDeleteTeam = async (id: number) => {
    if (window.confirm('确认删除该 Scrum 团队吗？团队中的成员归属将被清空，但人员本身不会被删除。')) {
      // Clear scrumTeamId from resources
      const teamResources = allResources?.filter(r => r.scrumTeamId === id) || [];
      for (const r of teamResources) {
        await db.resources.update(r.id!, { scrumTeamId: undefined });
      }

      // Clear scrumTeamId from projects and reset teamSchedulingMode
      const teamProjects = await db.projects.filter(p => p.scrumTeamId === id).toArray();
      for (const p of teamProjects) {
        await db.projects.update(p.id!, { scrumTeamId: undefined, teamSchedulingMode: 'all-in' });
      }

      await db.scrumTeams.delete(id);
      if (selectedTeamId === id) {
        setSelectedTeamId(null);
      }
    }
  };

  const openEditTeam = (team: any) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setTeamDescription(team.description || '');
    setShowTeamModal(true);
  };

  const openCreateTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setTeamDescription('');
    setShowTeamModal(true);
  };

  const handleAddMember = async (resourceId: number) => {
    if (selectedTeamId) {
      await db.resources.update(resourceId, { scrumTeamId: selectedTeamId });
    }
  };

  const handleRemoveMember = async (resourceId: number) => {
    if (window.confirm('确认将该成员移出团队吗？')) {
      await db.resources.update(resourceId, { scrumTeamId: undefined });
    }
  };

  const selectedTeam = scrumTeams?.find(t => t.id === selectedTeamId);
  const teamMembers = allResources?.filter(r => r.scrumTeamId === selectedTeamId) || [];
  
  // Resources that don't belong to the CURRENT selected team
  const availableResources = allResources?.filter(r => r.scrumTeamId !== selectedTeamId) || [];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Scrum 团队管理</h2>
          <p className="text-gray-500 mt-1">创建和维护 Scrum 团队，并分配开发与测试人员</p>
        </div>

        <button 
          onClick={openCreateTeam}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 text-sm font-bold transition-all transform hover:-translate-y-0.5"
        >
          <Plus size={18} />
          <span>创建团队</span>
        </button>
      </div>

      <div className="flex gap-8">
        {/* Left Panel: Team List */}
        <div className="w-1/3 flex flex-col space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex items-center space-x-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Users2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">团队列表</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">All Scrum Teams</p>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {scrumTeams?.length === 0 && <p className="text-gray-400 text-sm italic text-center py-8">暂无 Scrum 团队</p>}
              {scrumTeams?.map(team => (
                <div 
                  key={team.id}
                  onClick={() => setSelectedTeamId(team.id!)}
                  className={`group relative p-4 rounded-xl cursor-pointer border-2 transition-all ${
                    selectedTeamId === team.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-transparent bg-gray-50 hover:bg-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`font-bold ${selectedTeamId === team.id ? 'text-blue-900' : 'text-gray-900'}`}>{team.name}</h4>
                      {team.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{team.description}</p>}
                    </div>
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEditTeam(team); }}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="编辑团队"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDeleteTeam(team.id!); }}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="删除团队"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Panel: Team Details & Members */}
        <div className="w-2/3">
          {selectedTeam ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-[600px]">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedTeam.name} 成员</h3>
                  <p className="text-sm text-gray-500 mt-1">共 {teamMembers.length} 名成员</p>
                </div>
                <button
                  onClick={() => setShowMemberModal(true)}
                  className="flex items-center space-x-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl font-bold text-sm transition-colors"
                >
                  <UserPlus size={16} />
                  <span>添加成员</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-0">
                {teamMembers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Users2 size={48} className="mb-4 text-gray-200" />
                    <p>当前团队暂无成员</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-500 uppercase tracking-wider text-[10px] font-bold">
                        <th className="p-4 w-1/4">姓名</th>
                        <th className="p-4 w-1/4">角色</th>
                        <th className="p-4 w-1/4">技能</th>
                        <th className="p-4 w-1/4 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map(m => (
                        <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50/30">
                          <td className="p-4 font-bold text-gray-900">{m.name}</td>
                          <td className="p-4">
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-bold">{m.role}</span>
                          </td>
                          <td className="p-4 text-xs text-gray-500 truncate max-w-[150px]">
                            {m.skills?.length > 0 ? m.skills.join(', ') : '-'}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => handleRemoveMember(m.id!)}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="移出团队"
                            >
                              <UserMinus size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 border-dashed h-[600px] flex flex-col items-center justify-center text-gray-400">
              <Users2 size={64} className="mb-4 text-gray-200" />
              <h3 className="text-lg font-bold text-gray-500">未选择团队</h3>
              <p className="text-sm mt-2">请在左侧选择一个 Scrum 团队，或创建一个新团队</p>
            </div>
          )}
        </div>
      </div>

      {/* Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-[400px] transform animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-gray-900">{editingTeamId ? '编辑团队' : '创建团队'}</h3>
              <button onClick={() => setShowTeamModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">团队名称</label>
                <input 
                  required 
                  autoFocus
                  placeholder="如: Alpha Team"
                  value={teamName} 
                  onChange={e => setTeamName(e.target.value)} 
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">描述 (可选)</label>
                <textarea 
                  placeholder="团队简述..."
                  value={teamDescription} 
                  onChange={e => setTeamDescription(e.target.value)} 
                  className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium resize-none h-24" 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-2xl shadow-xl shadow-blue-100 font-bold transition-all active:scale-95"
                >
                  <Save size={18} />
                  <span>保存团队</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-3xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col transform animate-in zoom-in-95 duration-200 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-gray-900">向 {selectedTeam?.name} 添加成员</h3>
              <button onClick={() => setShowMemberModal(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">点击列表中的人员即可将其分配到本团队。如果人员已在其他团队，将被转移至本团队。</p>

            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl">
              {availableResources.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">
                  没有可添加的成员
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 sticky top-0 shadow-sm">
                    <tr className="text-gray-500 font-bold text-xs">
                      <th className="p-3">姓名</th>
                      <th className="p-3">角色</th>
                      <th className="p-3">当前归属</th>
                      <th className="p-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableResources.map(r => {
                      const currentTeam = scrumTeams?.find(t => t.id === r.scrumTeamId);
                      return (
                        <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-bold text-gray-900">{r.name}</td>
                          <td className="p-3 text-gray-600 text-xs">{r.role}</td>
                          <td className="p-3">
                            {currentTeam ? (
                              <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded font-medium">
                                {currentTeam.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleAddMember(r.id!)}
                              className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg font-bold text-xs transition-colors"
                            >
                              添加
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
