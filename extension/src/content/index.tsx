import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import '../index.css';

console.log('Smart Sprint Planner: Content script injected on Jira.');

const ContentApp = () => {
  const [loadPercentage, setLoadPercentage] = useState<number | null>(null);
  const [assigneeName, setAssigneeName] = useState<string | null>(null);

  useEffect(() => {
    // A primitive observer to wait for Jira's assignee DOM element to load
    const observer = new MutationObserver(() => {
      const assigneeElement = document.querySelector('[data-testid="issue.views.field.user.assignee"]');
      if (assigneeElement) {
        const text = assigneeElement.textContent || '';
        const cleanName = text.replace('Assignee', '').trim();
        if (cleanName && cleanName !== 'Unassigned' && cleanName !== assigneeName) {
          setAssigneeName(cleanName);
          checkLoad(cleanName);
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [assigneeName]);

  const checkLoad = async (name: string) => {
    try {
      const resource = await db.resources.where('name').equalsIgnoreCase(name).first();
      if (!resource || !resource.id) {
        setLoadPercentage(null); // Not managed by our system
        return;
      }

      const allocations = await db.allocations.where('resourceId').equals(resource.id).toArray();
      const totalLoad = allocations.reduce((sum, alloc) => sum + alloc.allocationPercentage, 0);
      setLoadPercentage(totalLoad);
    } catch (e) {
      console.error('Failed to check load from IndexedDB', e);
    }
  };

  if (loadPercentage === null || !assigneeName) return null;

  const isOverloaded = loadPercentage > 100;
  const isAvailable = loadPercentage < 80;

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] p-4 rounded-xl shadow-2xl border flex flex-col w-72 backdrop-blur-md font-sans ${
      isOverloaded ? 'bg-red-50/95 border-red-200 text-red-900' : 
      isAvailable ? 'bg-green-50/95 border-green-200 text-green-900' : 
      'bg-yellow-50/95 border-yellow-200 text-yellow-900'
    }`}>
      <div className="flex items-start space-x-3">
        <div className="mt-1">
          {isOverloaded ? <AlertTriangle size={24} className="text-red-500" /> : <CheckCircle size={24} className={isAvailable ? "text-green-500" : "text-yellow-500"} />}
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-base leading-tight flex items-center justify-between">
            <span>资源负荷预警</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
               isOverloaded ? 'bg-red-200 text-red-800' : 
               isAvailable ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'
            }`}>{loadPercentage}%</span>
          </h4>
          <p className="text-sm mt-1 opacity-90">
            当前指派人 <strong>{assigneeName}</strong>
            {isOverloaded ? ' 在此季度严重超载，可能存在延期风险！' : 
             isAvailable ? ' 负荷健康，仍有余力接手新任务。' : 
             ' 负荷较满，安排新任务需谨慎。'}
          </p>
        </div>
      </div>
    </div>
  );
};

// Create an isolated injection root
const initContentScript = () => {
  const containerId = 'irp-content-root';
  if (document.getElementById(containerId)) return;

  const container = document.createElement('div');
  container.id = containerId;
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ContentApp />);
};

// Ensure it runs after DOM is partially ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
