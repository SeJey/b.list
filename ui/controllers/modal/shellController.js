/**
 * Wires lightweight modal shell listeners (backdrop click + Escape).
 */
export function setupModalShellHandlers({ closeMovieModal }) {
  const movieModal = document.getElementById('movie-modal');
  const actorModal = document.getElementById('actor-modal');

  movieModal?.addEventListener('click', (ev) => {
    if (ev.target === movieModal) {
      closeMovieModal();
    }
  });

  actorModal?.addEventListener('click', (ev) => {
    if (ev.target === actorModal) {
      actorModal.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      closeMovieModal();
      actorModal?.classList.add('hidden');
    }
    if (ev.key === 'Tab' && movieModal?.classList.contains('flex')) {
      const focusable = Array.from(movieModal.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    }
  });
}
