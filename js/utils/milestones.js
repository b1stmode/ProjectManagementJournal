import {
  getTasksForMilestone,
  getMilestone, updateMilestone,
  getProject, updateProject, getMilestonesForProject,
} from '../db.js';

export function getActiveMilestone(milestones) {
  return milestones.find(m => !m.isComplete) ?? null;
}

export async function getMilestoneProgress(milestoneId) {
  const tasks = await getTasksForMilestone(milestoneId);
  const total = tasks.length;
  const complete = tasks.filter(t => t.isComplete).length;
  const percent = total === 0 ? 0 : Math.round((complete / total) * 100);
  return { complete, total, percent };
}

export async function checkMilestoneCompletion(milestoneId) {
  const tasks = await getTasksForMilestone(milestoneId);
  const milestone = await getMilestone(milestoneId);
  const allDone = tasks.length > 0 && tasks.every(t => t.isComplete);

  if (allDone && !milestone.isComplete) {
    await updateMilestone(milestoneId, { isComplete: true, completedAt: Date.now() });
    await checkProjectCompletion(milestone.projectId);
  } else if (!allDone && milestone.isComplete) {
    await updateMilestone(milestoneId, { isComplete: false, completedAt: null });
    const project = await getProject(milestone.projectId);
    if (project.status === 'complete') {
      await updateProject(milestone.projectId, { status: 'inactive' });
    }
  }
}

export async function checkProjectCompletion(projectId) {
  const milestones = await getMilestonesForProject(projectId);
  if (milestones.length > 0 && milestones.every(m => m.isComplete)) {
    await updateProject(projectId, { status: 'complete' });
  }
}
