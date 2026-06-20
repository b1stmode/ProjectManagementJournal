let overlay = null;

export function openModal(title, bodyHTML, onConfirm, confirmLabel = 'Confirm', confirmClass = 'btn-primary') {
  closeModal();

  overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2 class="modal-title">${title}</h2>
      <div class="modal-body">${bodyHTML}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button class="btn ${confirmClass}" data-action="confirm">${confirmLabel}</button>
      </div>
    </div>
  `;

  overlay.querySelector('[data-action="cancel"]').addEventListener('click', closeModal);
  overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
    onConfirm(overlay.querySelector('.modal'));
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
  overlay.querySelector('.form-input, .form-textarea')?.focus();
}

export function closeModal() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

export function openConfirmModal(message, onConfirm) {
  openModal(
    'Are you sure?',
    `<p style="color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.6;">${message}</p>`,
    onConfirm,
    'Delete',
    'btn-danger'
  );
}
