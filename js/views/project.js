import {
  getProject, getAllProjects, updateProject, deleteProject,
  createVersion, getVersion, getAllVersionsForProject, updateVersion, deleteVersion,
  createMilestone, getMilestonesForVersion, updateMilestone, deleteMilestone,
  createTask, getTasksForMilestone, getTask, updateTask, deleteTask,
  getSessionsForProject,
  createImportantDate, getImportantDatesForProject, updateImportantDate, deleteImportantDate,
  createBacklogItem, getBacklogForProject, updateBacklogItem, deleteBacklogItem,
} from '../db.js';
import { openModal, closeModal, openConfirmModal } from '../utils/modal.js';
import { getActiveMilestone, checkMilestoneCompletion } from '../utils/milestones.js';
import { navigate } from '../router.js';

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
          <button class="btn btn-ghost" id="edit-project-btn" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Edit</button>
          <button class="btn btn-danger" id="delete-project-btn" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Delete</button>
          ${project.status !== 'active'
            ? `<button class="btn btn-primary" id="set-active-btn">Set Active</button>`
            : `<button class="btn btn-ghost" id="deactivate-btn">Deactivate</button>`}
        </div>
        ${project.description
          ? `<p class="project-description">${escapeHtml(project.description)}</p>`
          : ''}
        <div id="project-progress-summary" class="project-progress-summary"></div>
      </div>

      <div class="milestones-section">
        <div class="milestones-header">
          <span class="milestones-title">Versions</span>
          <button class="btn btn-primary" id="add-version-btn">+ Add Version</button>
        </div>
        <div id="version-list-container"></div>
      </div>

      <div class="dates-section">
        <div class="dates-header">
          <span class="dates-title">Important Dates</span>
          <button class="btn btn-ghost" id="add-date-btn" style="font-size: var(--text-xs); padding: 2px var(--space-3);">+ Add Date</button>
        </div>
        <div id="date-list-container"></div>
      </div>

      <div class="backlog-section">
        <div class="backlog-header">
          <span class="backlog-title">Backlog</span>
          <button class="btn btn-ghost" id="add-backlog-btn" style="font-size: var(--text-xs); padding: 2px var(--space-3);">+ Add Item</button>
        </div>
        <div id="backlog-list-container"></div>
      </div>

      <div class="sessions-section">
        <div class="sessions-header">
          <span class="sessions-title">Session History</span>
        </div>
        <div id="session-list-container"></div>
      </div>
    </div>
  `;

  document.getElementById('edit-project-btn').addEventListener('click', () => {
    openModal(
      'Edit Project',
      `
        <div class="form-field">
          <label class="form-label" for="edit-proj-name">Name</label>
          <input class="form-input" id="edit-proj-name" type="text" value="${escapeHtml(project.name)}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="edit-proj-desc">Description</label>
          <textarea class="form-textarea" id="edit-proj-desc">${escapeHtml(project.description ?? '')}</textarea>
        </div>
      `,
      async (modal) => {
        const name = modal.querySelector('#edit-proj-name').value.trim();
        if (!name) return;
        await updateProject(project.id, { name, description: modal.querySelector('#edit-proj-desc').value.trim() });
        closeModal();
        await renderProject({ id: String(project.id) });
      },
      'Save'
    );
  });

  document.getElementById('delete-project-btn').addEventListener('click', () => {
    openConfirmModal(
      `Delete "${escapeHtml(project.name)}"? All milestones, tasks, and sessions will be permanently removed.`,
      async () => {
        await deleteProject(project.id);
        navigate('/');
      }
    );
  });

  document.getElementById('set-active-btn')?.addEventListener('click', () => handleSetActive(project));
  document.getElementById('deactivate-btn')?.addEventListener('click', () => handleDeactivate(project));
  document.getElementById('add-version-btn').addEventListener('click', () => openVersionModal(null));
  document.getElementById('add-date-btn').addEventListener('click', () => openDateModal(null));
  document.getElementById('add-backlog-btn').addEventListener('click', () => openBacklogModal());

  await renderVersions();
  await renderImportantDates();
  await renderBacklog();
  await renderSessions();
}

async function renderVersions() {
  const container = document.getElementById('version-list-container');
  if (!container) return;

  const versions = await getAllVersionsForProject(currentProjectId);
  const summaryEl = document.getElementById('project-progress-summary');

  if (versions.length === 0) {
    container.innerHTML = `<div class="milestones-empty">No versions yet. Add one to start tracking progress.</div>`;
    if (summaryEl) summaryEl.innerHTML = '';
    return;
  }

  const milestoneGroups = await Promise.all(versions.map(v => getMilestonesForVersion(v.id)));
  const taskGroupsPerVersion = await Promise.all(
    milestoneGroups.map(milestones => Promise.all(milestones.map(m => getTasksForMilestone(m.id))))
  );

  const allMilestones = milestoneGroups.flat();
  const activeMilestone = getActiveMilestone(allMilestones, versions);

  if (summaryEl) {
    const allTasks = taskGroupsPerVersion.flat().flat();
    const completeTasks = allTasks.filter(t => t.isComplete).length;
    const totalTasks = allTasks.length;
    const taskPercent = totalTasks === 0 ? 0 : Math.round((completeTasks / totalTasks) * 100);
    const completeV = versions.filter(v => v.isComplete).length;
    const completeM = allMilestones.filter(m => m.isComplete).length;
    summaryEl.innerHTML = `
      <div class="milestone-progress-bar-track">
        <div class="milestone-progress-bar-fill" style="width: ${taskPercent}%"></div>
      </div>
      <span class="milestone-progress-label">${completeV}/${versions.length} V · ${completeM}/${allMilestones.length} M · ${completeTasks}/${totalTasks} tasks</span>
    `;
  }

  container.innerHTML = `
    <div class="version-list">
      ${versions.map((v, i) =>
        renderVersionItem(v, milestoneGroups[i], taskGroupsPerVersion[i], i, versions.length, activeMilestone?.id)
      ).join('')}
    </div>
  `;

  // Version-level events
  versions.forEach((v, i) => {
    const vEl = container.querySelector(`[data-version-id="${v.id}"]`);
    vEl.querySelector('[data-action="version-up"]')?.addEventListener('click', () => reorderVersion(versions, i, -1));
    vEl.querySelector('[data-action="version-down"]')?.addEventListener('click', () => reorderVersion(versions, i, 1));
    vEl.querySelector('[data-action="edit-version"]').addEventListener('click', () => openVersionModal(v));
    vEl.querySelector('[data-action="delete-version"]').addEventListener('click', () => handleDeleteVersion(v));
    vEl.querySelector('[data-action="add-milestone"]').addEventListener('click', () => openMilestoneModal(null, v.id));
  });

  // Milestone-level events
  milestoneGroups.flat().forEach((m) => {
    const milestonesInVersion = milestoneGroups[versions.findIndex(v => v.id === m.versionId)];
    const idxInVersion = milestonesInVersion.findIndex(ms => ms.id === m.id);
    const item = container.querySelector(`[data-milestone-id="${m.id}"]`);
    if (!item) return;
    item.querySelector('[data-action="up"]')?.addEventListener('click', () => reorderMilestone(milestonesInVersion, idxInVersion, -1));
    item.querySelector('[data-action="down"]')?.addEventListener('click', () => reorderMilestone(milestonesInVersion, idxInVersion, 1));
    item.querySelector('[data-action="edit"]').addEventListener('click', () => openMilestoneModal(m, m.versionId));
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

function renderVersionItem(version, milestones, taskGroups, index, total, activeMilestoneId) {
  const totalTasks = taskGroups.flat().length;
  const completeTasks = taskGroups.flat().filter(t => t.isComplete).length;
  const percent = totalTasks === 0 ? 0 : Math.round((completeTasks / totalTasks) * 100);

  return `
    <div class="version-item ${version.isComplete ? 'is-complete' : ''}" data-version-id="${version.id}">
      <div class="version-header">
        <div class="version-reorder">
          <button class="btn-icon" data-action="version-up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn-icon" data-action="version-down" ${index === total - 1 ? 'disabled' : ''}>↓</button>
        </div>
        <div class="version-title-row">
          <span class="version-name">${escapeHtml(version.name)}</span>
          ${version.isComplete ? `<span class="milestone-badge complete">Complete</span>` : ''}
          ${version.description ? `<span class="version-description">${escapeHtml(version.description)}</span>` : ''}
        </div>
        ${totalTasks > 0 ? `
          <div class="version-progress">
            <div class="milestone-progress-bar-track">
              <div class="milestone-progress-bar-fill" style="width: ${percent}%"></div>
            </div>
            <span class="milestone-progress-label">${completeTasks}/${totalTasks} tasks</span>
          </div>
        ` : ''}
        <div class="version-actions">
          <button class="btn btn-ghost" data-action="edit-version" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Edit</button>
          <button class="btn btn-danger" data-action="delete-version" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Delete</button>
        </div>
      </div>
      <div class="version-body">
        ${milestones.length > 0
          ? `<div class="milestone-list">
              ${milestones.map((m, i) => renderMilestoneItem(m, taskGroups[i], i, milestones.length, activeMilestoneId === m.id)).join('')}
             </div>`
          : `<div class="milestones-empty" style="padding: var(--space-3) 0;">No milestones in this version yet.</div>`}
        <button class="task-add-btn" data-action="add-milestone" style="margin-top: var(--space-2);">+ Add Milestone</button>
      </div>
    </div>
  `;
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

function openMilestoneModal(existing, versionId) {
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
        const vid = versionId ?? existing?.versionId ?? null;
        const sibling = vid ? await getMilestonesForVersion(vid) : [];
        await createMilestone({ projectId: currentProjectId, versionId: vid, name, description, order: sibling.length });
      }

      closeModal();
      await renderVersions();
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
        await renderVersions();
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
  const scrollY = window.scrollY;

  const taskEl = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (taskEl) {
    const isNowComplete = !taskEl.classList.contains('is-complete');
    taskEl.classList.toggle('is-complete', isNowComplete);
    const checkbox = taskEl.querySelector('.task-checkbox');
    if (checkbox) checkbox.textContent = isNowComplete ? '✓' : '○';
  }

  const task = await getTask(taskId);
  const nowComplete = !task.isComplete;
  await updateTask(taskId, {
    isComplete: nowComplete,
    completedAt: nowComplete ? Date.now() : null,
  });
  await checkMilestoneCompletion(task.milestoneId);
  await renderProject({ id: currentProjectId });
  window.scrollTo(0, scrollY);
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
  await renderVersions();
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

  await renderVersions();
}

async function reorderVersion(versions, index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= versions.length) return;

  const a = versions[index];
  const b = versions[targetIndex];
  await Promise.all([
    updateVersion(a.id, { order: b.order }),
    updateVersion(b.id, { order: a.order }),
  ]);

  await renderVersions();
}

async function handleDeactivate(project) {
  await updateProject(project.id, { status: 'inactive' });
  await renderProject({ id: String(project.id) });
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
    await renderVersions();
    await renderSessions();
  });
}

function openVersionModal(existing) {
  const isEdit = existing !== null;
  openModal(
    isEdit ? 'Edit Version' : 'New Version',
    `
      <div class="form-field">
        <label class="form-label" for="version-name">Name</label>
        <input class="form-input" id="version-name" type="text" placeholder="e.g. V1, V2, 1.0"
               value="${isEdit ? escapeHtml(existing.name) : ''}" />
      </div>
      <div class="form-field">
        <label class="form-label" for="version-desc">Description</label>
        <textarea class="form-textarea" id="version-desc" placeholder="Optional description">${isEdit ? escapeHtml(existing.description ?? '') : ''}</textarea>
      </div>
    `,
    async (modal) => {
      const name = modal.querySelector('#version-name').value.trim();
      if (!name) return;
      const description = modal.querySelector('#version-desc').value.trim();

      if (isEdit) {
        await updateVersion(existing.id, { name, description });
      } else {
        const all = await getAllVersionsForProject(currentProjectId);
        await createVersion({ projectId: currentProjectId, name, description, order: all.length });
      }

      closeModal();
      await renderVersions();
    },
    isEdit ? 'Save' : 'Create'
  );
}

async function handleDeleteVersion(version) {
  openConfirmModal(
    `Delete version "${escapeHtml(version.name)}"? All milestones and tasks inside it will also be deleted.`,
    async () => {
      closeModal();
      await deleteVersion(version.id);
      await renderVersions();
      await renderSessions();
    }
  );
}

async function renderImportantDates() {
  const container = document.getElementById('date-list-container');
  if (!container) return;

  const dates = await getImportantDatesForProject(currentProjectId);

  if (dates.length === 0) {
    container.innerHTML = `<div class="dates-empty">No important dates yet.</div>`;
    return;
  }

  container.innerHTML = `
    <ul class="date-list">
      ${dates.map(d => `
        <li class="date-item" data-date-id="${d.id}">
          <div class="date-item-body">
            <div class="date-item-main">
              <span class="date-item-date">${formatDateStr(d.date)}</span>
              <span class="date-item-name">${escapeHtml(d.name)}</span>
            </div>
            ${d.note ? `<p class="date-item-note">${escapeHtml(d.note)}</p>` : ''}
          </div>
          <div class="date-item-actions">
            <button class="btn btn-ghost" data-action="edit-date" data-date-id="${d.id}" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Edit</button>
            <button class="btn btn-danger" data-action="delete-date" data-date-id="${d.id}" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Delete</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  container.querySelectorAll('[data-action="edit-date"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = Number(btn.dataset.dateId);
      const date = dates.find(d => d.id === id);
      if (date) openDateModal(date);
    });
  });

  container.querySelectorAll('[data-action="delete-date"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.dateId);
      const date = dates.find(d => d.id === id);
      if (date) handleDeleteDate(date);
    });
  });
}

function openDateModal(existing) {
  const isEdit = existing !== null;
  openModal(
    isEdit ? 'Edit Date' : 'New Important Date',
    `
      <div class="form-field">
        <label class="form-label" for="date-name">Name</label>
        <input class="form-input" id="date-name" type="text" placeholder="e.g. Demo Day, Release, Deadline"
               value="${isEdit ? escapeHtml(existing.name) : ''}" />
      </div>
      <div class="form-field">
        <label class="form-label" for="date-value">Date</label>
        <input class="form-input" id="date-value" type="date"
               value="${isEdit ? existing.date : ''}" />
      </div>
      <div class="form-field">
        <label class="form-label" for="date-note">Note</label>
        <textarea class="form-textarea" id="date-note" placeholder="Optional note">${isEdit ? escapeHtml(existing.note ?? '') : ''}</textarea>
      </div>
    `,
    async (modal) => {
      const name = modal.querySelector('#date-name').value.trim();
      const date = modal.querySelector('#date-value').value;
      if (!name || !date) return;
      const note = modal.querySelector('#date-note').value.trim();

      if (isEdit) {
        await updateImportantDate(existing.id, { name, date, note });
      } else {
        await createImportantDate({ projectId: currentProjectId, name, date, note });
      }

      closeModal();
      await renderImportantDates();
    },
    isEdit ? 'Save' : 'Create'
  );
}

async function handleDeleteDate(date) {
  openConfirmModal(`Delete "${escapeHtml(date.name)}"?`, async () => {
    closeModal();
    await deleteImportantDate(date.id);
    await renderImportantDates();
  });
}

async function renderBacklog() {
  const container = document.getElementById('backlog-list-container');
  if (!container) return;

  const items = await getBacklogForProject(currentProjectId);

  if (items.length === 0) {
    container.innerHTML = `<div class="dates-empty">No backlog items yet.</div>`;
    return;
  }

  container.innerHTML = `
    <ul class="date-list">
      ${items.map((item, i) => `
        <li class="date-item" data-backlog-id="${item.id}">
          <div class="date-item-body">
            <div class="backlog-item-reorder">
              <button class="btn-icon" data-action="backlog-up" data-backlog-id="${item.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="btn-icon" data-action="backlog-down" data-backlog-id="${item.id}" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
            </div>
            <span class="date-item-name">${escapeHtml(item.text)}</span>
          </div>
          <div class="date-item-actions">
            <button class="btn btn-danger" data-action="delete-backlog" data-backlog-id="${item.id}" style="font-size: var(--text-xs); padding: 2px var(--space-3);">Delete</button>
          </div>
        </li>
      `).join('')}
    </ul>
  `;

  container.querySelectorAll('[data-action="delete-backlog"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.backlogId);
      const item = items.find(it => it.id === id);
      if (item) handleDeleteBacklogItem(item);
    });
  });

  container.querySelectorAll('[data-action="backlog-up"]').forEach(btn => {
    btn.addEventListener('click', () => reorderBacklogItem(items, Number(btn.dataset.backlogId), -1));
  });

  container.querySelectorAll('[data-action="backlog-down"]').forEach(btn => {
    btn.addEventListener('click', () => reorderBacklogItem(items, Number(btn.dataset.backlogId), 1));
  });
}

function openBacklogModal() {
  openModal(
    'New Backlog Item',
    `
      <div class="form-field">
        <label class="form-label" for="backlog-text">Item</label>
        <input class="form-input" id="backlog-text" type="text" placeholder="Describe the backlog item" />
      </div>
    `,
    async (modal) => {
      const text = modal.querySelector('#backlog-text').value.trim();
      if (!text) return;
      const existing = await getBacklogForProject(currentProjectId);
      await createBacklogItem({ projectId: currentProjectId, text, order: existing.length });
      closeModal();
      await renderBacklog();
    },
    'Add'
  );
}

async function handleDeleteBacklogItem(item) {
  openConfirmModal(`Delete "${escapeHtml(item.text)}"?`, async () => {
    closeModal();
    await deleteBacklogItem(item.id);
    await renderBacklog();
  });
}

async function reorderBacklogItem(items, itemId, direction) {
  const index = items.findIndex(it => it.id === itemId);
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return;

  const a = items[index];
  const b = items[targetIndex];
  await Promise.all([
    updateBacklogItem(a.id, { order: b.order }),
    updateBacklogItem(b.id, { order: a.order }),
  ]);
  await renderBacklog();
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

function formatDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
