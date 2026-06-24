import {
  getAllProjects, createProject, updateProject,
  getAllVersionsForProject, getMilestonesForProject,
  getTasksForMilestone, getTasksForProject, getTask, updateTask,
  createSession,
  createImportantDate, getImportantDatesForProject, updateImportantDate, deleteImportantDate,
  createPlannedSession, getPlannedSessionsForProject, updatePlannedSession, deletePlannedSession,
} from '../db.js';
import { navigate } from '../router.js';
import { openModal, closeModal, openConfirmModal } from '../utils/modal.js';
import { getActiveMilestone, checkMilestoneCompletion } from '../utils/milestones.js';
import { CALENDAR_TOKEN } from '../config.js';

export async function renderHome(_params) {
  const app = document.getElementById('app');

  const allProjects = await getAllProjects();
  const [milestoneGroups, dateGroups, plannedGroups] = await Promise.all([
    Promise.all(allProjects.map(p => getMilestonesForProject(p.id))),
    Promise.all(allProjects.map(p => getImportantDatesForProject(p.id))),
    Promise.all(allProjects.map(p => getPlannedSessionsForProject(p.id))),
  ]);
  const allDates = dateGroups.flat();
  const allPlanned = plannedGroups.flat();
  const calEvents = [
    ...allDates.map(d => ({ ...d, eventType: 'date' })),
    ...allPlanned.map(s => ({ ...s, eventType: 'session' })),
  ];
  const projectNameMap = Object.fromEntries(allProjects.map(p => [p.id, p.name]));

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

  const activeVersions = activeProject ? await getAllVersionsForProject(activeProject.id) : [];

  let activeMilestone = null;
  if (activeProject) {
    activeMilestone = getActiveMilestone(milestones[activeIdx], activeVersions);
  }

  // Session state
  let activeSession = JSON.parse(localStorage.getItem('pm-active-session') ?? 'null');
  const sessionValid = activeSession && projects.find(
    p => p.id === activeSession.projectId && p.status === 'active'
  );
  if (activeSession && !sessionValid) {
    localStorage.removeItem('pm-active-session');
    activeSession = null;
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysPlannedSession = activeProject
    ? allPlanned.find(s => s.projectId === activeProject.id && s.date === todayStr)
    : null;

  let sessionTasks = [];
  if (activeSession) {
    const fetched = await Promise.all(activeSession.taskIds.map(id => getTask(id)));
    sessionTasks = fetched.filter(Boolean);
  }

  const alertsHtml = buildAlertsHtml(allDates, projectNameMap);

  let mainHtml;
  if (!activeProject) {
    mainHtml = renderMainEmpty();
  } else if (activeSession) {
    mainHtml = renderMainSession(activeProject, activeMilestone, sessionTasks, activeSession, alertsHtml);
  } else if (todaysPlannedSession) {
    mainHtml = renderMainPrompt(activeProject, activeMilestone, todaysPlannedSession, alertsHtml);
  } else {
    mainHtml = renderMainIdle(activeProject, activeMilestone, alertsHtml);
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
          ${mainHtml}
        </div>
      </main>
      <aside class="home-calendar-sidebar">
        <div class="calendar-sidebar-header">
          <span class="calendar-sidebar-title">Calendar</span>
        </div>
        <div id="calendar-container"></div>
        <div class="cal-feed-section">
          <span class="cal-feed-label">Calendar Feed</span>
          <div class="cal-feed-row">
            <input class="cal-feed-input" id="cal-feed-input" readonly
              value="${window.location.origin}/api/calendar/${CALENDAR_TOKEN}" />
            <button class="cal-feed-copy-btn" id="cal-feed-copy-btn">Copy</button>
          </div>
        </div>
      </aside>
    </div>
  `;

  document.getElementById('new-project-btn').addEventListener('click', () => openNewProjectModal());

  document.querySelectorAll('[data-action="open-project"]').forEach(el => {
    el.addEventListener('click', () => navigate(`/project/${el.dataset.projectId}`));
  });

  document.querySelectorAll('[data-action="toggle-task"]').forEach(btn => {
    btn.addEventListener('click', () => handleToggleTask(Number(btn.dataset.taskId)));
  });

  const calContainer = document.getElementById('calendar-container');
  if (calContainer) {
    const now = new Date();
    renderCalendar(calContainer, calEvents, projectNameMap, projects, now.getMonth(), now.getFullYear());
  }

  document.getElementById('cal-feed-copy-btn')?.addEventListener('click', () => {
    const feedUrl = `${window.location.origin}/api/calendar/${CALENDAR_TOKEN}`;
    const btn = document.getElementById('cal-feed-copy-btn');
    navigator.clipboard.writeText(feedUrl).then(() => {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    }).catch(() => {
      document.getElementById('cal-feed-input')?.select();
    });
  });

  document.getElementById('finish-session-btn')?.addEventListener('click', async () => {
    if (!activeProject) return;
    await openSessionModal(activeProject, activeMilestone, activeSession);
  });

  document.getElementById('start-session-btn')?.addEventListener('click', async () => {
    if (!activeProject || !activeMilestone) return;
    await openStartSessionModal(activeProject, activeMilestone, null);
  });

  document.getElementById('start-planned-btn')?.addEventListener('click', () => {
    if (!activeProject || !todaysPlannedSession) return;
    localStorage.setItem('pm-active-session', JSON.stringify({
      projectId: activeProject.id,
      milestoneId: activeMilestone?.id ?? null,
      type: todaysPlannedSession.type,
      taskIds: todaysPlannedSession.taskIds,
      startedAt: Date.now(),
      plannedSessionId: todaysPlannedSession.id,
    }));
    renderHome({});
  });

  document.getElementById('start-adhoc-btn')?.addEventListener('click', async () => {
    if (!activeProject || !activeMilestone) return;
    await openStartSessionModal(activeProject, activeMilestone, null);
  });

  // Mobile sidebar overlays (projects left, calendar right — opening one closes the other)
  const openSidebarBtn = document.getElementById('open-sidebar-btn');
  const openCalendarBtn = document.getElementById('open-calendar-btn');
  const sidebar = document.querySelector('.home-sidebar');
  const calSidebar = document.querySelector('.home-calendar-sidebar');
  const homeView = document.querySelector('.home-view');

  if (homeView) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    homeView.appendChild(backdrop);

    const closeAll = () => {
      sidebar?.classList.remove('is-open');
      calSidebar?.classList.remove('is-open');
      backdrop.classList.remove('is-active');
    };

    openSidebarBtn?.addEventListener('click', () => {
      calSidebar?.classList.remove('is-open');
      sidebar?.classList.add('is-open');
      backdrop.classList.add('is-active');
    });

    openCalendarBtn?.addEventListener('click', () => {
      sidebar?.classList.remove('is-open');
      calSidebar?.classList.add('is-open');
      backdrop.classList.add('is-active');
    });

    backdrop.addEventListener('click', closeAll);
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') closeAll();
    });
    document.querySelectorAll('[data-action="open-project"]').forEach(el => {
      el.addEventListener('click', closeAll);
    });
  }
}

<<<<<<< HEAD
function renderSidebarItem(project, milestones, versions) {
  const mTotal = milestones.length;
  const mComplete = milestones.filter(m => m.isComplete).length;
  const percent = mTotal === 0 ? 0 : Math.round((mComplete / mTotal) * 100);

  const vTotal = versions?.length ?? 0;
  const vComplete = versions?.filter(v => v.isComplete).length ?? 0;
  const label = vTotal > 0
    ? `${vComplete}/${vTotal}V · ${mComplete}/${mTotal}M`
    : `${mComplete}/${mTotal}M`;
=======
function renderSidebarItem(project, milestones) {
  const total = milestones.length;
  const complete = milestones.filter(m => m.isComplete).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
>>>>>>> parent of 9ada40f (Progress display: X/Y versions · X/Y milestones in sidebar and project header)

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

function mobileTopBar() {
  return `
    <div class="mobile-top-bar">
      <button class="mobile-sidebar-btn" id="open-sidebar-btn">☰ Projects</button>
      <button class="mobile-sidebar-btn" id="open-calendar-btn">Calendar ☰</button>
    </div>
  `;
}

function projectHeader(activeProject, activeMilestone) {
  return `
    <div class="home-greeting">
      <h1 class="home-greeting-title">${escapeHtml(activeProject.name)}</h1>
      <p class="home-active-milestone">
        ${activeMilestone
          ? `Active milestone: ${escapeHtml(activeMilestone.name)}`
          : 'All milestones complete.'}
      </p>
    </div>
  `;
}

function renderMainSession(activeProject, activeMilestone, sessionTasks, activeSession, alertsHtml) {
  const allDone = sessionTasks.length > 0 && sessionTasks.every(t => t.isComplete);
  const typeLabel = activeSession.type.charAt(0).toUpperCase() + activeSession.type.slice(1);
  return `
    ${mobileTopBar()}
    ${projectHeader(activeProject, activeMilestone)}
    ${alertsHtml}
    <div class="home-section">
      <div class="home-session-meta">${typeLabel} session in progress</div>
      ${sessionTasks.length > 0
        ? `<ul class="home-task-list">${sessionTasks.map(renderTodaysTaskItem).join('')}</ul>`
        : `<p class="home-empty-text">No tasks in this session.</p>`}
      ${allDone ? `<p class="home-session-done">All tasks done — ready to finish.</p>` : ''}
    </div>
    <div class="home-footer">
      <button class="btn-finish-session" id="finish-session-btn">Finish Session</button>
    </div>
  `;
}

function renderMainPrompt(activeProject, activeMilestone, plannedSession, alertsHtml) {
  const typeLabel = plannedSession.type.charAt(0).toUpperCase() + plannedSession.type.slice(1);
  const taskCount = plannedSession.taskIds?.length ?? 0;
  return `
    ${mobileTopBar()}
    ${projectHeader(activeProject, activeMilestone)}
    ${alertsHtml}
    <div class="home-section">
      <div class="home-prompt-card">
        <p class="home-prompt-title">${typeLabel} session planned for today</p>
        ${taskCount > 0 ? `<p class="home-prompt-meta">${taskCount} task${taskCount !== 1 ? 's' : ''}</p>` : ''}
        <div class="home-prompt-actions">
          <button class="btn btn-primary" id="start-planned-btn">Start This Session</button>
          <button class="btn btn-ghost" id="start-adhoc-btn">Start Different</button>
        </div>
      </div>
    </div>
  `;
}

function renderMainIdle(activeProject, activeMilestone, alertsHtml) {
  return `
    ${mobileTopBar()}
    ${projectHeader(activeProject, activeMilestone)}
    ${alertsHtml}
    <div class="home-section">
      <div class="home-idle-section">
        <p class="home-idle-text">No active session.</p>
        <button class="btn-start-session" id="start-session-btn">Start Session</button>
      </div>
    </div>
  `;
}

function renderMainEmpty() {
  return `
    ${mobileTopBar()}
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

async function openStartSessionModal(activeProject, activeMilestone, _unused) {
  const typeSlices = { small: 2, mid: 5, big: Infinity };
  let selectedType = null;

  const overlay = document.createElement('div');
  overlay.className = 'session-modal-overlay';
  overlay.innerHTML = `
    <div class="session-modal" style="max-width:400px" role="dialog" aria-modal="true">
      <h2 class="session-modal-title">Start Session</h2>
      <div class="session-modal-body">
        <div class="form-field">
          <label class="form-label">Session Type</label>
          <div class="session-type-toggle">
            <button class="session-type-btn" data-type="small" type="button">Small</button>
            <button class="session-type-btn" data-type="mid" type="button">Mid</button>
            <button class="session-type-btn" data-type="big" type="button">Big</button>
          </div>
        </div>
        <div id="start-task-preview" class="plan-task-preview"></div>
      </div>
      <div class="session-modal-actions">
        <button class="btn btn-ghost" id="start-modal-cancel">Cancel</button>
        <button class="btn btn-primary" id="start-modal-confirm">Start</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#start-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  const allMilestoneTasks = activeMilestone
    ? (await getTasksForMilestone(activeMilestone.id)).filter(t => !t.isComplete)
    : [];
  const preview = overlay.querySelector('#start-task-preview');

  overlay.querySelectorAll('.session-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedType = btn.dataset.type;
      const limit = typeSlices[selectedType] ?? Infinity;
      const suggested = allMilestoneTasks.slice(0, limit);
      if (suggested.length === 0) {
        preview.innerHTML = '<p class="plan-task-empty">No remaining tasks in active milestone.</p>';
      } else {
        preview.innerHTML = `
          <ul class="plan-task-list">
            ${suggested.map(t => `
              <li class="plan-task-item">
                <span class="plan-task-label">${escapeHtml(t.name)}</span>
              </li>
            `).join('')}
          </ul>
        `;
      }
    });
  });

  overlay.querySelector('#start-modal-confirm').addEventListener('click', async () => {
    if (!selectedType) return;
    const limit = typeSlices[selectedType] ?? Infinity;
    const taskIds = allMilestoneTasks.slice(0, limit).map(t => t.id);
    localStorage.setItem('pm-active-session', JSON.stringify({
      projectId: activeProject.id,
      milestoneId: activeMilestone?.id ?? null,
      type: selectedType,
      taskIds,
      startedAt: Date.now(),
      plannedSessionId: null,
    }));
    close();
    await renderHome({});
  });
}

async function openSessionModal(project, activeMilestone, activeSession) {
  const [allTasks, milestoneTasks] = await Promise.all([
    getTasksForProject(project.id),
    activeMilestone ? getTasksForMilestone(activeMilestone.id) : Promise.resolve([]),
  ]);
  const remainingTasks = milestoneTasks.filter(t => !t.isComplete);
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

        <div class="session-block session-plan-block">
          <div class="session-block-label">Plan Next Session <span class="session-plan-optional">(optional)</span></div>
          <div class="session-plan-row">
            <input class="form-input" id="plan-date" type="date" />
            <div class="session-type-toggle">
              <button class="session-type-btn" data-type="small" type="button">Small</button>
              <button class="session-type-btn" data-type="mid" type="button">Mid</button>
              <button class="session-type-btn" data-type="big" type="button">Big</button>
            </div>
          </div>
          <div id="plan-task-preview" class="plan-task-preview"></div>
          <textarea class="form-textarea" id="plan-note" placeholder="Optional note for this session"></textarea>
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

  // Next session planning — type toggle + task preview
  const typeSlices = { small: 2, mid: 5, big: Infinity };
  let selectedType = null;
  const taskPreview = overlay.querySelector('#plan-task-preview');

  overlay.querySelectorAll('.session-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedType = btn.dataset.type;

      const limit = typeSlices[selectedType] ?? Infinity;
      const suggested = remainingTasks.slice(0, limit);

      if (suggested.length === 0) {
        taskPreview.innerHTML = '<p class="plan-task-empty">No remaining tasks in active milestone.</p>';
        return;
      }

      taskPreview.innerHTML = `
        <ul class="plan-task-list">
          ${suggested.map(t => `
            <li class="plan-task-item">
              <label class="plan-task-label">
                <input class="plan-task-check" type="checkbox" value="${t.id}" checked />
                <span>${escapeHtml(t.name)}</span>
              </label>
            </li>
          `).join('')}
        </ul>
      `;
    });
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

    // Clear active session and delete consumed planned session if applicable
    localStorage.removeItem('pm-active-session');
    if (activeSession?.plannedSessionId) {
      await deletePlannedSession(activeSession.plannedSessionId);
    }

    // Optional: save planned session
    const planDate = overlay.querySelector('#plan-date').value;
    if (planDate && selectedType) {
      const checkedBoxes = [...overlay.querySelectorAll('.plan-task-check:checked')];
      const taskIds = checkedBoxes.map(cb => Number(cb.value));
      const planNote = overlay.querySelector('#plan-note').value.trim();
      await createPlannedSession({
        projectId: project.id,
        date: planDate,
        type: selectedType,
        taskIds,
        note: planNote,
      });
    }

    close();
    await renderHome({});
  });
}

function getDaysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target - today) / 86400000);
}

function formatDaysUntil(n) {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  return `in ${n} days`;
}

function buildAlertsHtml(allDates, projectNameMap) {
  const upcoming = allDates
    .map(d => ({ ...d, daysUntil: getDaysUntil(d.date) }))
    .filter(d => d.daysUntil >= 0 && d.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  if (upcoming.length === 0) return '';

  return `
    <div class="home-alerts">
      ${upcoming.map(d => `
        <div class="home-alert-item">
          <span class="home-alert-name">${escapeHtml(d.name)}</span>
          <span class="home-alert-meta">— ${escapeHtml(projectNameMap[d.projectId] ?? '')} · ${formatDaysUntil(d.daysUntil)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderCalendar(container, events, projectNameMap, allProjects, month, year) {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  const dateMap = {};
  for (const e of events) {
    if (!dateMap[e.date]) dateMap[e.date] = [];
    dateMap[e.date].push(e);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0, Sun=6

  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push('<div class="cal-day cal-day-empty"></div>');
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const key = `${year}-${mm}-${dd}`;
    const hasDates = !!dateMap[key];
    const isToday = year === todayYear && month === todayMonth && d === todayDate;
    cells.push(`
      <div class="cal-day${isToday ? ' is-today' : ''}${hasDates ? ' has-dates' : ''}"
           data-day="${d}" data-key="${key}">
        <span class="cal-day-num">${d}</span>
        ${hasDates ? '<span class="cal-dot"></span>' : ''}
      </div>
    `);
  }

  container.innerHTML = `
    <div class="calendar">
      <div class="cal-header">
        <button class="btn btn-ghost btn-icon" id="cal-prev">‹</button>
        <span class="cal-month-label">${MONTH_NAMES[month]} ${year}</span>
        <button class="btn btn-ghost btn-icon" id="cal-next">›</button>
      </div>
      <div class="cal-grid">
        <div class="cal-weekday">Mo</div>
        <div class="cal-weekday">Tu</div>
        <div class="cal-weekday">We</div>
        <div class="cal-weekday">Th</div>
        <div class="cal-weekday">Fr</div>
        <div class="cal-weekday">Sa</div>
        <div class="cal-weekday">Su</div>
        ${cells.join('')}
      </div>
      <div class="cal-day-panel"></div>
    </div>
  `;

  container.querySelector('#cal-prev').addEventListener('click', () => {
    let m = month - 1, y = year;
    if (m < 0) { m = 11; y--; }
    renderCalendar(container, events, projectNameMap, allProjects, m, y);
  });

  container.querySelector('#cal-next').addEventListener('click', () => {
    let m = month + 1, y = year;
    if (m > 11) { m = 0; y++; }
    renderCalendar(container, events, projectNameMap, allProjects, m, y);
  });

  let selectedDay = null;
  const panel = container.querySelector('.cal-day-panel');

  // All real days are clickable
  container.querySelectorAll('.cal-day:not(.cal-day-empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      const day = Number(cell.dataset.day);
      const key = cell.dataset.key;

      if (selectedDay === day) {
        selectedDay = null;
        cell.classList.remove('is-selected');
        panel.innerHTML = '';
        return;
      }

      container.querySelectorAll('.cal-day.is-selected').forEach(c => c.classList.remove('is-selected'));
      selectedDay = day;
      cell.classList.add('is-selected');

      const entries = dateMap[key] || [];

      panel.innerHTML = `
        ${entries.length > 0 ? `
          <ul class="cal-panel-list">
            ${entries.map((e, idx) => {
              if (e.eventType === 'session') {
                const label = e.type.charAt(0).toUpperCase() + e.type.slice(1) + ' session';
                return `
                  <li class="cal-panel-item cal-panel-item--session" data-entry-idx="${idx}">
                    <span class="cal-panel-name">${escapeHtml(label)}</span>
                    <span class="cal-panel-project">${escapeHtml(projectNameMap[e.projectId] ?? '')}</span>
                    ${e.note ? `<p class="cal-panel-note">${escapeHtml(e.note)}</p>` : ''}
                  </li>
                `;
              }
              return `
                <li class="cal-panel-item" data-entry-idx="${idx}">
                  <span class="cal-panel-name">${escapeHtml(e.name)}</span>
                  <span class="cal-panel-project">${escapeHtml(projectNameMap[e.projectId] ?? '')}</span>
                  ${e.note ? `<p class="cal-panel-note">${escapeHtml(e.note)}</p>` : ''}
                </li>
              `;
            }).join('')}
          </ul>
        ` : ''}
        <button class="cal-panel-add-btn" data-key="${key}">+ Schedule</button>
      `;

      // Wire panel entry clicks → edit modals
      panel.querySelectorAll('.cal-panel-item').forEach(item => {
        item.addEventListener('click', () => {
          const e = entries[Number(item.dataset.entryIdx)];
          if (e.eventType === 'date') {
            openEditDateModal(e, container, projectNameMap, allProjects, month, year);
          } else {
            openEditSessionModal(e, container, projectNameMap, allProjects, month, year);
          }
        });
      });

      // Wire "+ Schedule" button
      panel.querySelector('.cal-panel-add-btn').addEventListener('click', () => {
        openScheduleModal(key, container, projectNameMap, allProjects, month, year);
      });
    });
  });
}

async function refreshCalendar(container, projectNameMap, allProjects, month, year) {
  const [dateGroups, plannedGroups] = await Promise.all([
    Promise.all(allProjects.map(p => getImportantDatesForProject(p.id))),
    Promise.all(allProjects.map(p => getPlannedSessionsForProject(p.id))),
  ]);
  const calEvents = [
    ...dateGroups.flat().map(d => ({ ...d, eventType: 'date' })),
    ...plannedGroups.flat().map(s => ({ ...s, eventType: 'session' })),
  ];
  renderCalendar(container, calEvents, projectNameMap, allProjects, month, year);
}

async function openEditDateModal(dateEvent, container, projectNameMap, allProjects, month, year) {
  const overlay = document.createElement('div');
  overlay.className = 'session-modal-overlay';
  overlay.innerHTML = `
    <div class="session-modal" role="dialog" aria-modal="true">
      <h2 class="session-modal-title">Edit Important Date</h2>
      <p class="cal-modal-project">${escapeHtml(projectNameMap[dateEvent.projectId] ?? '')}</p>
      <div class="session-modal-body">
        <div class="form-field">
          <label class="form-label" for="edit-date-name">Name</label>
          <input class="form-input" id="edit-date-name" type="text" value="${escapeHtml(dateEvent.name)}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="edit-date-value">Date</label>
          <input class="form-input" id="edit-date-value" type="date" value="${dateEvent.date}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="edit-date-note">Note</label>
          <textarea class="form-textarea" id="edit-date-note">${escapeHtml(dateEvent.note ?? '')}</textarea>
        </div>
      </div>
      <div class="session-modal-actions cal-modal-actions">
        <button class="btn btn-danger" id="cal-modal-delete">Delete</button>
        <div class="cal-modal-right">
          <button class="btn btn-ghost" id="cal-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="cal-modal-save">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#edit-date-name').focus();

  const close = () => overlay.remove();
  overlay.querySelector('#cal-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  overlay.querySelector('#cal-modal-save').addEventListener('click', async () => {
    const name = overlay.querySelector('#edit-date-name').value.trim();
    const date = overlay.querySelector('#edit-date-value').value;
    if (!name || !date) return;
    const note = overlay.querySelector('#edit-date-note').value.trim();
    await updateImportantDate(dateEvent.id, { name, date, note });
    close();
    await refreshCalendar(container, projectNameMap, allProjects, month, year);
  });

  overlay.querySelector('#cal-modal-delete').addEventListener('click', () => {
    close();
    openConfirmModal(`Delete "${escapeHtml(dateEvent.name)}"?`, async () => {
      await deleteImportantDate(dateEvent.id);
      closeModal();
      await refreshCalendar(container, projectNameMap, allProjects, month, year);
    });
  });
}

async function openEditSessionModal(sessionEvent, container, projectNameMap, allProjects, month, year) {
  const [milestones, versions] = await Promise.all([
    getMilestonesForProject(sessionEvent.projectId),
    getAllVersionsForProject(sessionEvent.projectId),
  ]);
  const activeMilestone = getActiveMilestone(milestones, versions);
  const milestoneTasks = activeMilestone
    ? (await getTasksForMilestone(activeMilestone.id)).filter(t => !t.isComplete)
    : [];

  const storedIds = new Set(sessionEvent.taskIds ?? []);
  const typeSlices = { small: 2, mid: 5, big: Infinity };
  let selectedType = sessionEvent.type;

  function buildTaskCheckboxes(type, currentlyChecked = storedIds) {
    const limit = typeSlices[type] ?? Infinity;
    const suggested = milestoneTasks.slice(0, limit);
    if (suggested.length === 0) return '<p class="plan-task-empty">No remaining tasks in active milestone.</p>';
    return `
      <ul class="plan-task-list">
        ${suggested.map(t => `
          <li class="plan-task-item">
            <label class="plan-task-label">
              <input class="plan-task-check" type="checkbox" value="${t.id}" ${currentlyChecked.has(t.id) ? 'checked' : ''} />
              <span>${escapeHtml(t.name)}</span>
            </label>
          </li>
        `).join('')}
      </ul>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'session-modal-overlay';
  overlay.innerHTML = `
    <div class="session-modal" role="dialog" aria-modal="true">
      <h2 class="session-modal-title">Edit Planned Session</h2>
      <p class="cal-modal-project">${escapeHtml(projectNameMap[sessionEvent.projectId] ?? '')}</p>
      <div class="session-modal-body">
        <div class="form-field">
          <label class="form-label">Session Type</label>
          <div class="session-type-toggle">
            <button class="session-type-btn${selectedType === 'small' ? ' is-active' : ''}" data-type="small" type="button">Small</button>
            <button class="session-type-btn${selectedType === 'mid' ? ' is-active' : ''}" data-type="mid" type="button">Mid</button>
            <button class="session-type-btn${selectedType === 'big' ? ' is-active' : ''}" data-type="big" type="button">Big</button>
          </div>
        </div>
        <div id="edit-session-tasks" class="plan-task-preview">
          ${buildTaskCheckboxes(selectedType)}
        </div>
        <div class="form-field">
          <label class="form-label" for="edit-session-note">Note</label>
          <textarea class="form-textarea" id="edit-session-note">${escapeHtml(sessionEvent.note ?? '')}</textarea>
        </div>
      </div>
      <div class="session-modal-actions cal-modal-actions">
        <button class="btn btn-danger" id="cal-modal-delete">Delete</button>
        <div class="cal-modal-right">
          <button class="btn btn-ghost" id="cal-modal-cancel">Cancel</button>
          <button class="btn btn-primary" id="cal-modal-save">Save</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  const taskPreview = overlay.querySelector('#edit-session-tasks');

  overlay.querySelector('#cal-modal-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  overlay.querySelectorAll('.session-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const currentlyChecked = new Set(
        [...overlay.querySelectorAll('.plan-task-check:checked')].map(cb => Number(cb.value))
      );
      overlay.querySelectorAll('.session-type-btn').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedType = btn.dataset.type;
      taskPreview.innerHTML = buildTaskCheckboxes(selectedType, currentlyChecked);
    });
  });

  overlay.querySelector('#cal-modal-save').addEventListener('click', async () => {
    const taskIds = [...overlay.querySelectorAll('.plan-task-check:checked')].map(cb => Number(cb.value));
    const note = overlay.querySelector('#edit-session-note').value.trim();
    await updatePlannedSession(sessionEvent.id, { type: selectedType, taskIds, note });
    close();
    await refreshCalendar(container, projectNameMap, allProjects, month, year);
  });

  overlay.querySelector('#cal-modal-delete').addEventListener('click', () => {
    close();
    openConfirmModal('Delete this planned session?', async () => {
      await deletePlannedSession(sessionEvent.id);
      closeModal();
      await refreshCalendar(container, projectNameMap, allProjects, month, year);
    });
  });
}

async function openScheduleModal(dateKey, container, projectNameMap, allProjects, month, year) {
  let schedType = 'date';
  let schedSessionType = null;
  const typeSlices = { small: 2, mid: 5, big: Infinity };

  const overlay = document.createElement('div');
  overlay.className = 'session-modal-overlay';
  overlay.innerHTML = `
    <div class="session-modal" role="dialog" aria-modal="true">
      <h2 class="session-modal-title">Schedule</h2>
      <div class="session-modal-body">
        <div class="form-field">
          <label class="form-label" for="sched-date">Date</label>
          <input class="form-input" id="sched-date" type="date" value="${dateKey}" />
        </div>
        <div class="form-field">
          <label class="form-label" for="sched-project">Project</label>
          <select class="form-input" id="sched-project">
            <option value="">Select a project...</option>
            ${allProjects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label class="form-label">Type</label>
          <div class="session-type-toggle">
            <button class="session-type-btn is-active" data-sched-type="date" type="button">Important Date</button>
            <button class="session-type-btn" data-sched-type="session" type="button">Planned Session</button>
          </div>
        </div>
        <div id="sched-dynamic-fields">
          <div class="form-field">
            <label class="form-label" for="sched-name">Name</label>
            <input class="form-input" id="sched-name" type="text" placeholder="e.g. Demo Day, Release" />
          </div>
          <div class="form-field">
            <label class="form-label" for="sched-note">Note</label>
            <textarea class="form-textarea" id="sched-note" placeholder="Optional note"></textarea>
          </div>
        </div>
      </div>
      <div class="session-modal-actions">
        <button class="btn btn-ghost" id="sched-cancel">Cancel</button>
        <button class="btn btn-primary" id="sched-save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector('#sched-project').focus();

  const close = () => overlay.remove();
  const dynamicFields = overlay.querySelector('#sched-dynamic-fields');

  overlay.querySelector('#sched-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  function renderDateFields() {
    return `
      <div class="form-field">
        <label class="form-label" for="sched-name">Name</label>
        <input class="form-input" id="sched-name" type="text" placeholder="e.g. Demo Day, Release" />
      </div>
      <div class="form-field">
        <label class="form-label" for="sched-note">Note</label>
        <textarea class="form-textarea" id="sched-note" placeholder="Optional note"></textarea>
      </div>
    `;
  }

  function renderSessionFields() {
    return `
      <div class="form-field">
        <label class="form-label">Session Size</label>
        <div class="session-type-toggle" id="sched-size-toggle">
          <button class="session-type-btn" data-size="small" type="button">Small</button>
          <button class="session-type-btn" data-size="mid" type="button">Mid</button>
          <button class="session-type-btn" data-size="big" type="button">Big</button>
        </div>
      </div>
      <div id="sched-task-preview" class="plan-task-preview"></div>
      <div class="form-field">
        <label class="form-label" for="sched-session-note">Note</label>
        <textarea class="form-textarea" id="sched-session-note" placeholder="Optional note"></textarea>
      </div>
    `;
  }

  async function updateTaskPreview() {
    const projectId = Number(overlay.querySelector('#sched-project').value);
    const preview = dynamicFields.querySelector('#sched-task-preview');
    if (!preview || !projectId || !schedSessionType) return;

    const [milestones, versions] = await Promise.all([
      getMilestonesForProject(projectId),
      getAllVersionsForProject(projectId),
    ]);
    const activeMilestone = getActiveMilestone(milestones, versions);
    if (!activeMilestone) {
      preview.innerHTML = '<p class="plan-task-empty">No active milestone for this project.</p>';
      return;
    }
    const tasks = (await getTasksForMilestone(activeMilestone.id)).filter(t => !t.isComplete);
    const suggested = tasks.slice(0, typeSlices[schedSessionType] ?? Infinity);
    if (suggested.length === 0) {
      preview.innerHTML = '<p class="plan-task-empty">No remaining tasks in active milestone.</p>';
      return;
    }
    preview.innerHTML = `
      <ul class="plan-task-list">
        ${suggested.map(t => `
          <li class="plan-task-item">
            <label class="plan-task-label">
              <input class="plan-task-check" type="checkbox" value="${t.id}" checked />
              <span>${escapeHtml(t.name)}</span>
            </label>
          </li>
        `).join('')}
      </ul>
    `;
  }

  function wireSessionSizeButtons() {
    dynamicFields.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', async () => {
        dynamicFields.querySelectorAll('[data-size]').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        schedSessionType = btn.dataset.size;
        await updateTaskPreview();
      });
    });
  }

  // Outer type toggle (Important Date vs Planned Session)
  overlay.querySelectorAll('[data-sched-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('[data-sched-type]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      schedType = btn.dataset.schedType;
      schedSessionType = null;
      if (schedType === 'date') {
        dynamicFields.innerHTML = renderDateFields();
      } else {
        dynamicFields.innerHTML = renderSessionFields();
        wireSessionSizeButtons();
      }
    });
  });

  // Project change → refresh task preview for session type
  overlay.querySelector('#sched-project').addEventListener('change', async () => {
    if (schedType === 'session' && schedSessionType) await updateTaskPreview();
  });

  overlay.querySelector('#sched-save').addEventListener('click', async () => {
    const date = overlay.querySelector('#sched-date').value;
    const projectId = Number(overlay.querySelector('#sched-project').value);
    if (!date || !projectId) return;

    if (schedType === 'date') {
      const name = dynamicFields.querySelector('#sched-name')?.value.trim();
      if (!name) return;
      const note = dynamicFields.querySelector('#sched-note')?.value.trim() ?? '';
      await createImportantDate({ projectId, name, date, note });
    } else {
      if (!schedSessionType) return;
      const taskIds = [...dynamicFields.querySelectorAll('.plan-task-check:checked')].map(cb => Number(cb.value));
      const note = dynamicFields.querySelector('#sched-session-note')?.value.trim() ?? '';
      await createPlannedSession({ projectId, date, type: schedSessionType, taskIds, note });
    }

    close();
    await refreshCalendar(container, projectNameMap, allProjects, month, year);
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
