import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { Settings, Plus, Trash2, Edit2, Save, X, Download, Upload } from 'lucide-react';
import { addProductOperation, deleteProductOperation, updateProductOperation } from '../../db/services';
import { importProductOperationsFromFile } from '../../services/fileImport';
import { ErrorModal } from '../components/ErrorModal';
import { useTranslation } from '../../context/I18nContext';

export const ProductOps = () => {
  const { t } = useTranslation();
  const operations = useLiveQuery(() => db.productOperations.toArray());
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    productName: '',
    monthlyDevMd: 0,
    monthlyTestMd: 0
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData({ productName: '', monthlyDevMd: 0, monthlyTestMd: 0 });
    setShowModal(true);
  };

  const handleOpenEdit = (op: any) => {
    setEditingId(op.id);
    setFormData({ 
      productName: op.productName, 
      monthlyDevMd: op.monthlyDevMd, 
      monthlyTestMd: op.monthlyTestMd 
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      productName: formData.productName.trim(),
      monthlyDevMd: Number(formData.monthlyDevMd),
      monthlyTestMd: Number(formData.monthlyTestMd)
    };
    if (!data.productName) return;

    if (editingId) {
      await updateProductOperation(editingId, data);
    } else {
      await addProductOperation(data);
    }

    // Auto-add to skills if not exists
    const existingSkills = await db.skills.toArray();
    const lowerName = data.productName.toLowerCase();
    if (!existingSkills.some(s => s.name.toLowerCase() === lowerName)) {
      await db.skills.add({
        name: data.productName,
        type: 'business'
      });
    }
    
    setShowModal(false);
  };

  const handleDelete = async (id?: number) => {
    if (id && window.confirm('确认删除该产品运维配置吗？')) {
      await deleteProductOperation(id);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsImporting(true);
    setError(null);
    try {
      await importProductOperationsFromFile(files);
    } catch (err: any) {
      console.error('Import failed:', err);
      setError(err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const exportToCSV = () => {
    if (!operations || operations.length === 0) return;
    
    const headers = ['Product Name', 'Monthly Dev MD', 'Monthly Test MD'];
    const csvContent = [
      headers.join(','),
      ...operations.map(op => [
        `"${op.productName}"`,
        op.monthlyDevMd,
        op.monthlyTestMd
      ].join(','))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `product_ops_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 pb-20">
      <ErrorModal 
        isOpen={!!error} 
        onClose={() => setError(null)} 
        title="产品运维导入失败"
        message="在导入文件时遇到了错误。请检查文件格式是否符合要求。"
        errorDetails={error}
      />
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('productOps.title')}</h2>
          <p className="text-gray-500 mt-1">{t('productOps.desc')}</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden" 
            accept=".csv,.xlsx"
            multiple
          />
          
          <button 
            onClick={exportToCSV}
            className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-600 px-4 py-2.5 rounded-xl border border-gray-200 shadow-sm text-xs font-bold transition-all"
            title="导出当前列表为 CSV"
          >
            <Download size={16} />
            <span>{t('common.export')}</span>
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center space-x-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2.5 rounded-xl border border-indigo-100 shadow-sm text-xs font-bold transition-all disabled:opacity-50"
            title="批量导入 CSV/Excel"
          >
            <Upload size={16} />
            <span>{isImporting ? t('common.importing') : t('common.import')}</span>
          </button>
          
          <button 
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl shadow-lg shadow-blue-100 text-sm font-bold transition-all"
          >
            <Plus size={18} />
            <span>{t('productOps.addOps')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
              <th className="p-4 font-semibold w-1/3">产品名称 (Product Name)</th>
              <th className="p-4 font-semibold text-center">每月开发运维人天</th>
              <th className="p-4 font-semibold text-center">每月测试运维人天</th>
              <th className="p-4 font-semibold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {!operations || operations.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-12 text-center text-gray-400">
                  暂无产品运维配置，请添加或批量导入
                </td>
              </tr>
            ) : (
              operations.map((op) => (
                <tr key={op.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                  <td className="p-4">
                    <div className="font-bold text-gray-900 flex items-center space-x-2">
                      <Settings size={16} className="text-gray-400" />
                      <span>{op.productName}</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="font-mono text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">{op.monthlyDevMd}d</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="font-mono text-sm font-semibold text-teal-600 bg-teal-50 px-2.5 py-1 rounded-md">{op.monthlyTestMd}d</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleOpenEdit(op)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(op.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] overflow-hidden transform animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center space-x-2">
                <Settings size={18} className="text-blue-600" />
                <span>{editingId ? '编辑产品运维' : '新增产品运维'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">产品名称</label>
                <input 
                  type="text" 
                  required
                  value={formData.productName}
                  onChange={e => setFormData({...formData, productName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="如: Order, POS"
                />
                <p className="text-xs text-gray-400 mt-1">需与人员的技能标签名称一致</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">每月开发人天</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.5"
                    required
                    value={formData.monthlyDevMd}
                    onChange={e => setFormData({...formData, monthlyDevMd: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">每月测试人天</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.5"
                    required
                    value={formData.monthlyTestMd}
                    onChange={e => setFormData({...formData, monthlyTestMd: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center space-x-2 shadow-md shadow-blue-100"
                >
                  <Save size={16} />
                  <span>{editingId ? t('productOps.saveChanges') : t('productOps.confirmAdd')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
