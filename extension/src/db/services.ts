import { db, type Resource, type Project, type Allocation, type ProductOperation } from './index';

// ========================
// Resource Services
// ========================
export const addResource = async (resource: Omit<Resource, 'id'>) => {
  return await db.resources.add(resource);
};

export const getAllResources = async () => {
  return await db.resources.toArray();
};

export const updateResource = async (id: number, changes: Partial<Resource>) => {
  return await db.resources.update(id, changes);
};

export const deleteResource = async (id: number) => {
  // Cascade: remove allocations referencing this resource so the schedule
  // doesn't keep orphaned records pointing at a deleted person.
  await db.allocations.where('resourceId').equals(id).delete();
  return await db.resources.delete(id);
};

// ========================
// Project Services
// ========================
export const addProject = async (project: Omit<Project, 'id'>) => {
  return await db.projects.add(project);
};

export const getAllProjects = async () => {
  return await db.projects.toArray();
};

export const updateProject = async (id: number, changes: Partial<Project>) => {
  return await db.projects.update(id, changes);
};

export const deleteProject = async (id: number) => {
  // Cascade: remove allocations referencing this project.
  await db.allocations.where('projectId').equals(id).delete();
  return await db.projects.delete(id);
};

// ========================
// Allocation Services
// ========================
export const addAllocation = async (allocation: Omit<Allocation, 'id'>) => {
  return await db.allocations.add(allocation);
};

export const getAllocationsByResourceId = async (resourceId: number) => {
  return await db.allocations.where('resourceId').equals(resourceId).toArray();
};

export const getAllocationsByProjectId = async (projectId: number) => {
  return await db.allocations.where('projectId').equals(projectId).toArray();
};

export const deleteAllocation = async (id: number) => {
  return await db.allocations.delete(id);
};

// ========================
// Product Operation Services
// ========================
export const addProductOperation = async (operation: Omit<ProductOperation, 'id'>) => {
  return await db.productOperations.add(operation);
};

export const getAllProductOperations = async () => {
  return await db.productOperations.toArray();
};

export const updateProductOperation = async (id: number, changes: Partial<ProductOperation>) => {
  return await db.productOperations.update(id, changes);
};

export const deleteProductOperation = async (id: number) => {
  return await db.productOperations.delete(id);
};


import { formatLocalDate, isWorkingDay } from '../utils/dateUtils';

export const updateWeeklyAllocation = async (
  resourceId: number,
  projectId: number,
  weekYear: number,
  weekNumber: number,
  newMd: number,
  workingDaySet?: Set<string>
) => {
  const jan4 = new Date(weekYear, 0, 4);
  const day = jan4.getDay() || 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - day + 1 + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  
  const wStartStr = formatLocalDate(weekStart);
  const wEndStr = formatLocalDate(weekEnd);

  const allocs = await db.allocations.where({ resourceId }).toArray();
  const targetAllocs = allocs.filter(a => Number(a.projectId) === projectId);
    const isRowLocked = targetAllocs.some(a => a.isLocked);
  
  const toDelete: number[] = [];
  const toAdd: any[] = [];
  
  let allocationType: 'dev' | 'test' = 'dev';

  for (const alloc of targetAllocs) {
     if (!alloc.id) continue;
     
     if (alloc.endDate < wStartStr || alloc.startDate > wEndStr) {
       continue;
     }
     
     toDelete.push(alloc.id);
     allocationType = alloc.allocationType || 'dev';
     
     if (alloc.startDate < wStartStr) {
       const beforeEnd = new Date(weekStart);
       beforeEnd.setDate(weekStart.getDate() - 1);
       toAdd.push({
         ...alloc,
         id: undefined,
         endDate: formatLocalDate(beforeEnd)
       });
     }
     
     if (alloc.endDate > wEndStr) {
       const afterStart = new Date(weekEnd);
       afterStart.setDate(weekEnd.getDate() + 1);
       toAdd.push({
         ...alloc,
         id: undefined,
         startDate: formatLocalDate(afterStart)
       });
     }
  }
  
  if (newMd > 0) {
    let activeDays = 0;
    const current = new Date(weekStart);
    while (current <= weekEnd) {
      const dStr = formatLocalDate(current);
      if (workingDaySet) {
        if (workingDaySet.has(dStr)) activeDays++;
      } else {
        if (isWorkingDay(current)) activeDays++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    if (activeDays > 0) {
      const percentage = Math.round((newMd / activeDays) * 100);
      toAdd.push({
        resourceId,
        projectId,
        startDate: wStartStr,
        endDate: wEndStr,
        allocationPercentage: percentage,
        isLocked: isRowLocked,
        allocationType
      });
    }
  }
  
  await db.transaction('rw', db.allocations, async () => {
    if (toDelete.length > 0) {
      await db.allocations.bulkDelete(toDelete);
    }
    if (toAdd.length > 0) {
      await db.allocations.bulkAdd(toAdd);
    }
  });
};

export const transferAllocations = async (oldResourceId: number, newResourceId: number, projectId: number) => {
  await db.transaction('rw', db.allocations, async () => {
    const allocs = await db.allocations.where({ resourceId: oldResourceId }).toArray();
    const targetAllocs = allocs.filter(a => Number(a.projectId) === projectId);
    
    for (const alloc of targetAllocs) {
      if (alloc.id) {
        await db.allocations.update(alloc.id, { resourceId: newResourceId });
      }
    }
  });
};


export const toggleRowLock = async (resourceId: number, projectId: number, isLocked: boolean) => {
  await db.transaction('rw', db.allocations, async () => {
    const allocs = await db.allocations.where({ resourceId }).toArray();
    const targetAllocs = allocs.filter(a => Number(a.projectId) === projectId);
    
    for (const alloc of targetAllocs) {
      if (alloc.id) {
        await db.allocations.update(alloc.id, { isLocked });
      }
    }
  });
};
