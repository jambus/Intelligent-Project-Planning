import { useState, useEffect, useRef } from 'react';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { importProjectsFromFile } from '../../services/fileImport';
import { Save, UploadCloud } from 'lucide-react';

export const Settings = () => {
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  const [openAiKey, setOpenAiKey] = useState('');
  const [aiBaseUrl, setAiBaseUrl] = useState('https://api.openai.com/v1');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setJiraDomain(await getStorageItem('jiraDomain') || '');
      setJiraEmail(await getStorageItem('jiraEmail') || '');
      setJiraToken(await getStorageItem('jiraApiToken') || '');
      setOpenAiKey(await getStorageItem('openAiApiKey') || '');
      setAiBaseUrl(await getStorageItem('openAiBaseUrl') || 'https://api.openai.com/v1');
      setAiModel(await getStorageItem('openAiModel') || 'gpt-4o-mini');
    };
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await setStorageItem('jiraDomain', jiraDomain);
      await setStorageItem('jiraEmail', jiraEmail);
      await setStorageItem('jiraApiToken', jiraToken);
      await setStorageItem('openAiApiKey', openAiKey);
      await setStorageItem('openAiBaseUrl', aiBaseUrl);
      await setStorageItem('openAiModel', aiModel);
      
      setMessage({ type: 'success', text: '设置已保存成功！' });
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败。' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

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
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
          <p className="text-gray-500 mt-1">配置第三方 API 密钥与数据导入</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded shadow-sm text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        {/* File Import Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">项目列表导入 (CSV / Excel)</h3>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">请上传包含项目优先级与工时评估的 CSV 或 Excel 表格文件。该操作将覆盖本地已有的项目数据。</p>
            <div className="flex items-center space-x-4">
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileImport}
                disabled={isImporting}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="flex items-center space-x-2 text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-md disabled:opacity-50 transition-colors"
              >
                <UploadCloud size={18} />
                <span>{isImporting ? '正在导入...' : '选择文件并导入'}</span>
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6 pt-6 border-t border-gray-100">
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

          {/* AI Section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">AI 排期引擎配置 (OpenAI 兼容)</h3>
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
              <p className="text-xs text-gray-500 mt-1">您的 Key 仅会加密保存在浏览器本地，不会上传到任何第三方服务器。</p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 flex items-center justify-end border-t border-gray-100">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
            >
              <Save size={16} />
              <span>保存配置</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
