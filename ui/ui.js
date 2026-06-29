import { renderMovieCard, renderMovieListItem } from './components/movieCard.js';
import { renderModal, renderMoviePage, renderScoreDistribution, renderMovieReviews } from './components/modal.js';
import { renderActorPage, renderActorModal } from './components/actor.js';
import { getSeasonEpisodeTotal } from '../utils/mediaData.js';
import { normalizeRatingForStorage, normalizeStoredRating } from '../utils/helpers.js';

let moviePageRatingUnsubscribe = null;
let moviePageReviewsUnsubscribe = null;
let modalReturnFocus = null;

// Helper function to attach watch time event listeners
function attachWatchTimeListeners(modalContent, mediaId, movie, options) {
    const watchtimeInput = modalContent.querySelector('#modal-watchtime-input');
    const progressBar = modalContent.querySelector('#modal-progress-bar');
    const progressLabel = modalContent.querySelector('#modal-progress-label');
    const runtime = movie.runtime || 0;
    
    if (watchtimeInput && options.localUpdateWatchTime && !watchtimeInput._listenersAttached) {
        const updateWatchTime = async () => {
            const minutes = parseInt(watchtimeInput.value, 10) || 0;
            
            if (minutes >= 0 && runtime > 0) {
                try {
                    await options.localUpdateWatchTime(mediaId, movie, minutes);
                    
                    // Update progress bar and label
                    const newPct = Math.min(100, Math.round((minutes / runtime) * 100));
                    if (progressBar) {
                        progressBar.style.width = `${newPct}%`;
                    }
                    if (progressLabel) {
                        progressLabel.textContent = `${newPct}% (${minutes} / ${runtime} min)`;
                    }
                } catch (err) {
                    console.error('Watch time update failed:', err);
                }
            }
        };

        watchtimeInput.addEventListener('change', updateWatchTime);
        watchtimeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                updateWatchTime();
            }
        });
        watchtimeInput._listenersAttached = true;
    }
}

// Helper function to toggle watch time section visibility
function toggleWatchTimeSection(status, isSeries, runtime, movie, mediaId, options) {
    const modalContent = document.getElementById('modal-content');
    if (!modalContent) return;
    
    let watchtimeSection = modalContent.querySelector('#modal-watchtime');
    const shouldShow = status === 'watching' && !isSeries && runtime > 0;
    
    if (shouldShow && !watchtimeSection) {
        // Create the watch time section
        const movieInfo = options.movieInfo || {};
        const watchVal = movieInfo.watchTime || '';
        const pct = watchVal ? Math.min(100, Math.round((Number(watchVal) / runtime) * 100)) : 0;
        
        const watchtimeHtml = `
            <div id="modal-watchtime" class="mt-3">
                <label class="block text-xs text-gray-300 mb-1">Progress</label>
                <div class="flex items-center gap-3">
                    <input id="modal-watchtime-input" type="number" min="0" max="${runtime}" value="${watchVal}" class="w-28 bg-gray-700 text-white rounded px-2 py-1 text-sm" aria-label="Minutes watched" placeholder="0" />
                    <div class="flex-1">
                        <div class="w-full bg-gray-700 rounded h-2 overflow-hidden">
                            <div id="modal-progress-bar" class="h-2 rounded bg-green-500" style="width: ${pct}%;"></div>
                        </div>
                        <div id="modal-progress-label" class="text-xs text-gray-400 mt-1">${pct}% (${watchVal || 0} / ${runtime} min)</div>
                    </div>
                </div>
            </div>
        `;
        
        // Insert after the controls container
        const controlsContainer = modalContent.querySelector('.mt-4.mb-2');
        if (controlsContainer && controlsContainer.parentNode) {
            controlsContainer.insertAdjacentHTML('afterend', watchtimeHtml);
            
            // Attach event listeners to the newly created input
            attachWatchTimeListeners(modalContent, mediaId, movie, options);
        }
    } else if (!shouldShow && watchtimeSection) {
        // Remove the watch time section
        watchtimeSection.remove();
    }
}

