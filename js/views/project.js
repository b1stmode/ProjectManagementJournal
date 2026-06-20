import {
  getProject, getAllProjects, updateProject,
  createMilestone, getMilestonesForProject, updateMilestone, deleteMilestone,
  createTask, getTasksForMilestone, getTask, updateTask, deleteTask,
  getSessionsForProject,
} from '../db.js';
import { openModal, closeModal, openConfirmModal } from '../utils/modal.js';
import { getActiveMilestone, checkMilestoneCompletion } from '../utils/milestones.js';

let currentProjectId = null;

export async function renderProject(params) {
  currentProjectId = Number(params.id);
  const app = document.getElementById('app');

  const project = await getProject(currentProjectId);
  if (!project) {
    app.innerHTML = `<div class="view-loading">Project not found.</div>`;
    return;
  }

  app.innerHTML = `
    <div class="project-detail-view">
      <a href="#/" class="back-link">← Home</a>

      <div class="project-header">
        <div class="project-header-top">
          <h1 class="project-title">${escapeHtml(project.name)}</h1>
          <span class="status-badge ${project.status}">${project.status}</span>
          ${project.status !== 'active'
            ? `<button class="btn btn-primary" id="set-active-btn">Set Active</button>`
            : ''}
        </div>
        ${project.description
          ? `<p class="project-description">${escapeHtml(project.description)}</p>`
          : ''}
      </div>

      <div class="milestones-section">
        <div class="milestones-header">
          <span class="milestones-title">Milestones</span>
          <button class="btn btn-primary" id="add-milestone-btn">+ Add Milestone</button>
        </div>
        <div id="milestone-list-container"></div>
      </div>

      <div class="sessions-section">
        <div class="sessions-header">
          <span class="sessions-title">Session History</span>
        </div>
        <div id="session-list-container"></div>
      </div>
    </div>
  `;

  document.getElementById('set-active-btn')?.addEventListener('click', () => handleSetActive(project));
  document.getElementById('add-milestone-btn').addEventListener('click', () => openMilestoneModal(null));

  await renderMilestones();
  await renderSessions();
}

async function renderMilestones() {
  const container = document.getElementById('milestone-list-container');
  if (!container) return;

  const milestones = await getMilestonesForProject(currentProjectId);
  const taskGroups = await Promise.all(milestones.map(m => getTasksForMilestone(m.id)));
  const active = getActiveMilestone(milestones);

  if (milestones.length === 0) {
    container.innerHTML = `<div class="milestones-empty">No milestones yet. Add one to start tracking progress.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="milestone-list">
      ${milestones.map((m, i) => renderMilestoneItem(m, taskGroups[i], i, milestones.length, active?.id === m.id)).join('')}
    </div>
  `;

  milestones.forEach((m, i) => {
    const item = container.querySelector(`[data-milestone-id="${m.id}"]`);
    item.querySelector('[data-action="up"]')?.addEventListener('click', () => reorderMilestone(milestones, i, -1));
    item.querySelector('[data-action="down"]')?.addEventListener('click', () => reorderMilestone(milestones, i, 1));
    item.querySelector('[data-action="edit"]').addEventListener('click', () => openMilestoneModal(m));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => handleDeleteMilestone(m));
  });

  container.querySelectorAll('[data-action="add-task"]').forEach(btn => {
    btn.addEventListener('click', () => openTaskModal(Number(btn.dataset.milestoneId)));
  });

  container.querySelectorAll('[data-action="toggle-task"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleTask(Number(btn.dataset.taskId)));
  });

  container.querySelectorAll('[data-action="edit-task"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const task = await getTask(Number(btn.dataset.taskId));
      openTaskModal(task.milestoneId, task);
    });
  });

  container.querySelectorAll('[data-action="delete-task"]').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTask(Number(btn.dataset.taskId)));
  });

  container.querySelectorAll('[data-action="task-up"]').forEach(btn => {
    btn.addEventListener('click', () => reorderTask(Number(btn.dataset.taskId), -1));
  });

  container.querySelectorAll('[data-action="task-down"]').forEach(btn => {
    btn.addEventListener('click', () => reorderTask(Number(btn.dataset.taskId), 1));
  });
}

