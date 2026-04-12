import { useState, useEffect } from 'react';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { syncGoogleSheetProjects } from '../../services/googleSheets';
import { Save, RefreshCw } from 'lucide-react';

export const Settings = () => {
  const [jiraDomain, setJiraDomain] = useState('');
  const [jiraEmail, setJiraEmail] = useState('');
  const [jiraToken, setJiraToken] = useState('');
  
  const [gsApiKey, setGsApiKey] = useState('');
  const [gsSpreadsheetId, setGsSpreadsheetId] = useState('');
  const [gsRange, setGsRange] = useState('Sheet1!A2:J');
  
  const [openAiKey, setOpenAiKey] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setJiraDomain(await getStorageItem('jiraDomain') || '');
      setJiraEmail(await getStorageItem('jiraEmail') || '');
      setJiraToken(await getStorageItem('jiraApiToken') || '');
      setOpenAiKey(await getStorageItem('openAiApiKey') || '');
      
      setGsApiKey(await getStorageItem('gsApiKey') || '');
      setGsSpreadsheetId(await getStorageItem('gsSpreadsheetId') || '');
      setGsRange(await getStorageItem('gsRange') || 'Sheet1!A2:J');
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
      
      await setStorageItem('gsApiKey', gsApiKey);
      await setStorageItem('gsSpreadsheetId', gsSpreadsheetId);
      await setStorageItem('gsRange', gsRange);
      
      setMessage({ type: 'success', text: '设置已保存成功！' });
    } catch (err) {
      setMessage({ type: 'error', text: '保存失败。' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleSyncProjects = async () => {
    setIsSyncing(true);
    try {
      await syncGoogleSheetProjects();
      setMessage({ type: 'success', text: 'Google Sheet 项目排期列表同步成功！' });
    } catch (err: any) {
      setMessage({ type: 'error', text: `Google Sheet 同步失败: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">系统设置</h2>
          <p className="text-gray-500 mt-1">配置第三方 API 密钥与数据同步源</p>
        </div>
        {message && (
          <div className={`px-4 py-2 rounded shadow-sm text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {message.text}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        
        {/* Google Sheets Section */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Google Sheet (项目列表来源)</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Spreadsheet ID</label>
              <input 
                type="text" 
                placeholder="e.g. 1BxiMVs0XRX5nZYx..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={gsSpreadsheetId} onChange={e => setGsSpreadsheetId(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sheet API Key</label>
                <input 
                  type="password" 
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={gsApiKey} onChange={e => setGsApiKey(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">数据读取范围 (Range)</label>
                <input 
                  type="text" 
                  placeholder="Sheet1!A2:J"
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={gsRange} onChange={e => setGsRange(e.target.value)}
                />
              </div>
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
          <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">OpenAI 配置</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
              <input 
                type="password" 
                placeholder="sk-..."
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={openAiKey} onChange={e => setOpenAiKey(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">您的 Key 仅会加密保存在浏览器本地，不会上传到任何第三方服务器。</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center justify-between border-t border-gray-100">
          <button
            type="button"
            onClick={handleSyncProjects}
            disabled={isSyncing || !gsSpreadsheetId || !gsApiKey}
            className="flex items-center space-x-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-md disabled:opacity-50"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            <span>手动全量拉取排期项目 (Google Sheet)</span>
          </button>

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
  );
};