export function showNotification(message, isError = true, duration = 5000) {
    const notificationBar = document.getElementById('notification-bar');
    if (!notificationBar) return;
    notificationBar.textContent = message;
    notificationBar.classList.toggle('bg-red-600', isError);
    notificationBar.classList.toggle('bg-green-500', !isError);
    notificationBar.classList.remove('hidden');
    setTimeout(() => {
        notificationBar.classList.add('hidden');
    }, duration);
}

export function renderMediaLoading(container, count = 8) {
    if (!container) return;
    container.innerHTML = Array.from({ length: count }, () => `
        <div class="media-skeleton" aria-hidden="true">
            <div class="media-skeleton-poster"></div>
            <div class="media-skeleton-line"></div>
            <div class="media-skeleton-line media-skeleton-line-short"></div>
        </div>
    `).join('');
    container.setAttribute('aria-busy', 'true');
}

export function renderMediaMessage(container, title, message, isError = false) {
    if (!container) return;
    container.removeAttribute('aria-busy');
    container.innerHTML = `
        <div class="media-message ${isError ? 'is-error' : ''}" role="${isError ? 'alert' : 'status'}">
            <span class="media-message-icon" aria-hidden="true">${isError ? '!' : '○'}</span>
            <strong>${title}</strong>
            <p>${message}</p>
        </div>
    `;
}

export function renderMovieGrid(container, movies, options = {}) {
    if (!container) return;
    if (!movies || movies.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-gray-400">No movies found.</div>`;
        return;
    }
    container.innerHTML = movies.map(movie => renderMovieCard(movie, options)).join('');
    container.removeAttribute('aria-busy');

    // Add click handler for each movie card. Browse grids can opt into full-page navigation.
    container.querySelectorAll('.movie-card').forEach(card => {
        card.addEventListener('click', (ev) => {
            if (ev.target.closest('button')) return;
            const movieId = card.dataset.movieId;
            const eventName = options.clickAction === 'page' ? 'openMoviePage' : 'movieCardClick';
            document.dispatchEvent(new CustomEvent(eventName, {
                detail: {
                    movieId,
                    backPage: options.backPage || null
                }
            }));
        });
        card.addEventListener('keydown', (ev) => {
            if ((ev.key === 'Enter' || ev.key === ' ') && !ev.target.closest('button')) {
                ev.preventDefault();
                const eventName = options.clickAction === 'page' ? 'openMoviePage' : 'movieCardClick';
                document.dispatchEvent(new CustomEvent(eventName, { detail: { movieId: card.dataset.movieId, backPage: options.backPage || null } }));
            }
        });
    });

    container.querySelectorAll('.movie-watchlist-btn').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            document.dispatchEvent(new CustomEvent('addToListClick', { detail: { movieId: btn.dataset.movieId } }));
        });
    });
}

/**
 * Opens the movie modal and wires up its action handlers.
 *
 * @param {Object} movie The movie or TV/media record to display in the modal.
 * @param {Array|Object} credits Credit data used when rendering the modal.
 * @param {Object} [options={}] Optional rendering and action handlers passed from the caller.
 * @param {Object} [options.movieInfo] Additional movie information used by the modal.
 * @param {Object} [options.settings] Settings used when rendering or updating modal state.
 * @param {Function} [options.localUpdateMovieStatus] Callback to update the user's status for the current media item.
 * @param {Function} [options.localUpdateUserRating] Callback to update the user's rating for the current media item.
 * @param {Function} [options.localUpdateWatchTime] Callback to update the user's watch time for the current media item.
 * @param {Function} [options.localUpdateEpisodes] Callback to update watched episode counts for the current media item.
 * @param {Function} [options.localRemoveMovie] Callback to remove the current media item from the user's list.
 * @param {Function} [options.callGeminiApi] Callback used to invoke the Gemini API for AI-assisted features.
 */
