import React from 'react';
import { TriangleAlert, X } from 'lucide-react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  errorDetails?: string | null;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  title = '操作失败',
  message = '在处理您的请求时遇到了错误，请检查输入或重试。',
  errorDetails
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
      <div className="bg-white p-0 rounded-3xl shadow-2xl w-[500px] overflow-hidden transform animate-in zoom-in-95 duration-200 border border-red-100">
        <div className="bg-red-50 p-6 flex items-center justify-between border-b border-red-100">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
              <TriangleAlert size={24} />
            </div>
            <h3 className="text-lg font-black text-red-900">{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-red-400 hover:bg-red-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-8">
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {message}
          </p>
          {errorDetails && (
            <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 mb-8 max-h-40 overflow-auto">
              <code className="text-xs text-red-600 break-words font-mono font-bold">{errorDetails}</code>
            </div>
          )}
          <div className="flex">
            <button 
              onClick={onClose} 
              className="flex-1 bg-gray-900 hover:bg-black text-white py-3.5 rounded-2xl font-bold text-sm shadow-xl transition-all active:scale-95"
            >
              我知道了
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
