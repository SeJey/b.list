/**
 * Wires actor pages, origin-aware back navigation, and person previews.
 */
import { escapeAttribute, escapeHtml } from '../../../utils/helpers.js';

export function setupActorInteractionHandlers({
  fetchTMDb,
  closeMovieModal,
  switchPage,
  showActorPage,
  updateFollowButtonsState,
  actorPage,
  showNotification
}) {
  const previewCache = new Map();
  let previewToken = 0;
  let previewTimer = null;
  let activePreviewLink = null;

  const hideActorPreview = () => {
    previewToken += 1;
    clearTimeout(previewTimer);
    activePreviewLink?.removeAttribute('aria-describedby');
    activePreviewLink = null;
    const tip = document.getElementById('actor-tooltip');
    if (!tip) return;
    tip.classList.add('hidden');
    tip.innerHTML = '';
  };

  const positionActorPreview = (link, tip) => {
    const anchor = link.getBoundingClientRect();
    const preview = tip.getBoundingClientRect();
    const padding = 10;
    const left = Math.min(
      Math.max(anchor.left, padding),
      Math.max(padding, window.innerWidth - preview.width - padding)
    );
    const below = anchor.bottom + 9;
    const top = below + preview.height <= window.innerHeight - padding
      ? below
      : Math.max(padding, anchor.top - preview.height - 9);
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  const showActorPreview = (link) => {
    clearTimeout(previewTimer);
    if (activePreviewLink && activePreviewLink !== link) activePreviewLink.removeAttribute('aria-describedby');
    activePreviewLink = link || null;
    activePreviewLink?.setAttribute('aria-describedby', 'actor-tooltip');
    const token = ++previewToken;
    previewTimer = setTimeout(async () => {
      const tip = document.getElementById('actor-tooltip');
      const actorId = link?.dataset.actorId;
      if (!tip || !actorId || !document.contains(link)) return;

      tip.classList.remove('hidden');
      tip.innerHTML = '<div class="actor-preview-loading">Loading preview…</div>';
      positionActorPreview(link, tip);

      try {
        if (!previewCache.has(actorId)) {
          previewCache.set(actorId, fetchTMDb(`/person/${actorId}`).catch(error => {
            previewCache.delete(actorId);
            throw error;
          }));
        }
        const person = await previewCache.get(actorId);
        if (token !== previewToken || !document.contains(link)) return;

        const name = person.name || link.dataset.actorName || 'Actor';
        const role = link.dataset.actorRole || person.known_for_department || '';
        const bio = person.biography
          ? `${person.biography.substring(0, 120)}${person.biography.length > 120 ? '…' : ''}`
          : 'No biography available.';
        const photo = person.profile_path
          ? `https://image.tmdb.org/t/p/w185${person.profile_path}`
          : 'https://placehold.co/160x200/14181d/9298a1?text=No+photo';
        tip.innerHTML = `
          <img src="${escapeAttribute(photo)}" alt="" onerror="this.onerror=null;this.src='https://placehold.co/160x200/14181d/9298a1?text=No+photo'">
          <div class="actor-preview-copy">
            <strong>${escapeHtml(name)}</strong>
            ${role ? `<span>${escapeHtml(role)}</span>` : ''}
            <p>${escapeHtml(bio)}</p>
          </div>
        `;
        positionActorPreview(link, tip);
      } catch (_err) {
        if (token !== previewToken) return;
        tip.innerHTML = '<div class="actor-preview-loading">Preview unavailable.</div>';
        positionActorPreview(link, tip);
      }
    }, 180);
  };

  document.addEventListener('openActorPage', async (event) => {
    const personId = event.detail?.personId;
    if (!personId) return;
    hideActorPreview();

    const returnContext = {
      origin: event.detail?.origin || 'page',
      mediaId: event.detail?.mediaId || null,
      backPage: event.detail?.backPage || 'home',
      backScrollY: Number(event.detail?.backScrollY) || 0,
      movieScrollY: Number(event.detail?.movieScrollY) || 0
    };

    try {
      const [person, credits] = await Promise.all([
        fetchTMDb(`/person/${personId}`),
        fetchTMDb(`/person/${personId}/combined_credits`)
      ]);
      closeMovieModal();
      switchPage('actor');
      window.scrollTo({ top: 0, behavior: 'auto' });
      showActorPage(person, credits, {
        onBack: () => {
          if (returnContext.origin === 'movie-page' && returnContext.mediaId) {
            switchPage('movie');
            requestAnimationFrame(() => window.scrollTo({ top: returnContext.movieScrollY, behavior: 'auto' }));
            return;
          }

          switchPage(returnContext.backPage);
          requestAnimationFrame(() => {
            window.scrollTo({ top: returnContext.backScrollY, behavior: 'auto' });
            if (returnContext.origin === 'modal' && returnContext.mediaId) {
              document.dispatchEvent(new CustomEvent('movieCardClick', {
                detail: { movieId: returnContext.mediaId, backPage: returnContext.backPage }
              }));
            }
          });
        }
      });
      updateFollowButtonsState(actorPage || document);
    } catch (err) {
      console.error('Failed to open actor page:', err);
      showNotification('Could not open actor details.', true);
    }
  });

  document.addEventListener('showActorTooltip', event => showActorPreview(event.detail?.link));
  document.addEventListener('hideActorTooltip', hideActorPreview);
  document.addEventListener('pointerover', (event) => {
    const link = event.target.closest?.('.actor-link');
    if (link && !link.contains(event.relatedTarget)) showActorPreview(link);
  });
  document.addEventListener('pointerout', (event) => {
    const link = event.target.closest?.('.actor-link');
    if (link && !link.contains(event.relatedTarget)) hideActorPreview();
  });
  document.addEventListener('focusin', (event) => {
    const link = event.target.closest?.('.actor-link');
    if (link) showActorPreview(link);
  });
  document.addEventListener('focusout', (event) => {
    if (event.target.closest?.('.actor-link')) hideActorPreview();
  });
}
