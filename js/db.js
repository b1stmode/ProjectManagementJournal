const DB_NAME = 'pmjournal';
const DB_VERSION = 1;

let db = null;

export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains('projects')) {
        const projects = database.createObjectStore('projects', { keyPath: 'id', autoIncrement: true });
        projects.createIndex('status', 'status', { unique: false });
        projects.createIndex('createdAt', 'createdAt', { unique: false });
      }

      if (!database.objectStoreNames.contains('milestones')) {
        const milestones = database.createObjectStore('milestones', { keyPath: 'id', autoIncrement: true });
        milestones.createIndex('projectId', 'projectId', { unique: false });
        milestones.createIndex('projectId_order', ['projectId', 'order'], { unique: false });
        milestones.createIndex('isComplete', 'isComplete', { unique: false });
      }

      if (!database.objectStoreNames.contains('tasks')) {
        const tasks = database.createObjectStore('tasks', { keyPath: 'id', autoIncrement: true });
        tasks.createIndex('milestoneId', 'milestoneId', { unique: false });
        tasks.createIndex('projectId', 'projectId', { unique: false });
        tasks.createIndex('milestoneId_order', ['milestoneId', 'order'], { unique: false });
        tasks.createIndex('completedAt', 'completedAt', { unique: false });
        tasks.createIndex('dueDate', 'dueDate', { unique: false });
      }

      if (!database.objectStoreNames.contains('sessions')) {
        const sessions = database.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        sessions.createIndex('projectId', 'projectId', { unique: false });
        sessions.createIndex('finishedAt', 'finishedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

export function getDB() {
  if (!db) throw new Error('DB not initialized — call initDB() first.');
  return db;
}

// --- Projects ---

export function createProject(data) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const record = {
      name: data.name,
      description: data.description ?? '',
      status: 'inactive',
      lastSessionAt: null,
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export function getAllProjects() {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('projects', 'readonly');
    const req = tx.objectStore('projects').getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function getProject(id) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('projects', 'readonly');
    const req = tx.objectStore('projects').get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export function updateProject(id, changes) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('projects', 'readwrite');
    const store = tx.objectStore('projects');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const updated = { ...getReq.result, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export function deleteProject(id) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(['projects', 'milestones', 'tasks', 'sessions'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    tx.objectStore('projects').delete(id);

    tx.objectStore('milestones').index('projectId')
      .getAllKeys(IDBKeyRange.only(id)).onsuccess = (e) => {
        e.target.result.forEach(key => tx.objectStore('milestones').delete(key));
      };

    tx.objectStore('tasks').index('projectId')
      .getAllKeys(IDBKeyRange.only(id)).onsuccess = (e) => {
        e.target.result.forEach(key => tx.objectStore('tasks').delete(key));
      };

    tx.objectStore('sessions').index('projectId')
      .getAllKeys(IDBKeyRange.only(id)).onsuccess = (e) => {
        e.target.result.forEach(key => tx.objectStore('sessions').delete(key));
      };
  });
}

// --- Milestones ---

export function createMilestone(data) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readwrite');
    const store = tx.objectStore('milestones');
    const record = {
      projectId: data.projectId,
      name: data.name,
      description: data.description ?? '',
      order: data.order ?? 0,
      isComplete: false,
      completedAt: null,
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export function getMilestonesForProject(projectId) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readonly');
    const req = tx.objectStore('milestones').index('projectId').getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.order - b.order));
    req.onerror = () => reject(req.error);
  });
}

export function updateMilestone(id, changes) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('milestones', 'readwrite');
    const store = tx.objectStore('milestones');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const updated = { ...getReq.result, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export function deleteMilestone(id) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction(['milestones', 'tasks'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    tx.objectStore('milestones').delete(id);

    tx.objectStore('tasks').index('milestoneId')
      .getAllKeys(IDBKeyRange.only(id)).onsuccess = (e) => {
        e.target.result.forEach(key => tx.objectStore('tasks').delete(key));
      };
  });
}

// --- Tasks ---

export function createTask(data) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const record = {
      milestoneId: data.milestoneId,
      projectId: data.projectId,
      name: data.name,
      description: data.description ?? '',
      order: data.order ?? 0,
      isComplete: false,
      completedAt: null,
      dueDate: data.dueDate ?? null,
      createdAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export function getTasksForMilestone(milestoneId) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('tasks', 'readonly');
    const req = tx.objectStore('tasks').index('milestoneId').getAll(IDBKeyRange.only(milestoneId));
    req.onsuccess = () => resolve(req.result.sort((a, b) => a.order - b.order));
    req.onerror = () => reject(req.error);
  });
}

export function getTasksForProject(projectId) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('tasks', 'readonly');
    const req = tx.objectStore('tasks').index('projectId').getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function updateTask(id, changes) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('tasks', 'readwrite');
    const store = tx.objectStore('tasks');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const updated = { ...getReq.result, ...changes };
      const putReq = store.put(updated);
      putReq.onsuccess = () => resolve(updated);
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export function deleteTask(id) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('tasks', 'readwrite');
    const req = tx.objectStore('tasks').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// --- Sessions ---

export function createSession(data) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const record = {
      projectId: data.projectId,
      completedTaskIds: data.completedTaskIds ?? [],
      notDoneTasks: data.notDoneTasks ?? '',
      notes: data.notes ?? '',
      nextSessionPlan: data.nextSessionPlan ?? '',
      finishedAt: Date.now(),
    };
    const req = store.add(record);
    req.onsuccess = () => resolve({ ...record, id: req.result });
    req.onerror = () => reject(req.error);
  });
}

export function getSessionsForProject(projectId) {
  return new Promise((resolve, reject) => {
    const tx = getDB().transaction('sessions', 'readonly');
    const req = tx.objectStore('sessions').index('projectId').getAll(IDBKeyRange.only(projectId));
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.finishedAt - a.finishedAt));
    req.onerror = () => reject(req.error);
  });
}
