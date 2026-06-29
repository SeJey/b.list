import { escapeAttribute, escapeHtml, formatActivityDate } from '../../utils/helpers.js';

function getPostTime(post = {}) {
  const value = post.createdAt || post.updatedAt;
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getAuthorInitials(post = {}) {
  if (post.authorInitials) return post.authorInitials;
  return String(post.authorName || 'U')
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function getPostTypeLabel(type = 'post') {
  if (type === 'question') return 'Question';
  if (type === 'recommendation') return 'Recommendation';
  if (type === 'review') return 'Review';
  return 'Post';
}

function renderComments(comments = [], currentUserId = '') {
  if (!comments.length) {
    return '<p class="text-sm text-gray-500">No comments yet.</p>';
  }

  return comments.map(comment => {
    const isOwn = String(comment.authorId || '') === String(currentUserId || '');
    return `
      <div class="rounded-md bg-gray-900 border border-gray-800 p-3">
        <div class="flex items-center justify-between gap-3 mb-1">
          <p class="text-sm font-semibold text-white">${escapeHtml(comment.authorName || 'Blist User')}</p>
          <span class="text-xs text-gray-500">${escapeHtml(formatActivityDate(getPostTime(comment)))}</span>
        </div>
        <p class="text-sm text-gray-300 whitespace-pre-line">${escapeHtml(comment.body || '')}</p>
        ${isOwn ? '<p class="text-[11px] text-sky-400 mt-2">Your comment</p>' : ''}
      </div>
    `;
  }).join('');
}

function renderPostCard(post, comments, currentUserId, followedUserIds) {
  const postId = String(post.id || '');
  const followedAuthor = followedUserIds.has(String(post.authorId || ''));
  const isOwn = String(post.authorId || '') === String(currentUserId || '');
  const authorName = post.authorName || 'Blist User';
  const initials = getAuthorInitials(post);
  const typeLabel = getPostTypeLabel(post.type);
  const commentCount = Math.max(Number(post.commentCount || 0), comments.length);

  return `
    <article class="forum-post rounded-md border border-gray-700 bg-gray-800 p-5" data-post-id="${escapeAttribute(postId)}">
      <div class="flex items-start justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-11 h-11 rounded-md bg-gradient-to-br from-sky-500 to-red-500 text-white font-bold flex items-center justify-center flex-shrink-0">
            ${escapeHtml(initials)}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-white font-semibold truncate">${escapeHtml(authorName)}</h2>
              <span class="text-[11px] uppercase tracking-wide rounded bg-gray-900 border border-gray-700 text-sky-200 px-2 py-0.5">${escapeHtml(typeLabel)}</span>
              ${followedAuthor && !isOwn ? '<span class="text-[11px] rounded bg-emerald-900/70 text-emerald-200 px-2 py-0.5 border border-emerald-800">Following</span>' : ''}
            </div>
            <p class="text-xs text-gray-500">${escapeHtml(formatActivityDate(getPostTime(post)))}</p>
          </div>
        </div>
        <button type="button" class="follow-user-btn text-sm text-white px-3 py-1.5 rounded-md ${followedAuthor ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}" data-user-id="${escapeAttribute(post.authorId || '')}" data-user-name="${escapeAttribute(authorName)}" data-user-photo="${escapeAttribute(post.authorPhotoURL || '')}" data-user-initials="${escapeAttribute(initials)}">
          ${followedAuthor ? 'Following' : 'Follow'}
        </button>
      </div>

      ${post.title ? `<h3 class="text-lg font-bold text-white mt-4">${escapeHtml(post.title)}</h3>` : ''}
      <p class="text-gray-200 mt-4 whitespace-pre-line">${escapeHtml(post.body || '')}</p>

      ${post.mediaTitle ? `
        <div class="mt-4 rounded-md border border-gray-700 bg-gray-900 p-3">
          <p class="text-xs uppercase tracking-wide text-gray-500">Related title</p>
          <p class="text-sm text-sky-200 mt-1">${escapeHtml(post.mediaTitle)}</p>
        </div>
      ` : ''}

      <div class="mt-5 pt-4 border-t border-gray-700">
        <div class="flex items-center justify-between gap-3 mb-3">
          <p class="text-sm text-gray-400"><span data-comment-count-for="${escapeAttribute(postId)}">${commentCount}</span> comments</p>
        </div>
        <div class="forum-comments-list space-y-3" data-comments-for="${escapeAttribute(postId)}">
          ${renderComments(comments, currentUserId)}
        </div>
        <form class="forum-comment-form mt-4 flex gap-2" data-post-id="${escapeAttribute(postId)}">
          <input type="text" name="comment" maxlength="280" placeholder="Add a comment..." class="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
          <button type="submit" class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-md text-sm">Reply</button>
        </form>
      </div>
    </article>
  `;
}

function getProfileName(profile = {}) {
  return profile.displayName || profile.username || (profile.email ? profile.email.split('@')[0] : 'Blist User');
}

function getProfileInitials(profile = {}) {
  if (profile.initials) return profile.initials;
  return getProfileName(profile)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';
}

function getProfileTime(profile = {}) {
  const value = profile.lastActiveAt || profile.updatedAt || profile.createdAt;
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSuggestedProfiles(state) {
  const followedIds = new Set(Array.from(state.userFollows?.keys?.() || []).map(String));
  return [...(state.suggestedUsers || [])]
    .filter(profile => profile?.uid && String(profile.uid) !== String(state.currentUser?.uid || ''))
    .sort((a, b) => {
      const aOpen = followedIds.has(String(a.uid)) ? 0 : 1;
      const bOpen = followedIds.has(String(b.uid)) ? 0 : 1;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return getProfileTime(b) - getProfileTime(a);
    })
    .slice(0, 5);
}

function renderSuggestedUsersPanel(state) {
  const suggested = getSuggestedProfiles(state);

  if (!suggested.length) {
    return `
      <section class="rounded-md border border-gray-700 bg-gray-800 p-5">
        <h2 class="text-lg font-bold text-white">Suggested Users</h2>
        <p class="text-sm text-gray-400 mt-3">No suggestions yet.</p>
      </section>
    `;
  }

  return `
    <section class="rounded-md border border-gray-700 bg-gray-800 p-5">
      <h2 class="text-lg font-bold text-white mb-4">Suggested Users</h2>
      <div class="space-y-3">
        ${suggested.map((profile) => {
          const followed = state.userFollows.has(String(profile.uid));
          const name = getProfileName(profile);
          const initials = getProfileInitials(profile);
          const activeAt = getProfileTime(profile);

          return `
            <div class="rounded-md border border-gray-700 bg-gray-900 p-3">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-9 h-9 rounded-md bg-gradient-to-br from-sky-500 to-red-500 text-white text-sm font-bold flex items-center justify-center flex-shrink-0">
                    ${escapeHtml(initials)}
                  </div>
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-white truncate">${escapeHtml(name)}</p>
                    <p class="text-xs text-gray-500 truncate">${activeAt ? escapeHtml(formatActivityDate(activeAt)) : 'Blist member'}</p>
                  </div>
                </div>
                <button type="button" class="follow-user-btn text-xs text-white px-2 py-1 rounded-md ${followed ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}" data-user-id="${escapeAttribute(profile.uid)}" data-user-name="${escapeAttribute(name)}" data-user-email="${escapeAttribute(profile.email || '')}" data-user-photo="${escapeAttribute(profile.photoURL || '')}" data-user-initials="${escapeAttribute(initials)}">
                  ${followed ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

export function createForumPageController({
  state,
  elements,
  createForumPost,
  subscribeToForumPosts,
  createForumComment,
  subscribeToForumComments,
  showNotification,
  getFollowedUserIds,
  updateFollowUserButtonsState
}) {
  let activeMode = 'for-you';

  function scorePost(post) {
    const comments = state.forumCommentsByPost.get(String(post.id || '')) || [];
    const followedIds = getFollowedUserIds();
    const ageHours = Math.max(0.25, (Date.now() - getPostTime(post)) / 3600000);
    const recencyScore = 80 / Math.sqrt(ageHours);
    const commentScore = Math.max(Number(post.commentCount || 0), comments.length) * 12;
    const followedScore = followedIds.has(String(post.authorId || '')) ? 75 : 0;
    const ownScore = String(post.authorId || '') === String(state.currentUser?.uid || '') ? 8 : 0;
    const typeScore = post.type === 'question' ? 12 : (post.type === 'recommendation' ? 8 : 0);
    return recencyScore + commentScore + followedScore + ownScore + typeScore;
  }

  function getVisiblePosts() {
    const posts = [...(state.forumPosts || [])];
    const followedIds = getFollowedUserIds();

    if (activeMode === 'latest') {
      return posts.sort((a, b) => getPostTime(b) - getPostTime(a));
    }

    if (activeMode === 'following') {
      return posts
        .filter(post => followedIds.has(String(post.authorId || '')) || String(post.authorId || '') === String(state.currentUser?.uid || ''))
        .sort((a, b) => getPostTime(b) - getPostTime(a));
    }

    return posts.sort((a, b) => scorePost(b) - scorePost(a));
  }

  function ensureForumListener() {
    if (typeof state.forumUnsubscribe === 'function') return;
    state.forumUnsubscribe = subscribeToForumPosts(state.appId, (posts) => {
      state.forumPosts = posts;
      if (state.currentPage === 'forum') renderForumPage();
    });
  }

  function syncCommentSubscriptions(posts) {
    const visibleIds = new Set(posts.map(post => String(post.id || '')).filter(Boolean));

    state.forumCommentUnsubscribes.forEach((unsubscribe, postId) => {
      if (!visibleIds.has(String(postId))) {
        unsubscribe();
        state.forumCommentUnsubscribes.delete(postId);
        state.forumCommentsByPost.delete(postId);
      }
    });

    visibleIds.forEach((postId) => {
      if (state.forumCommentUnsubscribes.has(postId)) return;

      const unsubscribe = subscribeToForumComments(state.appId, postId, (comments) => {
        state.forumCommentsByPost.set(postId, comments);
        const page = elements.pages.forum;
        const commentsContainer = page?.querySelector(`[data-comments-for="${postId}"]`);
        const countEl = page?.querySelector(`[data-comment-count-for="${postId}"]`);
        if (commentsContainer) commentsContainer.innerHTML = renderComments(comments, state.currentUser?.uid || '');
        if (countEl) countEl.textContent = comments.length;
        updateFollowUserButtonsState(page || document);
      });

      state.forumCommentUnsubscribes.set(postId, unsubscribe);
    });
  }

  function renderTabs() {
    const tabs = [
      ['for-you', 'For You'],
      ['latest', 'Latest'],
      ['following', 'Following']
    ];

    return tabs.map(([mode, label]) => `
      <button type="button" class="forum-mode-btn px-3 py-2 rounded-md text-sm font-semibold ${activeMode === mode ? 'bg-sky-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}" data-mode="${mode}">
        ${label}
      </button>
    `).join('');
  }

  function renderForumPage() {
    const page = elements.pages.forum;
    if (!page) return;

    if (!state.currentUser) {
      page.innerHTML = `
        <div class="max-w-2xl mx-auto rounded-md border border-gray-700 bg-gray-800 p-8 text-center">
          <h1 class="text-2xl font-bold text-white">Forum</h1>
          <p class="text-gray-400 mt-2">Log in to post, comment, and follow other users.</p>
        </div>
      `;
      return;
    }

    const posts = getVisiblePosts();
    const totalPosts = state.forumPosts.length;
    const totalReplies = state.forumPosts.reduce((sum, post) => sum + Number(post.commentCount || 0), 0);
    syncCommentSubscriptions(posts.slice(0, 30));

    page.innerHTML = `
      <div class="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-6">
        <div>
          <div class="mb-6">
            <p class="text-sm uppercase tracking-wide text-sky-300">Community</p>
            <h1 class="text-3xl font-bold text-white mt-1">Forum</h1>
            <p class="text-gray-400 mt-2">Post thoughts, ask questions, and talk through what you are watching.</p>
          </div>

          <form id="forum-post-form" class="rounded-md border border-gray-700 bg-gray-800 p-5 mb-6">
            <div class="flex flex-col md:flex-row gap-3 mb-3">
              <select id="forum-post-type" class="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white md:w-48">
                <option value="post">Post</option>
                <option value="question">Question</option>
                <option value="recommendation">Recommendation</option>
              </select>
              <input id="forum-post-title" type="text" maxlength="90" placeholder="Optional title" class="flex-1 bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
            </div>
            <textarea id="forum-post-body" rows="4" maxlength="1200" placeholder="Share something with the community..." class="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"></textarea>
            <div class="flex justify-end mt-3">
              <button type="submit" class="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-md text-sm font-semibold">Post</button>
            </div>
          </form>

          <div class="flex items-center gap-2 mb-4">
            ${renderTabs()}
          </div>

          <div id="forum-feed" class="space-y-5">
            ${posts.length
              ? posts.map(post => renderPostCard(post, state.forumCommentsByPost.get(String(post.id || '')) || [], state.currentUser.uid, getFollowedUserIds())).join('')
              : `<div class="rounded-md border border-gray-700 bg-gray-800 p-6 text-gray-400">${activeMode === 'following' ? 'Follow users to build a following feed.' : 'No posts yet. Start the conversation.'}</div>`}
          </div>
        </div>

        <aside class="space-y-4">
          <section class="rounded-md border border-gray-700 bg-gray-800 p-5">
            <h2 class="text-lg font-bold text-white">Community Pulse</h2>
            <div class="grid grid-cols-3 gap-3 text-center mt-4">
              <div>
                <p class="text-xl font-bold text-sky-300">${totalPosts}</p>
                <p class="text-xs text-gray-500">Posts</p>
              </div>
              <div>
                <p class="text-xl font-bold text-sky-300">${totalReplies}</p>
                <p class="text-xs text-gray-500">Replies</p>
              </div>
              <div>
                <p class="text-xl font-bold text-sky-300">${state.userFollows.size}</p>
                <p class="text-xs text-gray-500">Following</p>
              </div>
            </div>
          </section>
          ${renderSuggestedUsersPanel(state)}
        </aside>
      </div>
    `;

    updateFollowUserButtonsState(page);
  }

  function bindForumEvents() {
    const page = elements.pages.forum;
    if (!page) return;

    page.addEventListener('click', (event) => {
      const modeBtn = event.target.closest('.forum-mode-btn');
      if (modeBtn) {
        activeMode = modeBtn.dataset.mode || 'for-you';
        renderForumPage();
      }
    });

    page.addEventListener('submit', async (event) => {
      const postForm = event.target.closest('#forum-post-form');
      if (postForm) {
        event.preventDefault();
        const bodyInput = page.querySelector('#forum-post-body');
        const titleInput = page.querySelector('#forum-post-title');
        const typeInput = page.querySelector('#forum-post-type');
        const body = bodyInput?.value.trim() || '';

        if (body.length < 3) {
          showNotification('Write a little more before posting.', true);
          return;
        }

        try {
          await createForumPost(state.appId, state.currentUser, {
            type: typeInput?.value || 'post',
            title: titleInput?.value || '',
            body
          });
          if (bodyInput) bodyInput.value = '';
          if (titleInput) titleInput.value = '';
          showNotification('Posted to the forum.', false, 2500);
        } catch (error) {
          console.error('Forum post failed:', error);
          showNotification(error.message || 'Could not create post.', true);
        }
        return;
      }

      const commentForm = event.target.closest('.forum-comment-form');
      if (commentForm) {
        event.preventDefault();
        const input = commentForm.elements.comment;
        const body = input?.value.trim() || '';
        const postId = commentForm.dataset.postId;

        if (body.length < 2) {
          showNotification('Comment cannot be empty.', true);
          return;
        }

        try {
          await createForumComment(state.appId, state.currentUser, postId, { body });
          if (input) input.value = '';
        } catch (error) {
          console.error('Forum comment failed:', error);
          showNotification(error.message || 'Could not add comment.', true);
        }
      }
    });
  }

  function loadForumPage() {
    ensureForumListener();
    renderForumPage();
  }

  function clearForumSubscriptions() {
    if (typeof state.forumUnsubscribe === 'function') {
      state.forumUnsubscribe();
      state.forumUnsubscribe = null;
    }
    state.forumCommentUnsubscribes.forEach((unsubscribe) => unsubscribe());
    state.forumCommentUnsubscribes.clear();
    state.forumCommentsByPost.clear();
  }

  bindForumEvents();
  document.addEventListener('blist:socialUsersChanged', () => {
    if (state.currentPage === 'forum') renderForumPage();
  });

  return {
    loadForumPage,
    renderForumPage,
    clearForumSubscriptions
  };
}
