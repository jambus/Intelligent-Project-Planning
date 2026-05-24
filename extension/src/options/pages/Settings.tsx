import { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { Save, RotateCcw } from 'lucide-react';
import { DEFAULT_SCHEDULING_PROMPT, DEFAULT_STRATEGY_FOCUSED, DEFAULT_STRATEGY_BALANCED, DEFAULT_STRATEGY_URGENT } from '../../services/ai';

export const Settings = () => {
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraProjects, setJiraProjects] = useState('');
  const [jiraHoursPerDay, setJiraHoursPerDay] = useState(6);
  const [jiraTestIssueTypes, setJiraTestIssueTypes] = useState('Test,QA,Bug,Defect,测试,缺陷');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBatchSize, setAiBatchSize] = useState(3);
  const [aiPromptTemplate, setAiPromptTemplate] = useState('');
  const [strategyFocused, setStrategyFocused] = useState('');
  const [strategyBalanced, setStrategyBalanced] = useState('');
  const [strategyUrgent, setStrategyUrgent] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  useEffect(() => {
    const loadSettings = async () => {
      setJiraDomain(await getStorageItem('jiraDomain') || '');
      setJiraProjects(await getStorageItem('jiraProjects') || '');
      const hours = await getStorageItem('jiraHoursPerDay');
      setJiraHoursPerDay(hours ? Number(hours) : 6);
      setJiraTestIssueTypes(await getStorageItem('jiraTestIssueTypes') || 'Test,QA,Bug,Defect,测试,缺陷');
      setJiraEmail(await getStorageItem('jiraEmail') || '');
      setJiraToken(await getStorageItem('jiraApiToken') || '');
      setOpenAiKey(await getStorageItem('openAiApiKey') || '');
      setAiBaseUrl(await getStorageItem('openAiBaseUrl') || 'https://api.openai.com/v1');
      setAiModel(await getStorageItem('openAiModel') || 'gpt-4o-mini');
      const savedBatchSize = await getStorageItem('aiBatchSize');
      setAiBatchSize(savedBatchSize ? Number(savedBatchSize) : 3);
      setAiPromptTemplate(await getStorageItem('aiPromptTemplate') || DEFAULT_SCHEDULING_PROMPT);
      setStrategyFocused(await getStorageItem('strategyFocused') || DEFAULT_STRATEGY_FOCUSED);
      setStrategyBalanced(await getStorageItem('strategyBalanced') || DEFAULT_STRATEGY_BALANCED);
      setStrategyUrgent(await getStorageItem('strategyUrgent') || DEFAULT_STRATEGY_URGENT);
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setStorageItem('jiraDomain', jiraDomain);
      await setStorageItem('jiraProjects', jiraProjects);
      await setStorageItem('jiraHoursPerDay', jiraHoursPerDay);
      await setStorageItem('jiraTestIssueTypes', jiraTestIssueTypes);
      await setStorageItem('jiraEmail', jiraEmail);
      await setStorageItem('jiraApiToken', jiraToken);
      await setStorageItem('openAiApiKey', openAiKey);
      await setStorageItem('openAiBaseUrl', aiBaseUrl);
      await setStorageItem('openAiModel', aiModel);
      await setStorageItem('aiBatchSize', aiBatchSize);
      await setStorageItem('aiPromptTemplate', aiPromptTemplate);
      await setStorageItem('strategyFocused', strategyFocused);
      await setStorageItem('strategyBalanced', strategyBalanced);
      await setStorageItem('strategyUrgent', strategyUrgent);
      
      setMessage({ type: 'success', text: '设置已保存成功！' });
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败。' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleResetPrompt = () => {
    if (confirm('确定要重置排期策略为默认规则吗？')) {
      setAiPromptTemplate(DEFAULT_SCHEDULING_PROMPT);
      setStrategyFocused(DEFAULT_STRATEGY_FOCUSED);
      setStrategyBalanced(DEFAULT_STRATEGY_BALANCED);
      setStrategyUrgent(DEFAULT_STRATEGY_URGENT);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
          <p className="text-gray-500 mt-1">配置第三方 API 密钥与核心排期策略</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded shadow-sm text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-8">
        
        <form onSubmit={handleSave} className="space-y-8">
          {/* Jira Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Jira 配置 (用于页面悬浮注入)</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jira 域名 (URL)</label>
                <input 
                  type="url" 
                  placeholder="https://your-domain.atlassian.net"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={jiraDomain} onChange={e => setJiraDomain(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">限定抓取的项目范围 (Jira Projects)</label>
                <input 
                  type="text" 
                  placeholder="例如: APP, WEB (多个以逗号分隔)"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={jiraProjects} onChange={e => setJiraProjects(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">配置后，拉取 Epic 工时会在底层加上 `project in (...)` 条件，提升查询速度并避免跨项目冲突。留空则全局搜索。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">每日工时换算标准 (Hours per Man-Day)</label>
                <input 
                  type="number" 
                  min="1"
                  max="24"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={jiraHoursPerDay} onChange={e => setJiraHoursPerDay(Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">从 Jira 拉取的 `timespent` (秒) 会除以该数值换算为人天 (MD)，默认 6 小时 = 1 MD。</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">测试 Issue Type 标识 (Test Issue Types)</label>
                <input 
                  type="text" 
                  placeholder="例如: Test,QA,Bug,Defect,测试,缺陷"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={jiraTestIssueTypes} onChange={e => setJiraTestIssueTypes(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">同步 Epic 工时时，若子任务的类型命中这些关键字（不区分大小写），则该工时计入「已消费测试」，否则默认计入「已消费开发」。多个关键字以逗号分隔。</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jira 邮箱</label>
                  <input 
                    type="email" 
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={jiraEmail} onChange={e => setJiraEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Token</label>
                  <input 
                    type="password" 
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={jiraToken} onChange={e => setJiraToken(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* AI Configuration Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">AI 排期引擎网络配置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Base URL</label>
                <input 
                  type="url" 
                  placeholder="https://api.openai.com/v1"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">支持 DeepSeek, Qwen, Claude 等兼容 OpenAI 协议的接口。</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                  <input 
                    type="password" 
                    placeholder="sk-..."
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={openAiKey} onChange={e => setOpenAiKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">模型名称 (Model Name)</label>
                  <input 
                    type="text" 
                    placeholder="gpt-4o-mini"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    value={aiModel} onChange={e => setAiModel(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">单次排期项目并发量 (Batch Size)</label>
                <input 
                  type="number" 
                  min="1"
                  max="20"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={aiBatchSize} onChange={e => setAiBatchSize(Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">发给大模型的单批次项目数量。数量较少时排期精度更高，但耗时更长。如果希望一次性发给大模型全局调度，可将此值调大（例如 10）。默认 3。</p>
              </div>
            </div>
          </div>

          {/* AI Strategy Prompt Section */}
          <div>
            <div className="flex justify-between items-end border-b pb-2 mb-4">
              <h3 className="text-lg font-medium text-gray-900">AI 智能排期策略规则</h3>
              <button 
                type="button" 
                onClick={handleResetPrompt}
                className="text-sm flex items-center space-x-1 text-gray-500 hover:text-blue-600 transition-colors"
              >
                <RotateCcw size={14} />
                <span>恢复默认规则</span>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">单人模式 (专注模式)</label>
                <textarea 
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-xs text-gray-700 leading-relaxed bg-gray-50"
                  value={strategyFocused}
                  onChange={e => setStrategyFocused(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">均衡模式</label>
                <textarea 
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-xs text-gray-700 leading-relaxed bg-gray-50"
                  value={strategyBalanced}
                  onChange={e => setStrategyBalanced(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">进阶模式 (紧急模式)</label>
                <textarea 
                  rows={2}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-xs text-gray-700 leading-relaxed bg-gray-50"
                  value={strategyUrgent}
                  onChange={e => setStrategyUrgent(e.target.value)}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2 leading-relaxed font-bold">系统主提示词模板 (Prompt Template)</p>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                  您可以自由编辑下方的 Prompt 模板来改变 AI 的排期决策准则。
                  请保留 <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{"{{phase}}"}</code>、<code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{"{{strategyFocused}}"}</code>、<code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{"{{strategyBalanced}}"}</code> 和 <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{"{{strategyUrgent}}"}</code> 等核心占位符。
                </p>
                <textarea 
                  rows={15}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-xs text-gray-700 leading-relaxed bg-gray-50"
                value={aiPromptTemplate}
                onChange={e => setAiPromptTemplate(e.target.value)}
              />
            </div>
          </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end border-t border-gray-100 sticky bottom-0 bg-white">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              <Save size={18} />
              <span>保存所有设置</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
