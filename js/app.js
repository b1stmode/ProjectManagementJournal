import { initDB } from './db.js';
import { initRouter, defineRoute, navigate } from './router.js';
import { renderHome } from './views/home.js';
import { renderProjects } from './views/projects.js';
import { renderProject } from './views/project.js';

async function boot() {
  try {
    await initDB();
    console.log('[App] DB ready');
  } catch (err) {
    console.error('[App] DB init failed:', err);
    document.getElementById('app').innerHTML =
      `<div class="view-loading">Failed to initialize database. Please refresh.</div>`;
    return;
  }

  defineRoute('/', renderHome);
  defineRoute('/projects', renderProjects);
  defineRoute('/project/:id', renderProject);

  initRouter();
}

boot();
