import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { db } from '../db';
import { fetchAIScores } from '../services/ai';
import { generateSchedulePlan } from '../scheduling/engine';
import { DEV_ROLES, TEST_ROLES } from '../scheduling/constraints';
import { computeProjectGaps } from '../utils/audit';
import { buildWorkingDaySet, formatLocalDate } from '../utils/dateUtils';
import { prepareExistingAllocations } from '../utils/schedulingPreparation';

interface SchedulingContextType {
  isScheduling: boolean;
  scheduleStatus: string;
  currentStep: number;
  error: string | null;
  handleGenerateSchedule: (selectedYear: number, startMonth: number, endMonth: number, shouldClear?: boolean) => Promise<void>;
  stopScheduling: () => void;
  clearError: () => void;
}

const SchedulingContext = createContext<SchedulingContextType | undefined>(undefined);

export const useScheduling = () => {
  const context = useContext(SchedulingContext);
  if (!context) throw new Error('useScheduling must be used within a SchedulingProvider');
  return context;
};

export const SchedulingProvider = ({ children }: { children: ReactNode }) => {
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const stopRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const stopScheduling = () => {
    if (!isScheduling) return;
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    setScheduleStatus('🛑 正在停止排期...');
  };

  const handleGenerateSchedule = async (
    selectedYear: number,
    startMonth: number,
    endMonth: number,
    shouldClear: boolean = true,
  ) => {
    const [resources, projects, operations, existingAllocations] = await Promise.all([
      db.resources.toArray(),
      db.projects.toArray(),
      db.productOperations.toArray(),
      db.allocations.toArray(),
    ]);
    const readyProjects = projects.filter(project => project.devTotalMd > 0 || project.testTotalMd > 0);
    if (resources.length === 0 || readyProjects.length === 0) return;

    setIsScheduling(true);
    setError(null);
    stopRequestedRef.current = false;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    const rangeStartDate = new Date(selectedYear, startMonth - 1, 1);
    const rangeEndDate = new Date(selectedYear, endMonth, 0);
    const rangeStart = formatLocalDate(rangeStartDate);
    const rangeEnd = formatLocalDate(rangeEndDate);

    const checkStop = () => {
      if (stopRequestedRef.current || signal.aborted) throw new Error('MANUAL_STOP');
    };

    try {
      setCurrentStep(1);
      setScheduleStatus('🧠 正在构建容量快照与 AI 技能评分...');
      const workingDaySet = await buildWorkingDaySet(rangeStartDate, rangeEndDate);
      const prepared = prepareExistingAllocations(existingAllocations, shouldClear);
      const initialGaps = computeProjectGaps(readyProjects, resources, prepared.retained, workingDaySet)
        .filter(project => project.devGap > 0.5 || project.testGap > 0.5);

      const devProjects = initialGaps.filter(project => project.devGap > 0.5);
      const testProjects = initialGaps.filter(project => project.testGap > 0.5);
      const devResources = resources.filter(resource => DEV_ROLES.includes(resource.role));
      const testResources = resources.filter(resource => TEST_ROLES.includes(resource.role));
      const devScores = devProjects.length > 0 && devResources.length > 0
        ? await fetchAIScores(devProjects, devResources, 'dev', signal)
        : [];
      checkStop();
      const testScores = testProjects.length > 0 && testResources.length > 0
        ? await fetchAIScores(testProjects, testResources, 'test', signal)
        : [];
      checkStop();

      setCurrentStep(2);
      setScheduleStatus('🛠️ 正在按优先级组生成确定性排期计划...');
      const plan = generateSchedulePlan({
        resources,
        projects: readyProjects,
        operations,
        existingAllocations: prepared.retained,
        workingDaySet,
        rangeStart,
        rangeEnd,
        devScores,
        testScores,
      });
      checkStop();

      setCurrentStep(3);
      setScheduleStatus('🛡️ 正在验证并写入排期结果...');
      if (prepared.idsToDelete.length > 0) {
        await db.allocations.bulkDelete(prepared.idsToDelete);
      }
      if (plan.generatedAllocations.length > 0) {
        await db.allocations.bulkAdd(plan.generatedAllocations);
      }
      await Promise.all(Array.from(plan.rejectionReasons, ([projectId, rejectionReason]) => (
        db.projects.update(projectId, { rejectionReason })
      )));

      setCurrentStep(4);
      setScheduleStatus('✨ 确定性优先级排期完成！');
      setTimeout(() => {
        if (!stopRequestedRef.current) {
          setScheduleStatus('');
          setCurrentStep(0);
        }
      }, 5000);
    } catch (caught: unknown) {
      const caughtError = caught instanceof Error ? caught : new Error(String(caught));
      if (caughtError.message === 'MANUAL_STOP' || caughtError.name === 'AbortError') {
        setScheduleStatus('🛑 排期已手动停止');
        setCurrentStep(0);
      } else {
        console.error(caughtError);
        setError(caughtError.message);
        setCurrentStep(0);
      }
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <SchedulingContext.Provider value={{
      isScheduling,
      scheduleStatus,
      currentStep,
      error,
      handleGenerateSchedule,
      stopScheduling,
      clearError: () => setError(null),
    }}>
      {children}
    </SchedulingContext.Provider>
  );
};
