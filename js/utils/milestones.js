export function getActiveMilestone(milestones) {
  return milestones.find(m => !m.isComplete) ?? null;
}

export function getMilestoneProgress(_milestoneId) {
  // Stub — M3 fills this in when tasks exist
  return { complete: 0, total: 0, percent: 0 };
}
