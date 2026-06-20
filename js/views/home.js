import {
  getAllProjects, createProject, updateProject,
  getMilestonesForProject,
  getTasksForMilestone, getTasksForProject, getTask, updateTask,
  createSession,
} from '../db.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../utils/modal.js';
import { getActiveMilestone, checkMilestoneCompletion } from '../utils/milestones.js';

export async function renderHome(_params) {
  const app = document.getElementById('app');

  const allProjects = await getAllProjects();
  const milestoneGroups = await Promise.all(allProjects.map(p => getMilestonesForProject(p.id)));

  const paired = allProjects.map((p, i) => ({ project: p, milestones: milestoneGroups[i] }));
  paired.sort((a, b) => {
    const rank = { active: 0, inactive: 1, complete: 2 };
    const rd = (rank[a.project.status] ?? 1) - (rank[b.project.status] ?? 1);
    return rd !== 0 ? rd : b.project.createdAt - a.project.createdAt;
  });
  const projects = paired.map(x => x.project);
  const milestones = paired.map(x => x.milestones);

  const activeIdx = projects.findIndex(p => p.status === 'active');
  const activeProject = activeIdx >= 0 ? projects[activeIdx] : null;

  let activeMilestone = null;
  let todaysTasks = [];
  if (activeProject) {
    activeMilestone = getActiveMilestone(milestones[activeIdx]);
    if (activeMilestone) {
      todaysTasks = await getTasksForMilestone(activeMilestone.id);
    }
  }

  app.innerHTML = `
    <div class="home-view">
      <aside class="home-sidebar">
        <div class="sidebar-header">
          <span class="sidebar-title">Projects</span>
          <button class="btn btn-primary" id="new-project-btn" style="font-size: var(--text-xs); padding: 2px var(--space-3);">+ New</button>
        </div>
        <div class="sidebar-project-list">
          ${projects.length === 0
            ? `<p class="sidebar-empty">No projects yet.</p>`
            : projects.map((p, i) => renderSidebarItem(p, milestones[i])).join('')}
        </div>
      </aside>
      <main class="home-main">
        <div class="home-main-inner">
          ${activeProject
            ? renderMainActive(activeProject, activeMilestone, todaysTasks)
            : renderMainEmpty()}
        </div>
      </main>
    </div>
  `;

  document.getElementById('new-project-btn').addEventListener('click', () => openNewProjectModal());

  document.querySelectorAll('[data-action="open-project"]').forEach(el => {
    el.addEventListener('click', () => navigate(`/project/${el.dataset.projectId}`));
  });

  document.querySelectorAll('[data-action="toggle-task"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleTask(Number(btn.dataset.taskId)));
  });

  document.getElementById('finish-session-btn')?.addEventListener('click', async () => {
    if (!activeProject || !activeMilestone) return;
    await openSessionModal(activeProject, activeMilestone);
  });

  // Mobile sidebar overlay
  const openSidebarBtn = document.getElementById('open-sidebar-btn');
  const sidebar = document.querySelector('.home-sidebar');
  if (openSidebarBtn && sidebar) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.querySelector('.home-view').appendChild(backdrop);

    const openSidebar = () => {
      sidebar.classList.add('is-open');
      backdrop.classList.add('is-active');
    };
    const closeSidebar = () => {
      sidebar.classList.remove('is-open');
      backdrop.classList.remove('is-active');
    };

    openSidebarBtn.addEventListener('click', openSidebar);
    backdrop.addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) closeSidebar();
    });
    document.querySelectorAll('[data-action="open-project"]').forEach(el => {
      el.addEventListener('click', closeSidebar);
    });
  }
}

function renderSidebarItem(project, milestones) {
  const total = milestones.length;
  const complete = milestones.filter(m => m.isComplete).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);

  return `
    <div class="sidebar-project-item${project.status === 'active' ? ' is-active' : ''}"
         data-project-id="${project.id}" data-action="open-project">
      <div class="sidebar-project-header">
        <span class="sidebar-project-name">${escapeHtml(project.name)}</span>
        <span class="status-badge ${project.status}">${project.status}</span>
      </div>
      <div class="milestone-progress">
        <div class="milestone-progress-bar-track">
          <div class="milestone-progress-bar-fill" style="width: ${percent}%"></div>
        </div>
        <span class="milestone-progress-label">${complete}/${total} milestones</span>
      </div>
    </div>
  `;
}

function renderMainActive(activeProject, activeMilestone, todaysTasks) {
  return `
    <button class="mobile-sidebar-btn" id="open-sidebar-btn">☰ Projects</button>

    <div class="home-greeting">
      <h1 class="home-greeting-title">${escapeHtml(activeProject.name)}</h1>
      <p class="home-active-milestone">
        ${activeMilestone
          ? `Active milestone: ${escapeHtml(activeMilestone.name)}`
          : 'All milestones complete.'}
      </p>
    </div>

    <div class="home-section">
      <h2 class="home-section-title">Today's Tasks</h2>
      ${todaysTasks.length > 0
        ? `<ul class="home-task-list">${todaysTasks.map(renderTodaysTaskItem).join('')}</ul>`
        : `<p class="home-empty-text">${activeMilestone ? 'No remaining tasks in this milestone.' : 'This project is complete.'}</p>`}
    </div>

    <div class="home-footer">
      <button class="btn-finish-session" id="finish-session-btn">Finish Session</button>
    </div>
  `;
}

