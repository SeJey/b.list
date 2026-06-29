import { escapeAttribute, escapeHtml, formatStoredRating, getPosterUrl } from '../../utils/helpers.js';
import { settings } from '../../settings.js';

function getEventTime(value) {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function relativeTime(value) {
  const time = getEventTime(value);
  if (!time) return 'recently';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(time).toLocaleDateString();
}

function eventCopy(event) {
  const title = event.mediaTitle || 'a title';
  if (event.type === 'started') return `started watching ${title}`;
  if (event.type === 'completed') return `completed ${title}`;
  if (event.type === 'rated') return `rated ${title}`;
  if (event.type === 'reviewed') return `reviewed ${title}`;
  if (event.type === 'episode_milestone') {
    return `reached season ${event.season || 1}, episode ${event.episode || 1} of ${title}`;
  }
  return `updated ${title}`;
}

export function createActivityPageController({
  state,
  elements,
  buildFollowingHtml,
  updateFollowButtonsState,
  updateFollowUserButtonsState
}) {
  let activeHomeTab = 'activity';
  let activeProfileFilter = 'following';

  function setActiveTab(tabName, tabsByName) {
    Object.entries(tabsByName).forEach(([name, tab]) => {
      if (!tab) return;
      const selected = name === tabName;
      tab.classList.toggle('text-sky-400', selected);
      tab.classList.toggle('border-sky-400', selected);
      tab.classList.toggle('text-gray-400', !selected);
      tab.classList.toggle('border-transparent', !selected);
      tab.setAttribute('aria-selected', String(selected));
    });
  }

  function filteredEvents(mode) {
    const events = Array.isArray(state.activityEvents) ? state.activityEvents : [];
    const currentId = String(state.currentUser?.uid || '');
    if (mode === 'own' || mode === 'activity') return events.filter(event => String(event.actorId) === currentId);
    if (mode === 'following') {
      const followed = new Set(Array.from(state.userFollows?.keys?.() || []).map(String));
      return events.filter(event => followed.has(String(event.actorId)) && event.visibility !== 'private');
    }
    return events.filter(event => !event.visibility || event.visibility === 'public');
  }

  function renderFeed(events, { emptyMessage = 'No activity yet.' } = {}) {
    if (state.activityRemoteAvailable === false && !events.length) {
      return '<div class="activity-feed-state is-error"><strong>Live activity is unavailable</strong><p>Check the Firestore activity rules, then try again.</p></div>';
    }
    if (!events.length) {
      return `<div class="activity-feed-state"><strong>Nothing here yet</strong><p>${escapeHtml(emptyMessage)}</p></div>`;
    }

    const remoteWarning = state.activityRemoteAvailable === false
      ? '<div class="activity-feed-warning">Showing locally saved activity. Live community updates need the Firestore activity rules.</div>'
      : '';
    return remoteWarning + events.map(event => {
      const poster = getPosterUrl({ poster_path: event.mediaPosterPath });
      const name = event.actorName || 'Blist member';
      const initials = event.actorInitials || name.charAt(0).toUpperCase();
      const isSelf = String(event.actorId) === String(state.currentUser?.uid || '');
      return `
        <article class="activity-event-card">
          <div class="activity-event-author">
            ${event.actorPhotoURL ? `<img src="${escapeAttribute(event.actorPhotoURL)}" alt="">` : `<span>${escapeHtml(initials)}</span>`}
            <div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(relativeTime(event.createdAt))}</small></div>
            ${isSelf ? '' : `<button type="button" class="follow-user-btn activity-follow-btn" data-user-id="${escapeAttribute(event.actorId)}" data-user-name="${escapeAttribute(name)}" data-user-photo="${escapeAttribute(event.actorPhotoURL || '')}" data-user-initials="${escapeAttribute(initials)}">Follow</button>`}
          </div>
          <button type="button" class="profile-activity-item activity-event-media" data-movie-id="${escapeAttribute(event.mediaId)}">
            <img src="${escapeAttribute(poster)}" alt="${escapeAttribute(event.mediaTitle || 'Title')} poster">
            <div>
              <p>${escapeHtml(eventCopy(event))}</p>
              ${event.rating ? `<small>Score ${escapeHtml(formatStoredRating(event.rating, settings))}</small>` : ''}
            </div>
          </button>
        </article>
      `;
    }).join('');
  }

  async function loadActivityContentInto(container, tabName) {
    if (!container) return;
    const mode = tabName === 'global' ? 'global' : tabName === 'following' ? 'following' : 'own';
    const empty = mode === 'following'
      ? 'Follow other members to see what they are watching.'
      : mode === 'global'
        ? 'Shared community activity will appear here.'
        : 'Start, finish, rate, or review a title to create activity.';
    let html = renderFeed(filteredEvents(mode), { emptyMessage: empty });

    if (tabName === 'following') {
      const peopleHtml = await buildFollowingHtml();
      html += `<section class="activity-followed-people"><h3>Actors and directors you follow</h3>${peopleHtml}</section>`;
    }

    container.innerHTML = html;
    updateFollowButtonsState(container);
    updateFollowUserButtonsState?.(container);
  }

  function setActivityTab(tabName) {
    setActiveTab(tabName, elements.activity.tabs);
    return loadActivityContentInto(elements.activity.content, tabName);
  }

  function setHomeActivityTab(tabName) {
    activeHomeTab = tabName;
    setActiveTab(tabName, elements.activity.homeTabs);
    return loadActivityContentInto(elements.activity.homeContent, tabName);
  }

  function setProfileActivityFilter(filter) {
    activeProfileFilter = filter === 'global' ? 'global' : 'following';
    document.querySelectorAll('[data-profile-activity-filter]').forEach(button => {
      const selected = button.dataset.profileActivityFilter === activeProfileFilter;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    const container = document.getElementById('profile-activity-feed');
    if (!container) return;
    const empty = activeProfileFilter === 'following'
      ? 'Follow other members to see their latest activity.'
      : 'Shared community activity will appear here.';
    container.innerHTML = renderFeed(filteredEvents(activeProfileFilter), { emptyMessage: empty });
    updateFollowUserButtonsState?.(container);
  }

  function setupProfileActivityBindings() {
    document.querySelectorAll('[data-profile-activity-filter]').forEach(button => {
      if (button.dataset.activityBound === 'true') return;
      button.dataset.activityBound = 'true';
      button.addEventListener('click', () => setProfileActivityFilter(button.dataset.profileActivityFilter));
    });
    setProfileActivityFilter(activeProfileFilter);
  }

  function refreshActivityFeeds() {
    if (state.currentUser && !elements.home.loggedInView?.classList.contains('hidden')) {
      void setHomeActivityTab(activeHomeTab);
    }
    setProfileActivityFilter(activeProfileFilter);
  }

  return {
    setActivityTab,
    setHomeActivityTab,
    loadActivityContent: tabName => loadActivityContentInto(elements.activity.content, tabName),
    loadHomeActivityContent: tabName => loadActivityContentInto(elements.activity.homeContent, tabName),
    setProfileActivityFilter,
    setupProfileActivityBindings,
    refreshActivityFeeds
  };
}