export function openMovieModal(movie, credits, options = {}) {
    const modal = document.getElementById('movie-modal');
    const modalContent = document.getElementById('modal-content');
    modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add('modal-open');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modalContent.innerHTML = renderModal(movie, credits, options);

    // Update follow button states for this modal
    if (typeof globalThis.updateFollowButtonsStateGlobal === 'function') {
      globalThis.updateFollowButtonsStateGlobal(modalContent);
    }

    const closeBtn = modalContent.querySelector('#close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeMovieModal);
        requestAnimationFrame(() => closeBtn.focus());
    }

    // Attach modal control handlers
    const mediaId = movie.dbId || movie.tvdb_id || movie.tmdb_id || movie.id;
    const viewFullPageBtn = modalContent.querySelector('#modal-view-full-page-btn');
    const statusSelect = modalContent.querySelector('#modal-status-select');
    const ratingInput = modalContent.querySelector('#modal-rating-input');
    const addToListBtn = modalContent.querySelector('#modal-add-to-list-btn');
    const seasonSelect = modalContent.querySelector('#modal-season-select');
    const episodesInput = modalContent.querySelector('#modal-episodes-input');
    const episodesTotal = modalContent.querySelector('#modal-episodes-total');

    viewFullPageBtn?.addEventListener('click', () => {
        const backPage = options.backPage || 'home';
        closeMovieModal();
        document.dispatchEvent(new CustomEvent('openMoviePage', {
            detail: { movieId: mediaId, backPage }
        }));
    });

    // Status dropdown handler
    if (statusSelect && options.localUpdateMovieStatus) {
        statusSelect.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            if (newStatus) {
                try {
                    await options.localUpdateMovieStatus(mediaId, movie, newStatus);
                    // Update button text
                    if (addToListBtn) {
                        addToListBtn.textContent = 'Remove from list';
                    }
                    
                    // Show/hide watch time section based on status
                    const isSeries = movie.type === 'series' || movie.media_type === 'tv';
                    const runtime = movie.runtime || 0;
                    toggleWatchTimeSection(newStatus, isSeries, runtime, movie, mediaId, options);
                } catch (err) {
                    console.error('Status update failed:', err);
                }
            }
        });
    }

    // Rating input handler
    if (ratingInput && options.localUpdateUserRating) {
        const handleRatingUpdate = async () => {
            const rating = parseFloat(ratingInput.value);
            if (rating > 0) {
                try {
                    await options.localUpdateUserRating(mediaId, movie, rating);
                    // Update status dropdown to reflect 'watched' status
                    if (statusSelect && !statusSelect.value) {
                        statusSelect.value = 'watched';
                    }
                    // Update button text
                    if (addToListBtn) {
                        addToListBtn.textContent = 'Remove from list';
                    }
                } catch (err) {
                    console.error('Rating update failed:', err);
                }
            }
        };

        // Trigger on change (when input loses focus)
        ratingInput.addEventListener('change', handleRatingUpdate);
        
        // Trigger on Enter key press
        ratingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRatingUpdate();
            }
        });
    }

    // Episode progress handler (for series)
    if (seasonSelect && episodesInput && options.localUpdateEpisodes) {
        const updateSeasonTotal = async (seasonNumber) => {
            if (!episodesTotal) return;
            episodesTotal.textContent = '/ --';
            try {
                const total = await getSeasonEpisodeTotal(movie, seasonNumber);
                episodesTotal.textContent = Number.isFinite(total) ? `/ ${total}` : '/ --';
            } catch (err) {
                console.error('Season total lookup failed:', err);
                episodesTotal.textContent = '/ --';
            }
        };

        const updateEpisodes = async () => {
            const season = parseInt(seasonSelect.value, 10);
            const episodes = parseInt(episodesInput.value, 10) || 0;
            if (season > 0) {
                const movieInfo = options.movieInfo || {};
                const episodesData = movieInfo.episodesWatched || {};
                episodesData[`s${season}`] = episodes;
                try {
                    await options.localUpdateEpisodes(mediaId, movie, episodesData, season);
                } catch (err) {
                    console.error('Episodes update failed:', err);
                }
            }
        };

        seasonSelect.addEventListener('change', async () => {
            const selectedSeason = parseInt(seasonSelect.value, 10);
            const episodesData = (options.movieInfo && typeof options.movieInfo.episodesWatched === 'object')
                ? options.movieInfo.episodesWatched
                : {};
            episodesInput.value = episodesData[`s${selectedSeason}`] || 0;
            await updateSeasonTotal(selectedSeason);
        });
        episodesInput.addEventListener('change', updateEpisodes);

        // Initialize the total when the modal opens.
        updateSeasonTotal(parseInt(seasonSelect.value, 10));
    }

    // Watch time progress handler (for movies with "watching" status)
    // Attach listeners if the watch time section already exists in the modal
    attachWatchTimeListeners(modalContent, mediaId, movie, options);

    // Add to list button handler
    if (addToListBtn && options.localUpdateMovieStatus && options.localRemoveMovie) {
        addToListBtn.addEventListener('click', async (e) => {
            const currentStatusValue = statusSelect ? statusSelect.value : '';
            const currentRatingValue = ratingInput ? ratingInput.value : '';
            const hasStatus = currentStatusValue || currentRatingValue;

            if (hasStatus) {
                // Remove from list
                try {
                    await options.localRemoveMovie(mediaId);
                    addToListBtn.textContent = 'Add to List';
                    if (statusSelect) statusSelect.value = '';
                    if (ratingInput) ratingInput.value = '';
                    closeMovieModal();
                } catch (err) {
                    console.error('Remove failed:', err);
                }
            } else {
                // Add to list with the user's preferred default status.
                try {
                    const defaultStatus = options.settings?.preferences?.defaultAddStatus || 'planning';
                    await options.localUpdateMovieStatus(mediaId, movie, defaultStatus);
                    addToListBtn.textContent = 'Remove from list';
                    if (statusSelect) statusSelect.value = defaultStatus;
                } catch (err) {
                    console.error('Add to list failed:', err);
                }
            }
        });
    }

    // Detail links/chips: use event delegation
    modalContent.addEventListener('click', (e) => {
        const genreChip = e.target.closest('.movie-genre-chip');
        if (genreChip) {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('selectGenre', {
                detail: {
                    genreId: genreChip.dataset.genreId,
                    genreName: genreChip.dataset.genreName,
                    mediaType: genreChip.dataset.mediaType
                }
            }));
            closeMovieModal();
            return;
        }

        const tagChip = e.target.closest('.media-tag-chip');
        if (tagChip) {
            e.preventDefault();
            const mediaType = tagChip.dataset.mediaType;
            const keywordId = tagChip.dataset.keywordId;
            const keywordName = tagChip.dataset.keywordName;
            const eventName = mediaType === 'series' || mediaType === 'tv' ? 'applySeriesTag' : 'applyMovieTag';
            document.dispatchEvent(new CustomEvent(eventName, {
                detail: {
                    tag: {
                        id: `keyword-${keywordId}`,
                        name: keywordName,
                        filters: [{ type: 'keyword', id: keywordId, name: keywordName }]
                    }
                }
            }));
            document.dispatchEvent(new CustomEvent('navigate', {
                detail: { page: mediaType === 'series' || mediaType === 'tv' ? 'browse-series' : 'browse-movies' }
            }));
            closeMovieModal();
            return;
        }

        const link = e.target.closest('.actor-link');
        if (!link) return;
        e.preventDefault();
        const id = link.dataset.actorId;
        if (id) document.dispatchEvent(new CustomEvent('openActorPage', {
            detail: {
                personId: id,
                origin: 'modal',
                mediaId,
                backPage: options.backPage || 'home',
                backScrollY: window.scrollY
            }
        }));
    });
}

