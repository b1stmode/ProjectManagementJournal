import { supabase } from './supabase.js';

// IDB camelCase → Supabase snake_case
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

// Supabase snake_case → IDB camelCase
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

// Called after every IDB write — fire and forget from db.js
export async function syncRecord(table, record) {
  if (!navigator.onLine) return;
  try {
    const { error } = await supabase.from(table).upsert(toSnake(record));
    if (error) console.warn(`[sync] upsert ${table} failed`, error);
  } catch (e) {
    console.warn(`[sync] upsert ${table} threw`, e);
  }
}

// Called after every IDB delete — fire and forget from db.js
export async function deleteRecord(table, id) {
  if (!navigator.onLine) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.warn(`[sync] delete ${table}:${id} failed`, error);
  } catch (e) {
    console.warn(`[sync] delete ${table}:${id} threw`, e);
  }
}

// Push all local IDB data to Supabase (existing device, first sync)
async function syncUp() {
  // Dynamic import to avoid circular dependency (db.js imports sync.js statically)
  const { getAllProjects, getMilestonesForProject, getTasksForProject, getSessionsForProject } =
    await import('./db.js');

  const projects = await getAllProjects();
  const milestones = (await Promise.all(projects.map(p => getMilestonesForProject(p.id)))).flat();
  const tasks     = (await Promise.all(projects.map(p => getTasksForProject(p.id)))).flat();
  const sessions  = (await Promise.all(projects.map(p => getSessionsForProject(p.id)))).flat();

  // Upsert in FK dependency order
  if (projects.length)   await supabase.from('projects').upsert(projects.map(toSnake));
  if (milestones.length) await supabase.from('milestones').upsert(milestones.map(toSnake));
  if (tasks.length)      await supabase.from('tasks').upsert(tasks.map(toSnake));
  if (sessions.length)   await supabase.from('sessions').upsert(sessions.map(toSnake));
}

// Pull all Supabase data into local IDB (new device)
async function syncDown() {
  const { getDB } = await import('./db.js');

  const [{ data: projects }, { data: milestones }, { data: tasks }, { data: sessions }] =
    await Promise.all([
      supabase.from('projects').select('*'),
      supabase.from('milestones').select('*'),
      supabase.from('tasks').select('*'),
      supabase.from('sessions').select('*'),
    ]);

  const idb = getDB();
  await new Promise((resolve, reject) => {
    const tx = idb.transaction(['projects', 'milestones', 'tasks', 'sessions'], 'readwrite');
    for (const r of (projects   || [])) tx.objectStore('projects').put(toCamel(r));
    for (const r of (milestones || [])) tx.objectStore('milestones').put(toCamel(r));
    for (const r of (tasks      || [])) tx.objectStore('tasks').put(toCamel(r));
    for (const r of (sessions   || [])) tx.objectStore('sessions').put(toCamel(r));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// Called once on app load — decides whether to push up or pull down
export async function firstTimeSync() {
  if (!navigator.onLine) return;
  try {
    const { getAllProjects } = await import('./db.js');
    const [{ data: sbProjects }, localProjects] = await Promise.all([
      supabase.from('projects').select('id'),
      getAllProjects(),
    ]);

    const supabaseEmpty = !sbProjects || sbProjects.length === 0;
    const localEmpty    = localProjects.length === 0;

    if (supabaseEmpty && !localEmpty) {
      await syncUp();   // existing device — push local data to cloud
    } else if (!supabaseEmpty && localEmpty) {
      await syncDown(); // new device — pull cloud data down
    }
    // Both have data: trust local for now. M8 handles conflict resolution.
  } catch (e) {
    console.warn('[sync] firstTimeSync failed', e);
  }
}
