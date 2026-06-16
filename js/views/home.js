export function renderHome(_params) {
  document.getElementById('app').innerHTML = `
    <div style="padding: var(--space-8); color: var(--text-secondary); font-size: var(--text-sm);">
      <p style="color: var(--accent); margin-bottom: var(--space-2);">PM Journal</p>
      <p>Home — Command Center</p>
      <p style="color: var(--text-muted); margin-top: var(--space-4);">M4 will build this out.</p>
    </div>
  `;
}