export function closeMovieModal() {
    const modal = document.getElementById('movie-modal');
    const modalContent = document.getElementById('modal-content');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.classList.remove('modal-open');
    modalContent.innerHTML = '';
    modalReturnFocus?.focus?.();
    modalReturnFocus = null;
}

export function showMoviePage(movie, credits, options = {}) {
    const moviePage = document.getElementById('movie-page');
    if (!moviePage) return;
    if (typeof moviePageRatingUnsubscribe === 'function') {
        moviePageRatingUnsubscribe();
        moviePageRatingUnsubscribe = null;
    }
    if (typeof moviePageReviewsUnsubscribe === 'function') {
        moviePageReviewsUnsubscribe();
        moviePageReviewsUnsubscribe = null;
    }

    moviePage.innerHTML = renderMoviePage(movie, credits, options);
    moviePage.classList.remove('hidden');
    const mediaId = movie.dbId || movie.tvdb_id || movie.tmdb_id || movie.id;

    if (typeof options.subscribeRatingSummary === 'function') {
        moviePageRatingUnsubscribe = options.subscribeRatingSummary(mediaId, (ratingSummary) => {
            const scoreSection = moviePage.querySelector('#score-distribution-section');
            if (scoreSection) {
                scoreSection.outerHTML = renderScoreDistribution(ratingSummary || {});
            }
        });
    }

    const backBtn = moviePage.querySelector('#movie-page-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (typeof moviePageRatingUnsubscribe === 'function') {
                moviePageRatingUnsubscribe();
                moviePageRatingUnsubscribe = null;
            }
            if (typeof moviePageReviewsUnsubscribe === 'function') {
                moviePageReviewsUnsubscribe();
                moviePageReviewsUnsubscribe = null;
            }
            document.dispatchEvent(new CustomEvent('navigate', { detail: { page: options.backPage || 'home' } }));
            requestAnimationFrame(() => window.scrollTo({ top: Number(options.backScrollY) || 0, behavior: 'auto' }));
        });
    }

    if (typeof globalThis.updateFollowButtonsStateGlobal === 'function') {
      globalThis.updateFollowButtonsStateGlobal(moviePage);
    }

    const statusSelect = moviePage.querySelector('#modal-status-select');
    const ratingInput = moviePage.querySelector('#modal-rating-input');
    const addToListBtn = moviePage.querySelector('#modal-add-to-list-btn');
    const reviewForm = moviePage.querySelector('#movie-review-form');
    const reviewText = moviePage.querySelector('#movie-review-text');
    const reviewRating = moviePage.querySelector('#movie-review-rating');
    const reviewsList = moviePage.querySelector('#movie-reviews-list');
    const reviewCount = moviePage.querySelector('#movie-review-count');

    if (typeof options.subscribeToMovieReviews === 'function' && reviewsList) {
        moviePageReviewsUnsubscribe = options.subscribeToMovieReviews(mediaId, (reviews = []) => {
            reviewsList.innerHTML = renderMovieReviews(reviews, options.currentUser?.uid || '', options.settings || {});
            if (reviewCount) {
                reviewCount.textContent = reviews.length ? `${reviews.length} review${reviews.length === 1 ? '' : 's'}` : '';
            }
            options.updateFollowUserButtonsState?.(moviePage);
        });
    }

    if (reviewForm && typeof options.upsertMovieReview === 'function') {
        reviewForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const text = reviewText?.value.trim() || '';
            if (text.length < 6) {
                options.showNotification?.('Write a little more before publishing your review.', true);
                return;
            }

            const rating = reviewRating?.value
                ? normalizeRatingForStorage(reviewRating.value, options.settings?.ratingSystem || '1-10')
                : null;

            try {
                await options.upsertMovieReview(mediaId, movie, { text, rating });
                options.showNotification?.('Review published.', false, 2500);
            } catch (error) {
                console.error('Review publish failed:', error);
                options.showNotification?.(error.message || 'Could not publish review.', true);
            }
        });
    }

    if (statusSelect && options.localUpdateMovieStatus) {
        statusSelect.addEventListener('change', async (e) => {
            const newStatus = e.target.value;
            if (!newStatus) return;
            try {
                await options.localUpdateMovieStatus(mediaId, movie, newStatus);
                if (addToListBtn) addToListBtn.textContent = 'Remove from list';
            } catch (err) {
                console.error('Status update failed:', err);
            }
        });
    }

    if (ratingInput && options.localUpdateUserRating) {
        const handleRatingUpdate = async () => {
            const rating = parseFloat(ratingInput.value);
            if (!(rating > 0)) return;
            try {
                await options.localUpdateUserRating(mediaId, movie, rating);
                if (statusSelect && !statusSelect.value) statusSelect.value = 'watched';
                if (addToListBtn) addToListBtn.textContent = 'Remove from list';
            } catch (err) {
                console.error('Rating update failed:', err);
            }
        };
        ratingInput.addEventListener('change', handleRatingUpdate);
        ratingInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleRatingUpdate();
            }
        });
    }

    if (addToListBtn && options.localUpdateMovieStatus && options.localRemoveMovie) {
        addToListBtn.addEventListener('click', async () => {
            const hasStatus = statusSelect?.value || ratingInput?.value;
            try {
                if (hasStatus) {
                    await options.localRemoveMovie(mediaId);
                    addToListBtn.textContent = 'Add to List';
                    if (statusSelect) statusSelect.value = '';
                    if (ratingInput) ratingInput.value = '';
                } else {
                    const defaultStatus = options.settings?.preferences?.defaultAddStatus || 'planning';
                    await options.localUpdateMovieStatus(mediaId, movie, defaultStatus);
                    addToListBtn.textContent = 'Remove from list';
                    if (statusSelect) statusSelect.value = defaultStatus;
                }
            } catch (err) {
                console.error('List update failed:', err);
            }
        });
    }

    moviePage.onclick = (e) => {
        const genreChip = e.target.closest('.movie-genre-chip');
        if (genreChip) {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('selectGenre', {
                detail: {
                    genreId: genreChip.dataset.genreId,
                    genreName: genreChip.dataset.genreName,
                    mediaType: genreChip.dataset.mediaType
                }
            }));
            return;
        }

        const tagChip = e.target.closest('.media-tag-chip');
        if (tagChip) {
            e.preventDefault();
            const mediaType = tagChip.dataset.mediaType;
            const keywordId = tagChip.dataset.keywordId;
            const keywordName = tagChip.dataset.keywordName;
            const eventName = mediaType === 'series' || mediaType === 'tv' ? 'applySeriesTag' : 'applyMovieTag';
            document.dispatchEvent(new CustomEvent(eventName, {
                detail: {
                    tag: {
                        id: `keyword-${keywordId}`,
                        name: keywordName,
                        filters: [{ type: 'keyword', id: keywordId, name: keywordName }]
                    }
                }
            }));
            document.dispatchEvent(new CustomEvent('navigate', {
                detail: { page: mediaType === 'series' || mediaType === 'tv' ? 'browse-series' : 'browse-movies' }
            }));
            return;
        }

        const link = e.target.closest('.actor-link');
        if (!link) return;
        e.preventDefault();
        const id = link.dataset.actorId;
        if (id) document.dispatchEvent(new CustomEvent('openActorPage', {
            detail: {
                personId: id,
                origin: 'movie-page',
                mediaId,
                backPage: options.backPage || 'home',
                backScrollY: Number(options.backScrollY) || 0,
                movieScrollY: window.scrollY
            }
        }));
    };
}