function renderMilestoneItem(milestone, tasks, index, total, isActive) {
  const complete = tasks.filter(t => t.isComplete).length;
  const taskTotal = tasks.length;
  const percent = taskTotal === 0 ? 0 : Math.round((complete / taskTotal) * 100);

  return `
    <div class="milestone-item ${isActive ? 'is-active' : ''} ${milestone.isComplete ? 'is-complete' : ''}"
         data-milestone-id="${milestone.id}">
      <div class="milestone-reorder">
        <button class="btn-icon" data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-icon" data-action="down" ${index === total - 1 ? 'disabled' : ''}>↓</button>
      </div>
      <div class="milestone-body">
        <div class="milestone-name-row">
          <span class="milestone-name">${escapeHtml(milestone.name)}</span>
          ${isActive ? `<span class="milestone-badge active">Active</span>` : ''}
          ${milestone.isComplete ? `<span class="milestone-badge complete">Complete</span>` : ''}
        </div>
        ${milestone.description
          ? `<p class="milestone-description">${escapeHtml(milestone.description)}</p>`
          : ''}
        <div class="milestone-tasks">
          ${taskTotal > 0 ? `
            <div class="milestone-progress">
              <div class="milestone-progress-bar-track">
                <div class="milestone-progress-bar-fill" style="width: ${percent}%"></div>
              </div>
              <span class="milestone-progress-label">${complete}/${taskTotal} tasks</span>
            </div>
            <ul class="task-list">
              ${tasks.map((t, ti) => renderTaskItem(t, ti, taskTotal)).join('')}
            </ul>
          ` : `<p class="tasks-empty">No tasks yet</p>`}
          <button class="task-add-btn" data-milestone-id="${milestone.id}" data-action="add-task">+ Add Task</button>
        </div>
      </div>
      <div class="milestone-actions">
        <button class="btn btn-ghost" data-action="edit">Edit</button>
        <button class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;
}

function renderTaskItem(task, index, total) {
  return `
    <li class="task-item${task.isComplete ? ' is-complete' : ''}" data-task-id="${task.id}">
      <button class="task-checkbox" data-task-id="${task.id}" data-action="toggle-task"
              title="${task.isComplete ? 'Mark incomplete' : 'Mark complete'}">${task.isComplete ? '✓' : '○'}</button>
      <span class="task-name">${escapeHtml(task.name)}</span>
      <div class="task-reorder">
        <button class="btn-icon" data-task-id="${task.id}" data-action="task-up" ${index === 0 ? 'disabled' : ''}>↑</button>
        <button class="btn-icon" data-task-id="${task.id}" data-action="task-down" ${index === total - 1 ? 'disabled' : ''}>↓</button>
      </div>
      <div class="task-actions">
        <button class="btn btn-ghost" data-task-id="${task.id}" data-action="edit-task">Edit</button>
        <button class="btn btn-danger" data-task-id="${task.id}" data-action="delete-task">Delete</button>
      </div>
    </li>
  `;
}

function openMilestoneModal(existing) {
  const isEdit = existing !== null;
  openModal(
    isEdit ? 'Edit Milestone' : 'New Milestone',
    `
      <div class="form-field">
        <label class="form-label" for="milestone-name">Name</label>
        <input class="form-input" id="milestone-name" type="text" placeholder="Milestone name"
               value="${isEdit ? escapeHtml(existing.name) : ''}" />
      </div>
      <div class="form-field">
        <label class="form-label" for="milestone-desc">Description</label>
        <textarea class="form-textarea" id="milestone-desc" placeholder="Optional description">${isEdit ? escapeHtml(existing.description) : ''}</textarea>
      </div>
    `,
    async (modal) => {
      const name = modal.querySelector('#milestone-name').value.trim();
      if (!name) return;
      const description = modal.querySelector('#milestone-desc').value.trim();

      if (isEdit) {
        await updateMilestone(existing.id, { name, description });
      } else {
        const all = await getMilestonesForProject(currentProjectId);
        await createMilestone({ projectId: currentProjectId, name, description, order: all.length });
      }

      closeModal();
      await renderMilestones();
    },
    isEdit ? 'Save' : 'Create'
  );
}

function openTaskModal(milestoneId, existing = null) {
  const isEdit = existing !== null;
  openModal(
    isEdit ? 'Edit Task' : 'New Task',
    `
      <div class="form-field">
        <label class="form-label" for="task-name">Name</label>
        <input class="form-input" id="task-name" type="text" placeholder="Task name"
               value="${isEdit ? escapeHtml(existing.name) : ''}" />
      </div>
      <div class="form-field">
        <label class="form-label" for="task-desc">Description</label>
        <textarea class="form-textarea" id="task-desc" placeholder="Optional description">${isEdit ? escapeHtml(existing.description) : ''}</textarea>
      </div>
    `,
    async (modal) => {
      const name = modal.querySelector('#task-name').value.trim();
      if (!name) return;
      const description = modal.querySelector('#task-desc').value.trim();

      if (isEdit) {
        await updateTask(existing.id, { name, description });
        closeModal();
        await renderMilestones();
      } else {
        const tasks = await getTasksForMilestone(milestoneId);
        await createTask({ milestoneId, projectId: currentProjectId, name, description, order: tasks.length });
        await checkMilestoneCompletion(milestoneId);
        closeModal();
        await renderProject({ id: currentProjectId });
      }
    },
    isEdit ? 'Save' : 'Add Task'
  );
}

async function handleToggleTask(taskId) {
  const task = await getTask(taskId);
  const nowComplete = !task.isComplete;
  await updateTask(taskId, {
    isComplete: nowComplete,
    completedAt: nowComplete ? Date.now() : null,
  });
  await checkMilestoneCompletion(task.milestoneId);
  await renderProject({ id: currentProjectId });
}

async function reorderTask(taskId, direction) {
  const task = await getTask(taskId);
  const tasks = await getTasksForMilestone(task.milestoneId);
  const index = tasks.findIndex(t => t.id === taskId);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= tasks.length) return;

  const a = tasks[index];
  const b = tasks[targetIndex];
  await Promise.all([
    updateTask(a.id, { order: b.order }),
    updateTask(b.id, { order: a.order }),
  ]);
  await renderMilestones();
}

async function handleDeleteTask(taskId) {
  const task = await getTask(taskId);
  openConfirmModal('Delete this task?', async () => {
    closeModal();
    await deleteTask(taskId);
    await checkMilestoneCompletion(task.milestoneId);
    await renderProject({ id: currentProjectId });
  });
}

async function reorderMilestone(milestones, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= milestones.length) return;

  const a = milestones[index];
  const b = milestones[targetIndex];
  await Promise.all([
    updateMilestone(a.id, { order: b.order }),
    updateMilestone(b.id, { order: a.order }),
  ]);

  await renderMilestones();
}

async function handleSetActive(project) {
  const all = await getAllProjects();
  await Promise.all(all.map(p =>
    updateProject(p.id, {
      status: p.id === project.id ? 'active' : (p.status === 'active' ? 'inactive' : p.status),
    })
  ));
  await renderProject({ id: currentProjectId });
}

async function handleDeleteMilestone(milestone) {
  openConfirmModal(`Delete milestone "${escapeHtml(milestone.name)}"? All tasks inside it will also be deleted.`, async () => {
    closeModal();
    await deleteMilestone(milestone.id);
    await renderMilestones();
    await renderSessions();
  });
}

async function renderSessions() {
  const container = document.getElementById('session-list-container');
  if (!container) return;

  const sessions = await getSessionsForProject(currentProjectId);

  if (sessions.length === 0) {
    container.innerHTML = `<div class="sessions-empty">No sessions recorded yet.</div>`;
    return;
  }

  const taskNameGroups = await Promise.all(sessions.map(async (session) => {
    if (!session.completedTaskIds?.length) return [];
    const tasks = await Promise.all(session.completedTaskIds.map(id => getTask(id)));
    return tasks.map(t => t?.name ?? '(deleted task)');
  }));

  container.innerHTML = `
    <div class="session-list">
      ${sessions.map((s, i) => renderSessionEntry(s, taskNameGroups[i])).join('')}
    </div>
  `;
}

function renderSessionEntry(session, taskNames) {
  return `
    <div class="session-entry">
      <div class="session-entry-date">${formatDate(session.finishedAt)}</div>
      <div class="session-block">
        ${taskNames.length > 0
          ? taskNames.map(name => `<div class="session-task done">✓ ${escapeHtml(name)}</div>`).join('')
          : `<p class="session-tasks-empty">No tasks completed.</p>`}
      </div>
      ${session.notDoneTasks ? `
        <div class="session-block">
          <div class="session-block-label">Not Done</div>
          ${session.notDoneTasks.split('\n').filter(Boolean).map(t =>
            `<div class="session-task not-done">✗ ${escapeHtml(t)}</div>`).join('')}
        </div>
      ` : ''}
      ${session.notes ? `
        <div class="session-block">
          <div class="session-block-label">Notes</div>
          <p class="session-entry-text">${escapeHtml(session.notes)}</p>
        </div>
      ` : ''}
      ${session.nextSessionPlan ? `
        <div class="session-block">
          <div class="session-block-label">Next Session</div>
          <p class="session-entry-text">${escapeHtml(session.nextSessionPlan)}</p>
        </div>
      ` : ''}
    </div>
  `;
}

function formatDate(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
