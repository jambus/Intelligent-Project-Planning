import { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { Save, RotateCcw, Globe } from 'lucide-react';
import { DEFAULT_SCORING_PROMPT } from '../../services/ai';
import { useTranslation } from '../../context/I18nContext';

export const Settings = () => {
  const { t, lang, setLang } = useTranslation();
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraProjects, setJiraProjects] = useState('');
  const [jiraHoursPerDay, setJiraHoursPerDay] = useState(6);
  const [jiraTestIssueTypes, setJiraTestIssueTypes] = useState('Test,QA,Bug,Defect,测试,缺陷');
  const [jiraEpicLinkFieldId, setJiraEpicLinkFieldId] = useState('10014');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiBatchSize, setAiBatchSize] = useState(3);
  const [aiTimeout, setAiTimeout] = useState(180);
  const [aiPromptTemplate, setAiPromptTemplate] = useState('');

  
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  useEffect(() => {
    const loadSettings = async () => {
      setJiraDomain(await getStorageItem('jiraDomain') || '');
      setJiraProjects(await getStorageItem('jiraProjects') || '');
      const hours = await getStorageItem('jiraHoursPerDay');
      setJiraHoursPerDay(hours ? Number(hours) : 6);
      setJiraTestIssueTypes(await getStorageItem('jiraTestIssueTypes') || 'Test,QA,Bug,Defect,测试,缺陷');
      setJiraEpicLinkFieldId(await getStorageItem('jiraEpicLinkFieldId') || '10014');
      setJiraEmail(await getStorageItem('jiraEmail') || '');
      setJiraToken(await getStorageItem('jiraApiToken') || '');
      setOpenAiKey(await getStorageItem('openAiApiKey') || '');
      setAiBaseUrl(await getStorageItem('openAiBaseUrl') || 'https://api.openai.com/v1');
      setAiModel(await getStorageItem('openAiModel') || 'gpt-4o-mini');
      const savedBatchSize = await getStorageItem('aiBatchSize');
      setAiBatchSize(savedBatchSize ? Number(savedBatchSize) : 3);
      const savedTimeout = await getStorageItem('aiTimeout');
      setAiTimeout(savedTimeout ? Number(savedTimeout) : 180);
      setAiPromptTemplate(await getStorageItem('aiScoringPrompt') || DEFAULT_SCORING_PROMPT);

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
      await setStorageItem('jiraEpicLinkFieldId', jiraEpicLinkFieldId);
      await setStorageItem('jiraEmail', jiraEmail);
      await setStorageItem('jiraApiToken', jiraToken);
      await setStorageItem('openAiApiKey', openAiKey);
      await setStorageItem('openAiBaseUrl', aiBaseUrl);
      await setStorageItem('openAiModel', aiModel);
      await setStorageItem('aiBatchSize', aiBatchSize);
      await setStorageItem('aiTimeout', aiTimeout);
      await setStorageItem('aiScoringPrompt', aiPromptTemplate);

      
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
      setAiPromptTemplate(DEFAULT_SCORING_PROMPT);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h2>
          <p className="text-gray-500 mt-1">{t('settings.description')}</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded shadow-sm text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-8">
        
        <form onSubmit={handleSave} className="space-y-8">
          {/* Language Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4 flex items-center space-x-2">
              <Globe size={18} className="text-blue-500" />
              <span>{t('settings.language')}</span>
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('settings.languageDesc')}</label>
                <select 
                  className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={lang}
                  onChange={(e) => setLang(e.target.value as 'zh' | 'en')}
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Epic Link 自定义字段 ID (Epic Link Field)</label>
                <input 
                  type="text" 
                  placeholder="例如: 10014"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={jiraEpicLinkFieldId} onChange={e => setJiraEpicLinkFieldId(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">不同 Jira 实例的「Epic Link」自定义字段编号可能不同，拉取工时时底层使用 `cf[ID]` 与 `customfield_ID` 匹配子任务。默认 10014，仅填数字。</p>
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI 请求超时 (Timeout / 秒)</label>
                <input 
                  type="number" 
                  min="10"
                  max="600"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={aiTimeout} onChange={e => setAiTimeout(Number(e.target.value))}
                />
                <p className="text-xs text-gray-500 mt-1">单次调用大模型的最长等待时间（秒）。DeepSeek 等推理型模型响应较慢，如频繁提示超时请调大此值。默认 180。</p>
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
              <div className="mt-4 pt-4">
                <p className="text-xs text-gray-500 mb-2 leading-relaxed font-bold">系统主提示词模板 (Scoring Prompt Template)</p>
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                  您可以自由编辑下方的 Prompt 模板来改变 AI 的打分准则。
                  请保留 <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">{"{{phase}}"}</code> 核心占位符。
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
