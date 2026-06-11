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

