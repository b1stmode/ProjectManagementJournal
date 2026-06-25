import {
  createVersion,
  createMilestone,
  createTask,
  createBacklogItem,
} from '../db.js';

export const CLAUDE_IMPORT_PROMPT = `Create a project roadmap using ONLY this exact format:

## V1: Version Name

### M1: Milestone Name
- Task description
- Another task

### M2: Another Milestone
- Task

## Backlog
- Future idea

Rules:
- ## (two hashes) = Version
- ### (three hashes) = Milestone, must follow a Version
- - (dash) = Task under current Milestone, or Backlog item under ## Backlog
- No other markdown. No descriptions. No nested lists.

Use the project we have been discussing. Output only the file contents, nothing else.`;

export function parseRoadmap(text) {
  const versions = [];
  const milestones = [];
  const tasks = [];
  const backlogItems = [];

  let currentVersion = null;
  let currentMilestone = null;
  let inBacklog = false;
  let versionOrder = 0;
  let milestoneOrder = 0;
  let taskOrder = 0;
  let backlogOrder = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.toLowerCase().startsWith('## backlog')) {
      inBacklog = true;
      currentMilestone = null;
      continue;
    }

    if (line.startsWith('## ')) {
      inBacklog = false;
      const name = line.slice(3).trim();
      if (!name) continue;
      currentVersion = { name, order: versionOrder++ };
      versions.push(currentVersion);
      currentMilestone = null;
      milestoneOrder = 0;
      continue;
    }

    if (line.startsWith('### ')) {
      if (!currentVersion || inBacklog) continue;
      const name = line.slice(4).trim();
      if (!name) continue;
      currentMilestone = { name, versionRef: currentVersion, order: milestoneOrder++ };
      milestones.push(currentMilestone);
      taskOrder = 0;
      continue;
    }

    if (line.startsWith('- ')) {
      const content = line.slice(2).trim();
      if (!content) continue;
      if (inBacklog) {
        backlogItems.push({ text: content, order: backlogOrder++ });
      } else if (currentMilestone) {
        tasks.push({ name: content, milestoneRef: currentMilestone, order: taskOrder++ });
      }
    }
  }

  return { versions, milestones, tasks, backlogItems };
}

export async function importRoadmapToProject(projectId, text) {
  const { versions, milestones, tasks, backlogItems } = parseRoadmap(text);

  const versionIdMap = new Map();
  for (const v of versions) {
    const record = await createVersion({ projectId, name: v.name, order: v.order });
    versionIdMap.set(v, record.id);
  }

  const milestoneIdMap = new Map();
  for (const m of milestones) {
    const versionId = versionIdMap.get(m.versionRef) ?? null;
    const record = await createMilestone({ projectId, versionId, name: m.name, order: m.order });
    milestoneIdMap.set(m, record.id);
  }

  for (const t of tasks) {
    const milestoneId = milestoneIdMap.get(t.milestoneRef);
    if (!milestoneId) continue;
    await createTask({ projectId, milestoneId, name: t.name, order: t.order });
  }

  for (const b of backlogItems) {
    await createBacklogItem({ projectId, text: b.text, order: b.order });
  }

  return {
    versionsCreated: versions.length,
    milestonesCreated: milestones.length,
    tasksCreated: tasks.length,
    backlogCreated: backlogItems.length,
  };
}
