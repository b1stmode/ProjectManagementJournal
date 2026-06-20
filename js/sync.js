import { supabase } from './supabase.js';

// ─── Field mapping ─────────────────────────────────────────────────────────

function toSnake(record) {
  const map = {
    projectId: 'project_id',
    milestoneId: 'milestone_id',
    isComplete: 'is_complete',
    completedAt: 'completed_at',
    createdAt: 'created_at',
    lastSessionAt: 'last_session_at',
    dueDate: 'due_date',
    finishedAt: 'finished_at',
    nextSessionPlan: 'next_session_plan',
    notDoneTasks: 'not_done_tasks',
    completedTaskIds: 'completed_task_ids',
  };
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

function toCamel(record) {
  const map = {
    project_id: 'projectId',
    milestone_id: 'milestoneId',
    is_complete: 'isComplete',
    completed_at: 'completedAt',
    created_at: 'createdAt',
    last_session_at: 'lastSessionAt',
    due_date: 'dueDate',
    finished_at: 'finishedAt',
    next_session_plan: 'nextSessionPlan',
    not_done_tasks: 'notDoneTasks',
    completed_task_ids: 'completedTaskIds',
  };
  const out = {};
  for (const [k, v] of Object.entries(record)) {
    out[map[k] ?? k] = v;
  }
  return out;
}

// ─── Offline queue ─────────────────────────────────────────────────────────

const QUEUE_KEY = 'pm-sync-queue';

function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}

function saveQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

function enqueue(op) {
  const q = getQueue();
  q.push(op);
  saveQueue(q);
}

// ─── Write-through helpers (called from db.js) ─────────────────────────────

export async function syncRecord(table, record) {
  if (!navigator.onLine) {
    enqueue({ type: 'upsert', table, record });
    return;
  }
  try {
    const { error } = await supabase.from(table).upsert(toSnake(record));
    if (error) {
      console.warn(`[sync] upsert ${table} failed`, error);
      enqueue({ type: 'upsert', table, record });
    }
  } catch (e) {
    console.warn(`[sync] upsert ${table} threw`, e);
    enqueue({ type: 'upsert', table, record });
  }
}

export async function deleteRecord(table, id) {
  if (!navigator.onLine) {
    enqueue({ type: 'delete', table, id });
    return;
  }
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`[sync] delete ${table}:${id} failed`, error);
      enqueue({ type: 'delete', table, id });
    }
  } catch (e) {
    console.warn(`[sync] delete ${table}:${id} threw`, e);
    enqueue({ type: 'delete', table, id });
  }
}

// ─── Flush offline queue ───────────────────────────────────────────────────

export async function flushQueue() {
  if (!navigator.onLine) return;
  const queue = getQueue();
  if (queue.length === 0) return;

  const failed = [];
  for (const op of queue) {
    try {
      if (op.type === 'upsert') {
        const { error } = await supabase.from(op.table).upsert(toSnake(op.record));
        if (error) failed.push(op);
      } else if (op.type === 'delete') {
        const { error } = await supabase.from(op.table).delete().eq('id', op.id);
        if (error) failed.push(op);
      }
    } catch {
      failed.push(op);
    }
  }
  saveQueue(failed);
}

// ─── Push all local IDB data up to Supabase ────────────────────────────────

async function syncUp() {
  const { getAllProjects, getMilestonesForProject, getTasksForProject, getSessionsForProject } =
    await import('./db.js');

  const projects   = await getAllProjects();
  const milestones = (await Promise.all(projects.map(p => getMilestonesForProject(p.id)))).flat();
  const tasks      = (await Promise.all(projects.map(p => getTasksForProject(p.id)))).flat();
  const sessions   = (await Promise.all(projects.map(p => getSessionsForProject(p.id)))).flat();

  if (projects.length)   await supabase.from('projects').upsert(projects.map(toSnake));
  if (milestones.length) await supabase.from('milestones').upsert(milestones.map(toSnake));
  if (tasks.length)      await supabase.from('tasks').upsert(tasks.map(toSnake));
  if (sessions.length)   await supabase.from('sessions').upsert(sessions.map(toSnake));
}

