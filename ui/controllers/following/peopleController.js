import { escapeAttribute, escapeHtml } from '../../../utils/helpers.js';

export function createFollowingController({
  state,
  fetchTMDb,
  subscribeToUserFollowing,
  upsertFollowedPerson,
  removeFollowedPerson,
  updateProfileStats,
  showNotification,
  loadHomeActivityContent
}) {
  function setupFollowingListener() {
    if (typeof state.followingUnsubscribe === 'function') {
      state.followingUnsubscribe();
      state.followingUnsubscribe = null;
    }

    if (!state.currentUser) {
      state.userFollowing = new Map();
      state.followingProjectsCache.clear();
      updateFollowButtonsState();
      return;
    }

    state.followingUnsubscribe = subscribeToUserFollowing(state.appId, state.currentUser.uid, (latestMap) => {
      state.userFollowing = latestMap;
      state.followingProjectsCache.clear();
      updateFollowButtonsState();
      updateProfileStats({ userMovieList: state.userMovieList, userFollowing: state.userFollowing, userFollows: state.userFollows });

      if (state.currentPage === 'home') {
        const activeHomeTab = document.querySelector('#home-activity-tab-following.text-sky-400') ? 'following' : null;
        if (activeHomeTab === 'following') void loadHomeActivityContent('following');
      }
    });
  }

  function getFollowKey(personType, personId) {
    return `${personType}_${personId}`;
  }

  function isFollowingPerson(personType, personId) {
    return state.userFollowing.has(getFollowKey(personType, personId));
  }

  function updateFollowButtonsState(root = document) {
    const canFollow = Boolean(state.currentUser);

    root.querySelectorAll('.follow-person-btn').forEach((btn) => {
      const personId = String(btn.dataset.personId || '');
      const personType = String(btn.dataset.personType || 'actor');
      if (!personId) return;

      if (!canFollow) {
        btn.textContent = 'Follow';
        btn.disabled = true;
        btn.classList.add('hidden');
        return;
      }

      btn.disabled = false;
      btn.classList.remove('hidden');

      const following = isFollowingPerson(personType, personId);
      btn.textContent = following ? 'Following' : 'Follow';
      btn.classList.toggle('bg-emerald-600', following);
      btn.classList.toggle('hover:bg-emerald-500', following);
      btn.classList.toggle('bg-sky-600', !following);
      btn.classList.toggle('hover:bg-sky-500', !following);
    });
  }

  async function toggleFollowPerson(personType, personId, personName, profilePath = '') {
    if (!personId) return;
    if (!state.currentUser) {
      updateFollowButtonsState();
      return;
    }

    const followKey = getFollowKey(personType, personId);
    const currentlyFollowing = state.userFollowing.has(followKey);

    if (currentlyFollowing) {
      state.userFollowing.delete(followKey);
      state.followingProjectsCache.delete(followKey);

      try {
        await removeFollowedPerson(state.appId, state.currentUser.uid, followKey);
      } catch (err) {
        console.error('Failed to unfollow person:', err);
      }

      showNotification(`Unfollowed ${personName || personType}.`, false, 2500);
    } else {
      const followEntry = {
        personId: String(personId),
        personType,
        name: personName || (personType === 'director' ? 'Director' : 'Actor'),
        profilePath: profilePath || '',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      state.userFollowing.set(followKey, followEntry);

      try {
        await upsertFollowedPerson(state.appId, state.currentUser.uid, followKey, followEntry);
      } catch (err) {
        console.error('Failed to follow person:', err);
      }

      showNotification(`Following ${followEntry.name}.`, false, 2500);
    }

    updateFollowButtonsState();

    if (state.currentPage === 'home') {
      const followingTabActive = document.querySelector('#home-activity-tab-following.text-sky-400');
      if (followingTabActive) void loadHomeActivityContent('following');
    }
  }

  async function getUpcomingProjectsForFollow(followKey, followEntry) {
    if (state.followingProjectsCache.has(followKey)) {
      return state.followingProjectsCache.get(followKey);
    }

    try {
      const credits = await fetchTMDb(`/person/${followEntry.personId}/combined_credits`);
      const today = new Date().toISOString().slice(0, 10);
      const list = (credits?.cast || [])
        .filter((item) => {
          const date = item.release_date || item.first_air_date;
          return date && date >= today;
        })
        .sort((a, b) => {
          const aDate = a.release_date || a.first_air_date || '9999-12-31';
          const bDate = b.release_date || b.first_air_date || '9999-12-31';
          return aDate.localeCompare(bDate);
        })
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          title: item.title || item.name || 'Untitled',
          date: item.release_date || item.first_air_date || 'TBA',
          mediaType: item.media_type || (item.first_air_date ? 'tv' : 'movie')
        }));

      state.followingProjectsCache.set(followKey, list);
      return list;
    } catch (err) {
      console.error('Failed loading upcoming projects for followed person:', followEntry?.name, err);
      state.followingProjectsCache.set(followKey, []);
      return [];
    }
  }

  async function buildFollowingHtml() {
    const followedEntries = Array.from(state.userFollowing.entries());
    if (!followedEntries.length) {
      return `
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p class="text-white font-semibold mb-3">Following</p>
          <p class="text-gray-400 text-sm">Follow actors and directors to track their future projects.</p>
        </div>
      `;
    }

    const blocks = await Promise.all(followedEntries.map(async ([followKey, entry]) => {
      const upcoming = await getUpcomingProjectsForFollow(followKey, entry);
      const personTypeLabel = entry.personType === 'director' ? 'Director' : 'Actor';
      const escapedName = escapeHtml(entry.name || 'Unknown');

      return `
        <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div class="flex items-center justify-between mb-2 gap-2">
            <div>
              <p class="text-white font-semibold">${escapedName}</p>
              <p class="text-xs text-gray-400">${escapeHtml(personTypeLabel)}</p>
            </div>
            <button type="button" class="follow-person-btn text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded" data-person-id="${escapeAttribute(entry.personId || '')}" data-person-type="${escapeAttribute(entry.personType || '')}" data-person-name="${escapeAttribute(entry.name || '')}" data-profile-path="${escapeAttribute(entry.profilePath || '')}">Following</button>
          </div>
          ${upcoming.length ? `
            <div class="space-y-2 mt-3">
              ${upcoming.map((project) => {
                const escapedTitle = escapeHtml(project.title || 'Untitled');
                return `<div class="rounded bg-gray-700/60 px-3 py-2 border border-gray-700"><p class="text-sm text-white">${escapedTitle}</p><p class="text-xs text-gray-400">${project.mediaType === 'tv' ? 'TV' : 'Movie'} &bull; ${escapeHtml(project.date || '')}</p></div>`;
              }).join('')}
            </div>
          ` : `<p class="text-sm text-gray-400 mt-3">No upcoming projects found yet.</p>`}
        </div>
      `;
    }));

    return `<div class="space-y-4">${blocks.join('')}</div>`;
  }

  globalThis.updateFollowButtonsStateGlobal = updateFollowButtonsState;

  return {
    setupFollowingListener,
    updateFollowButtonsState,
    toggleFollowPerson,
    buildFollowingHtml
  };
}
