import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Calendar, Save, Plus, Trash2 } from 'lucide-react';
import { updateHolidaysConfig, HOLIDAYS as defaultHolidays, SPECIAL_WORKDAYS as defaultSpecialWorkdays } from '../../utils/dateUtils';

export const Holidays = () => {
  const settings = useLiveQuery(() => db.settings.toArray());
  const [holidays, setHolidays] = useState<string[]>(defaultHolidays);
  const [specialWorkdays, setSpecialWorkdays] = useState<string[]>(defaultSpecialWorkdays);
  const [newHoliday, setNewHoliday] = useState('');
  const [newSpecialWorkday, setNewSpecialWorkday] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      const hSetting = settings.find(s => s.key === 'holidays');
      const swSetting = settings.find(s => s.key === 'specialWorkdays');
      if (hSetting) setHolidays(hSetting.value);
      if (swSetting) setSpecialWorkdays(swSetting.value);
      
      // Update the global configuration in dateUtils when settings are loaded
      updateHolidaysConfig(
        hSetting ? hSetting.value : defaultHolidays,
        swSetting ? swSetting.value : defaultSpecialWorkdays
      );
    }
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.settings.put({ key: 'holidays', value: holidays });
      await db.settings.put({ key: 'specialWorkdays', value: specialWorkdays });
      // Update global config immediately
      updateHolidaysConfig(holidays, specialWorkdays);
      alert('节假日配置已保存');
    } catch (e) {
      alert('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const addHoliday = () => {
    if (newHoliday && !holidays.includes(newHoliday)) {
      setHolidays([...holidays, newHoliday].sort());
      setNewHoliday('');
    }
  };

  const removeHoliday = (date: string) => {
    setHolidays(holidays.filter(d => d !== date));
  };

  const addSpecialWorkday = () => {
    if (newSpecialWorkday && !specialWorkdays.includes(newSpecialWorkday)) {
      setSpecialWorkdays([...specialWorkdays, newSpecialWorkday].sort());
      setNewSpecialWorkday('');
    }
  };

  const removeSpecialWorkday = (date: string) => {
    setSpecialWorkdays(specialWorkdays.filter(d => d !== date));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">节假日与日历管理</h2>
          <p className="text-gray-500 mt-1">配置法定节假日与调休工作日，确保 AI 排期时间准确</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 text-sm font-bold transition-all disabled:opacity-50"
        >
          <Save size={18} />
          <span>保存日历配置</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Holidays Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-red-100 bg-red-50/50 flex items-center space-x-2">
            <Calendar size={18} className="text-red-500" />
            <h3 className="font-bold text-red-900">法定节假日 (休息)</h3>
          </div>
          <div className="p-4 flex-1">
            <div className="flex space-x-2 mb-4">
              <input 
                type="date" 
                value={newHoliday}
                onChange={e => setNewHoliday(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
              />
              <button 
                onClick={addHoliday}
                className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Plus size={16} />
                <span className="text-sm font-bold">添加</span>
              </button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {holidays.length === 0 ? (
                <p className="text-gray-400 text-sm italic text-center py-4">暂无节假日数据</p>
              ) : (
                holidays.map(date => (
                  <div key={date} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 group hover:border-red-200 transition-colors">
                    <span className="font-mono text-sm text-gray-700 font-medium">{date}</span>
                    <button 
                      onClick={() => removeHoliday(date)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Special Workdays Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-indigo-100 bg-indigo-50/50 flex items-center space-x-2">
            <Calendar size={18} className="text-indigo-500" />
            <h3 className="font-bold text-indigo-900">调休工作日 (周末上班)</h3>
          </div>
          <div className="p-4 flex-1">
            <div className="flex space-x-2 mb-4">
              <input 
                type="date" 
                value={newSpecialWorkday}
                onChange={e => setNewSpecialWorkday(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
              <button 
                onClick={addSpecialWorkday}
                className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Plus size={16} />
                <span className="text-sm font-bold">添加</span>
              </button>
            </div>
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {specialWorkdays.length === 0 ? (
                <p className="text-gray-400 text-sm italic text-center py-4">暂无调休工作日数据</p>
              ) : (
                specialWorkdays.map(date => (
                  <div key={date} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 group hover:border-indigo-200 transition-colors">
                    <span className="font-mono text-sm text-gray-700 font-medium">{date}</span>
                    <button 
                      onClick={() => removeSpecialWorkday(date)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