// ─── Pull Supabase data into local IDB ────────────────────────────────────
// Also removes local records that were deleted on another device.

async function syncDown() {
  const { getDB } = await import('./db.js');
  const idb = getDB();

  // Phase 1: read local keys in a readonly transaction (before the async fetch)
  const [localProjIds, localMileIds, localTaskIds, localSessIds] = await new Promise((resolve, reject) => {
    const stores = ['projects', 'milestones', 'tasks', 'sessions'];
    const tx = idb.transaction(stores, 'readonly');
    const results = [null, null, null, null];
    let done = 0;
    stores.forEach((name, i) => {
      const req = tx.objectStore(name).getAllKeys();
      req.onsuccess = () => {
        results[i] = req.result;
        if (++done === 4) resolve(results);
      };
      req.onerror = () => reject(req.error);
    });
  });

  // Phase 2: fetch from Supabase
  const [
    { data: sbProjects,   error: e1 },
    { data: sbMilestones, error: e2 },
    { data: sbTasks,      error: e3 },
    { data: sbSessions,   error: e4 },
  ] = await Promise.all([
    supabase.from('projects').select('*'),
    supabase.from('milestones').select('*'),
    supabase.from('tasks').select('*'),
    supabase.from('sessions').select('*'),
  ]);

  if (e1 || e2 || e3 || e4) {
    console.warn('[sync] syncDown fetch error', e1 ?? e2 ?? e3 ?? e4);
    return;
  }

  const sbProjIds = new Set((sbProjects   || []).map(r => r.id));
  const sbMileIds = new Set((sbMilestones || []).map(r => r.id));
  const sbTaskIds = new Set((sbTasks      || []).map(r => r.id));
  const sbSessIds = new Set((sbSessions   || []).map(r => r.id));

  // Phase 3: write all changes in a single readwrite transaction
  await new Promise((resolve, reject) => {
    const tx = idb.transaction(['projects', 'milestones', 'tasks', 'sessions'], 'readwrite');

    // Upsert all Supabase records
    for (const r of (sbProjects   || [])) tx.objectStore('projects').put(toCamel(r));
    for (const r of (sbMilestones || [])) tx.objectStore('milestones').put(toCamel(r));
    for (const r of (sbTasks      || [])) tx.objectStore('tasks').put(toCamel(r));
    for (const r of (sbSessions   || [])) tx.objectStore('sessions').put(toCamel(r));

    // Delete local records no longer present in Supabase (deleted on another device)
    for (const id of localProjIds) if (!sbProjIds.has(id)) tx.objectStore('projects').delete(id);
    for (const id of localMileIds) if (!sbMileIds.has(id)) tx.objectStore('milestones').delete(id);
    for (const id of localTaskIds) if (!sbTaskIds.has(id)) tx.objectStore('tasks').delete(id);
    for (const id of localSessIds) if (!sbSessIds.has(id)) tx.objectStore('sessions').delete(id);

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Boot sync — called once on app load ──────────────────────────────────

export async function firstTimeSync() {
  if (!navigator.onLine) return;
  try {
    await flushQueue(); // push any pending offline ops before pulling

    const { getAllProjects } = await import('./db.js');
    const [{ data: sbProjects }, localProjects] = await Promise.all([
      supabase.from('projects').select('id'),
      getAllProjects(),
    ]);

    const supabaseEmpty = !sbProjects || sbProjects.length === 0;
    const localEmpty    = localProjects.length === 0;

    if (supabaseEmpty && !localEmpty) {
      await syncUp();    // first time ever — push local data to cloud
    } else if (!supabaseEmpty) {
      await syncDown();  // pull latest from Supabase (new device or ongoing multi-device sync)
    }
    // Both empty: nothing to do
  } catch (e) {
    console.warn('[sync] firstTimeSync failed', e);
  }
}
