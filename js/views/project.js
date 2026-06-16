import {
  getProject, getAllProjects, updateProject,
  createMilestone, getMilestonesForProject, updateMilestone, deleteMilestone,
} from '../db.js';
import { navigate } from '../router.js';
import { openModal, closeModal } from '../utils/modal.js';
import { getActiveMilestone } from '../utils/milestones.js';

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
      <a href="#/projects" class="back-link">← Projects</a>

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
    </div>
  `;

  document.getElementById('set-active-btn')?.addEventListener('click', () => handleSetActive(project));
  document.getElementById('add-milestone-btn').addEventListener('click', () => openMilestoneModal(null));

  await renderMilestones();
}

async function renderMilestones() {
  const container = document.getElementById('milestone-list-container');
  if (!container) return;

  const milestones = await getMilestonesForProject(currentProjectId);
  const active = getActiveMilestone(milestones);

  if (milestones.length === 0) {
    container.innerHTML = `<div class="milestones-empty">No milestones yet. Add one to start tracking progress.</div>`;
    return;
  }

  container.innerHTML = `
    <div class="milestone-list">
      ${milestones.map((m, i) => renderMilestoneItem(m, i, milestones.length, active?.id === m.id)).join('')}
    </div>
  `;

  milestones.forEach((m, i) => {
    const item = container.querySelector(`[data-milestone-id="${m.id}"]`);
    item.querySelector('[data-action="up"]')?.addEventListener('click', () => reorder(milestones, i, -1));
    item.querySelector('[data-action="down"]')?.addEventListener('click', () => reorder(milestones, i, 1));
    item.querySelector('[data-action="edit"]').addEventListener('click', () => openMilestoneModal(m));
    item.querySelector('[data-action="delete"]').addEventListener('click', () => handleDeleteMilestone(m));
  });
}

function renderMilestoneItem(milestone, index, total, isActive) {
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
        <p class="milestone-tasks-placeholder">Tasks — M3 will build this out.</p>
      </div>
      <div class="milestone-actions">
        <button class="btn btn-ghost" data-action="edit">Edit</button>
        <button class="btn btn-danger" data-action="delete">Delete</button>
      </div>
    </div>
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

async function reorder(milestones, index, direction) {
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
  if (!window.confirm(`Delete milestone "${milestone.name}"?\n\nAny tasks within it will also be deleted.`)) return;
  await deleteMilestone(milestone.id);
  await renderMilestones();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
