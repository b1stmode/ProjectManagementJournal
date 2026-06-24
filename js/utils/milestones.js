import {
  getTasksForMilestone,
  getMilestone, updateMilestone,
  getVersion, updateVersion, getAllVersionsForProject,
  getProject, updateProject, getMilestonesForVersion,
} from '../db.js';

export function getActiveMilestone(milestones, versions) {
  if (!versions || versions.length === 0) {
    return milestones.find(m => !m.isComplete) ?? null;
  }
  const activeVersion = [...versions].sort((a, b) => a.order - b.order).find(v => !v.isComplete);
  if (!activeVersion) return null;
  return [...milestones]
    .filter(m => m.versionId === activeVersion.id)
    .sort((a, b) => a.order - b.order)
    .find(m => !m.isComplete) ?? null;
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
    await checkVersionCompletion(milestone.versionId, milestone.projectId);
  } else if (!allDone && milestone.isComplete) {
    await updateMilestone(milestoneId, { isComplete: false, completedAt: null });
    await checkVersionCompletion(milestone.versionId, milestone.projectId);
  }
}

export async function checkVersionCompletion(versionId, projectId) {
  if (!versionId) {
    await checkProjectCompletion(projectId);
    return;
  }
  const milestones = await getMilestonesForVersion(versionId);
  const version = await getVersion(versionId);
  const allDone = milestones.length > 0 && milestones.every(m => m.isComplete);

  if (allDone && !version.isComplete) {
    await updateVersion(versionId, { isComplete: true, completedAt: Date.now() });
    await checkProjectCompletion(version.projectId);
  } else if (!allDone && version.isComplete) {
    await updateVersion(versionId, { isComplete: false, completedAt: null });
    const project = await getProject(version.projectId);
    if (project.status === 'complete') {
      await updateProject(version.projectId, { status: 'inactive' });
    }
  }
}

export async function checkProjectCompletion(projectId) {
  const versions = await getAllVersionsForProject(projectId);
  if (versions.length > 0 && versions.every(v => v.isComplete)) {
    await updateProject(projectId, { status: 'complete' });
  }
}