export function renderMovieListView(container, movies, userMovieList = new Map(), options = {}) {
    if (!container) return;
    if (!movies || movies.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-gray-400 py-8">No movies found.</div>`;
        return;
    }
    
    const sortMode = options.sortMode || 'added';

    // Sort movies by the selected mode, then by title
    const sortedMovies = [...movies].sort((a, b) => {
        const aId = a.dbId || String(a.id);
        const bId = b.dbId || String(b.id);
        const aUserData = userMovieList.get(aId) || {};
        const bUserData = userMovieList.get(bId) || {};
        if (sortMode === 'rating') {
            const aRating = normalizeStoredRating(aUserData.rating) || 0;
            const bRating = normalizeStoredRating(bUserData.rating) || 0;

            if (bRating !== aRating) {
                return bRating - aRating;
            }
        } else {
            const aAddedAt = aUserData.addedAt?.toDate ? aUserData.addedAt.toDate().getTime() : (aUserData.addedAt ? new Date(aUserData.addedAt).getTime() : 0);
            const bAddedAt = bUserData.addedAt?.toDate ? bUserData.addedAt.toDate().getTime() : (bUserData.addedAt ? new Date(bUserData.addedAt).getTime() : 0);

            if (bAddedAt !== aAddedAt) {
                return bAddedAt - aAddedAt;
            }
        }

        return a.title.localeCompare(b.title);
    });
    
    container.innerHTML = sortedMovies.map(movie => {
        const movieId = movie.dbId || String(movie.id);
        const userMovieData = userMovieList.get(movieId) || {};
        return renderMovieListItem(movie, userMovieData);
    }).join('');
    
    container.querySelectorAll('.movie-list-title').forEach(title => {
        let titleHoverTimer = null;
        const openMoviePage = () => {
            const movieId = title.dataset.movieId;
            document.dispatchEvent(new CustomEvent('openMoviePage', {
                detail: {
                    movieId,
                    backPage: 'my-list'
                }
            }));
        };

        title.addEventListener('click', (ev) => {
            ev.preventDefault();
            openMoviePage();
        });
        title.addEventListener('mouseenter', () => {
            titleHoverTimer = setTimeout(openMoviePage, 300);
        });
        title.addEventListener('mouseleave', () => {
            if (titleHoverTimer) clearTimeout(titleHoverTimer);
        });
    });

    container.querySelectorAll('.movie-list-poster').forEach(poster => {
        poster.addEventListener('mouseenter', () => {
            const movieId = poster.dataset.movieId;
            document.dispatchEvent(new CustomEvent('movieCardClick', { detail: { movieId } }));
        });
    });
}

