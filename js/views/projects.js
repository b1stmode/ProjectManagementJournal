import { getAllProjects, createProject, updateProject, deleteProject } from '../db.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../utils/modal.js';

export async function renderProjects(_params) {
  document.getElementById('app').innerHTML = `
    <div class="projects-view">
      <div class="projects-view-header">
        <h1 class="projects-view-title">Projects</h1>
        <button class="btn btn-primary" id="new-project-btn">+ New Project</button>
      </div>
      <div id="project-list-container"></div>
    </div>
  `;

  document.getElementById('new-project-btn').addEventListener('click', openCreateModal);
  await loadAndRender();
}

async function loadAndRender() {
  const container = document.getElementById('project-list-container');
  if (!container) return;

  const projects = await getAllProjects();
  projects.sort((a, b) => b.createdAt - a.createdAt);

  if (projects.length === 0) {
    container.innerHTML = `<p class="projects-empty">No projects yet. Create one to get started.</p>`;
    return;
  }

  container.innerHTML = `
    <div class="project-list">
      ${projects.map(renderProjectCard).join('')}
    </div>
  `;

  projects.forEach(p => {
    const card = container.querySelector(`[data-project-id="${p.id}"]`);
    card.querySelector('.project-card-info').addEventListener('click', () => navigate(`/project/${p.id}`));
    card.querySelector('[data-action="set-active"]')?.addEventListener('click', () => handleSetActive(p.id));
    card.querySelector('[data-action="delete"]').addEventListener('click', () => handleDelete(p));
  });
}

function renderProjectCard(project) {
  const canSetActive = project.status !== 'active' && project.status !== 'complete';
  return `
    <div class="project-card ${project.status === 'active' ? 'is-active' : ''}" data-project-id="${project.id}">
      <div class="project-card-info">
        <div class="project-card-name">${escapeHtml(project.name)}</div>
        <div class="project-card-meta">
          <span class="status-badge ${project.status}">${project.status}</span>
        </div>
      </div>
      <div class="project-card-actions">
        ${canSetActive ? `<button class="btn btn-ghost" data-action="set-active">Set Active</button>` : ''}
        <button class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </div>
  `;
}

function openCreateModal() {
  openModal('New Project', `
    <div class="form-field">
      <label class="form-label" for="project-name">Name</label>
      <input class="form-input" id="project-name" type="text" placeholder="Project name" />
    </div>
    <div class="form-field">
      <label class="form-label" for="project-desc">Description</label>
      <textarea class="form-textarea" id="project-desc" placeholder="Optional description"></textarea>
    </div>
  `, async (modal) => {
    const name = modal.querySelector('#project-name').value.trim();
    if (!name) return;
    await createProject({ name, description: modal.querySelector('#project-desc').value.trim() });
    closeModal();
    await loadAndRender();
  }, 'Create');
}

async function handleSetActive(id) {
  const all = await getAllProjects();
  await Promise.all(all.map(p =>
    updateProject(p.id, {
      status: p.id === id ? 'active' : (p.status === 'active' ? 'inactive' : p.status),
    })
  ));
  await loadAndRender();
}

async function handleDelete(project) {
  if (!window.confirm(`Delete "${project.name}"?\n\nAll milestones, tasks, and sessions will be removed. This cannot be undone.`)) return;
  await deleteProject(project.id);
  await loadAndRender();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