function renderMainEmpty() {
  return `
    <button class="mobile-sidebar-btn" id="open-sidebar-btn">☰ Projects</button>
    <div class="home-no-active">
      <p class="home-no-active-title">No active project.</p>
      <p class="home-empty-text">Select a project from the sidebar and use <strong>Set Active</strong> to start a session.</p>
    </div>
  `;
}

function renderTodaysTaskItem(task) {
  return `
    <li class="task-item${task.isComplete ? ' is-complete' : ''}" data-task-id="${task.id}">
      <button class="task-checkbox" data-task-id="${task.id}" data-action="toggle-task"
              title="${task.isComplete ? 'Mark incomplete' : 'Mark complete'}">${task.isComplete ? '✓' : '○'}</button>
      <span class="task-name">${escapeHtml(task.name)}</span>
    </li>
  `;
}

async function handleToggleTask(taskId) {
  const task = await getTask(taskId);
  const nowComplete = !task.isComplete;
  await updateTask(taskId, {
    isComplete: nowComplete,
    completedAt: nowComplete ? Date.now() : null,
  });
  await checkMilestoneCompletion(task.milestoneId);
  await renderHome({});
}

function openNewProjectModal() {
  openModal(
    'New Project',
    `
      <div class="form-field">
        <label class="form-label" for="proj-name">Name</label>
        <input class="form-input" id="proj-name" type="text" placeholder="Project name" />
      </div>
      <div class="form-field">
        <label class="form-label" for="proj-desc">Description</label>
        <textarea class="form-textarea" id="proj-desc" placeholder="Optional description"></textarea>
      </div>
    `,
    async (modal) => {
      const name = modal.querySelector('#proj-name').value.trim();
      if (!name) return;
      const description = modal.querySelector('#proj-desc').value.trim();
      await createProject({ name, description });
      closeModal();
      await renderHome({});
    },
    'Create'
  );
}

async function openSessionModal(project, activeMilestone) {
  const allTasks = await getTasksForProject(project.id);
  const since = project.lastSessionAt ?? 0;
  const completedTasks = allTasks.filter(t => t.isComplete && (t.completedAt ?? 0) > since);

  // Derive "not done" from milestones where work actually happened this session.
  // Avoids showing the next milestone's tasks after the previous one auto-completed and
  // advanced the active pointer before Finish Session was clicked.
  // Falls back to the current active milestone only when no tasks were completed.
  const workedMilestoneIds = [...new Set(completedTasks.map(t => t.milestoneId))];
  let notDoneTasks = [];
  if (workedMilestoneIds.length > 0) {
    const groups = await Promise.all(workedMilestoneIds.map(id => getTasksForMilestone(id)));
    notDoneTasks = groups.flat().filter(t => !t.isComplete);
  } else if (activeMilestone) {
    const fallback = await getTasksForMilestone(activeMilestone.id);
    notDoneTasks = fallback.filter(t => !t.isComplete);
  }

  const today = formatDate(Date.now());

  const overlay = document.createElement('div');
  overlay.className = 'session-modal-overlay';
  overlay.innerHTML = `
    <div class="session-modal" role="dialog" aria-modal="true">
      <h2 class="session-modal-title">Finish Session</h2>
      <div class="session-modal-body">

        <div class="session-date">${today}</div>

        <div class="session-block">
          ${completedTasks.length > 0
            ? completedTasks.map(t => `<div class="session-task done">✓ ${escapeHtml(t.name)}</div>`).join('')
            : `<p class="session-tasks-empty">No tasks completed since last session.</p>`}
        </div>

        ${notDoneTasks.length > 0 ? `
          <div class="session-block">
            <div class="session-block-label">Not Done</div>
            ${notDoneTasks.map(t => `<div class="session-task not-done">✗ ${escapeHtml(t.name)}</div>`).join('')}
          </div>
        ` : ''}

        <div class="session-block">
          <div class="session-block-label">Notes</div>
          <textarea class="form-textarea" id="session-notes"
                    placeholder="What happened? Blockers, discoveries, bugs..."></textarea>
        </div>

        <div class="session-block">
          <div class="session-block-label">Next Session</div>
          <textarea class="form-textarea" id="session-next"
                    placeholder="What to pick up next..."></textarea>
        </div>

      </div>
      <div class="session-modal-actions">
        <button class="btn btn-ghost" id="session-cancel">Cancel</button>
        <button class="btn btn-primary" id="session-save">Save Session</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#session-notes').focus();

  const close = () => overlay.remove();

  overlay.querySelector('#session-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  overlay.querySelector('#session-save').addEventListener('click', async () => {
    const notes = overlay.querySelector('#session-notes').value.trim();
    const nextSessionPlan = overlay.querySelector('#session-next').value.trim();
    const notDoneText = notDoneTasks.map(t => t.name).join('\n');

    await createSession({
      projectId: project.id,
      completedTaskIds: completedTasks.map(t => t.id),
      notDoneTasks: notDoneText,
      notes,
      nextSessionPlan,
    });
    await updateProject(project.id, { lastSessionAt: Date.now() });

    close();
    await renderHome({});
  });
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