export function showActorPage(person, credits, options = {}) {
    const actorPage = document.getElementById('actor-page');
    if (!actorPage) return;
    actorPage.innerHTML = renderActorPage(person, credits);
    
    // Update follow button states for this page
    if (typeof globalThis.updateFollowButtonsStateGlobal === 'function') {
      globalThis.updateFollowButtonsStateGlobal(actorPage);
    }

    actorPage.classList.remove('hidden');

    const backBtn = actorPage.querySelector('#actor-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (typeof options.onBack === 'function') options.onBack();
            else document.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'home' } }));
        });
    }
    actorPage.querySelectorAll('[data-movie-id]').forEach(el => {
        el.addEventListener('click', () => {
            const mid = el.dataset.movieId;
            document.dispatchEvent(new CustomEvent('movieCardClick', { detail: { movieId: mid } }));
        });
    });
}

export function openActorModal(person, credits) {
    const actorModal = document.getElementById('actor-modal');
    const actorContent = document.getElementById('actor-modal-content');
    actorModal.classList.remove('hidden');
    actorModal.classList.add('flex');
    actorContent.innerHTML = renderActorModal(person, credits);

    // Update follow button states for this modal
    if (typeof globalThis.updateFollowButtonsStateGlobal === 'function') {
      globalThis.updateFollowButtonsStateGlobal(actorContent);
    }

    const closeBtn = actorContent.querySelector('#close-actor-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeActorModal);

    actorContent.querySelectorAll('.movie-ref').forEach(el => {
        el.addEventListener('click', (e) => {
            const mid = el.dataset.movieId;
            closeActorModal();
            document.dispatchEvent(new CustomEvent('movieCardClick', { detail: { movieId: mid } }));
        });
    });
}
export function closeActorModal() {
    const actorModal = document.getElementById('actor-modal');
    const actorContent = document.getElementById('actor-modal-content');
    actorModal.classList.add('hidden');
    actorModal.classList.remove('flex');
    actorContent.innerHTML = '';
}
