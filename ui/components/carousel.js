/**
 * Accessible poster shelves for home discovery.
 */
import { escapeAttribute, escapeHtml } from '../../utils/helpers.js';

const fallbackPoster = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22450%22%3E%3Crect fill=%22%2314181d%22 width=%22300%22 height=%22450%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%220.3em%22 fill=%22%239298a1%22 font-size=%2214%22%3ENo poster%3C/text%3E%3C/svg%3E';

function getPosterUrl(item = {}) {
  const posterPath = String(item.poster_path || item.image || '');
  if (!posterPath) return fallbackPoster;
  if (/^https?:\/\//.test(posterPath) || posterPath.startsWith('data:')) return posterPath;
  return posterPath.startsWith('/') ? `https://image.tmdb.org/t/p/w342${posterPath}` : posterPath;
}

function getMediaId(item = {}) {
  if (item.dbId) return String(item.dbId);
  const isSeries = item.type === 'series' || item.media_type === 'tv' || Boolean(item.first_air_date && !item.release_date);
  return isSeries ? `tmdb_tv_${item.id}` : `tmdb_${item.id}`;
}

export function renderCarousel(container, items, carouselId, options = {}) {
  if (!container) return;

  if (!items?.length) {
    container.removeAttribute('aria-busy');
    container.innerHTML = '<div class="shelf-empty" role="status"><strong>Nothing to show yet.</strong><span>Please try again in a moment.</span></div>';
    return;
  }

  container.innerHTML = items.map((item, index) => {
    const title = item.title || item.name || 'Untitled';
    const mediaId = getMediaId(item);
    const date = item.first_air_date || item.release_date || '';
    const year = date ? String(date).slice(0, 4) : '—';
    const rating = Number(item.tmdbRating || item.vote_average || 0);
    return `
      <article class="media-card media-card--${escapeAttribute(options.variant || 'shelf')}" tabindex="0" role="button" aria-label="View ${escapeAttribute(title)} details" data-item-index="${index}" data-carousel-id="${escapeAttribute(carouselId)}" data-movie-id="${escapeAttribute(mediaId)}">
        <div class="media-poster">
          <img src="${escapeAttribute(getPosterUrl(item))}" alt="${escapeAttribute(title)} poster" loading="lazy" onerror="this.onerror=null;this.src='${fallbackPoster}'">
          <div class="media-card-overlay" aria-hidden="false">
            <button type="button" class="media-quick-action" aria-label="Add ${escapeAttribute(title)} to watchlist" data-card-action="watchlist">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
        <div class="media-card-copy">
          <h3 class="media-card-title"><span class="media-card-title-text">${escapeHtml(title)}</span>${rating > 0 ? `<span class="rating-badge media-card-title-rating"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9Z"/></svg>${rating.toFixed(1)}</span>` : ''}</h3>
          <p class="media-card-meta"><span>${escapeHtml(year)}</span></p>
        </div>
      </article>
    `;
  }).join('');
  container.removeAttribute('aria-busy');

  const openDetails = (mediaId) => document.dispatchEvent(new CustomEvent('movieCardClick', { detail: { movieId: mediaId } }));

  container.querySelectorAll('.media-card').forEach((card) => {
    card.addEventListener('click', (event) => {
      const action = event.target.closest('[data-card-action]')?.dataset.cardAction;
      if (action === 'watchlist') {
        event.stopPropagation();
        document.dispatchEvent(new CustomEvent('addToListClick', { detail: { movieId: card.dataset.movieId } }));
        return;
      }
      openDetails(card.dataset.movieId);
    });
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) {
        event.preventDefault();
        openDetails(card.dataset.movieId);
      }
    });
  });
}

export function setupCarouselAutoScroll(carouselId, itemCount, carouselElements = {}) {
  const elementMap = {
    trending: carouselElements.trending,
    'upcoming-movies': carouselElements.upcomingMovies,
    'top-movies': carouselElements.homeGrid,
    'top-series': carouselElements.topSeries
  };
  const { carousel, prev, next } = elementMap[carouselId] || {};
  if (!carousel || !itemCount) return;

  const move = (direction) => {
    const distance = Math.max(280, carousel.clientWidth * 0.82);
    carousel.scrollBy({ left: direction * distance, behavior: 'smooth' });
  };
  if (prev) prev.onclick = () => move(-1);
  if (next) next.onclick = () => move(1);
}
