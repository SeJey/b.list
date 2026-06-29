import { db, setDoc, deleteDoc, doc, collection, onSnapshot, getDoc, getDocs, query, where, orderBy, limit, runTransaction } from './firebase.js';
import { normalizeStoredRating } from './utils/helpers.js';

function getRatingBucket(rating) {
    const score = normalizeStoredRating(rating) || 0;
    return String(Math.max(10, Math.min(100, Math.ceil(score / 10) * 10)));
}

function getNormalizedAggregateTotal(data = {}) {
    const total = Number(data.totalRating) || 0;
    const count = Number(data.ratingCount) || 0;
    const average = Number(data.averageRating) || 0;
    if (average > 0 && average <= 10) return total * 10;
    if (count > 0 && total > 0 && total <= count * 10) return total * 10;
    return total;
}

function getLocalPlaylistsKey(appId, userId) {
    return `blist-playlists:${appId}:${userId}`;
}

function getLocalPlaylists(appId, userId) {
    try {
        return JSON.parse(localStorage.getItem(getLocalPlaylistsKey(appId, userId)) || '[]');
    } catch (e) {
        return [];
    }
}

function saveLocalPlaylists(appId, userId, playlists) {
    try {
        localStorage.setItem(getLocalPlaylistsKey(appId, userId), JSON.stringify(playlists));
        window.dispatchEvent(new CustomEvent('blist:playlistsChanged', {
            detail: { appId, userId }
        }));
    } catch (e) {
        console.error('saveLocalPlaylists failed:', e);
    }
}

function mergePlaylists(remotePlaylists, localPlaylists) {
    const merged = new Map();
    [...remotePlaylists, ...localPlaylists].forEach(playlist => {
        if (playlist?.id) merged.set(playlist.id, playlist);
    });
    return Array.from(merged.values());
}

function updateLocalPlaylist(appId, userId, playlistId, updater) {
    const playlists = getLocalPlaylists(appId, userId);
    const index = playlists.findIndex(playlist => String(playlist.id) === String(playlistId));
    if (index < 0) return false;
    playlists[index] = updater(playlists[index]);
    saveLocalPlaylists(appId, userId, playlists);
    return true;
}

function normalizePlaylistMediaData(movieId, mediaData = {}) {
    return {
        id: String(movieId),
        title: mediaData.title || mediaData.name || 'Untitled',
        poster_path: mediaData.poster_path || mediaData.image || '',
        release_date: mediaData.release_date || mediaData.first_air_date || '',
        media_type: mediaData.media_type || mediaData.type || 'movie',
        type: mediaData.type || mediaData.media_type || 'movie'
    };
}

function getLocalFollowingKey(appId, userId) {
    return `blist-following:${appId}:${userId}`;
}

function getLocalFollowing(appId, userId) {
    try {
        const entries = JSON.parse(localStorage.getItem(getLocalFollowingKey(appId, userId)) || '[]');
        return new Map(entries);
    } catch (e) {
        return new Map();
    }
}

function saveLocalFollowing(appId, userId, followingMap) {
    try {
        localStorage.setItem(getLocalFollowingKey(appId, userId), JSON.stringify(Array.from(followingMap.entries())));
        window.dispatchEvent(new CustomEvent('blist:followingChanged', {
            detail: { appId, userId }
        }));
    } catch (e) {
        console.error('saveLocalFollowing failed:', e);
    }
}

function mergeFollowing(remoteFollowing, localFollowing) {
    const merged = new Map(remoteFollowing);
    localFollowing.forEach((entry, key) => merged.set(key, entry));
    return merged;
}

function getStoredTime(value) {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
}

function getLocalActivityKey(appId) {
    return `blist-activity:${appId}`;
}

function getLocalActivity(appId) {
    try {
        return JSON.parse(localStorage.getItem(getLocalActivityKey(appId)) || '[]');
    } catch (error) {
        return [];
    }
}

function saveLocalActivity(appId, events) {
    try {
        localStorage.setItem(getLocalActivityKey(appId), JSON.stringify(events.slice(0, 100)));
        window.dispatchEvent(new CustomEvent('blist:activityChanged', { detail: { appId } }));
    } catch (error) {
        console.error('saveLocalActivity failed:', error);
    }
}

function mergeActivityEvents(remoteEvents = [], localEvents = []) {
    const merged = new Map();
    [...localEvents, ...remoteEvents].forEach(event => {
        if (event?.id) merged.set(String(event.id), event);
    });
    return Array.from(merged.values())
        .sort((a, b) => getStoredTime(b.createdAt) - getStoredTime(a.createdAt))
        .slice(0, 100);
}

function getUserInitialsFromName(nameOrEmail = 'U') {
    return String(nameOrEmail || 'U')
        .split(/[\s._-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0))
        .join('')
        .toUpperCase()
        .slice(0, 2) || 'U';
}

function buildPublicUserProfile(user = {}) {
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Blist User');
    return {
        uid: user.uid,
        displayName,
        username: displayName,
        usernameLower: String(displayName || '').toLowerCase(),
        email: user.email || '',
        photoURL: user.photoURL || '',
        bio: user.bio || '',
        publicProfile: user.publicProfile !== false,
        shareActivity: user.shareActivity !== false,
        activityVisibility: user.activityVisibility || 'public',
        initials: getUserInitialsFromName(displayName || user.email),
        lastActiveAt: new Date()
    };
}

function getLocalUsersKey(appId) {
    return `blist-users:${appId}`;
}

function getLocalUsers(appId) {
    try {
        const entries = JSON.parse(localStorage.getItem(getLocalUsersKey(appId)) || '[]');
        return new Map(entries);
    } catch (e) {
        return new Map();
    }
}

function saveLocalUsers(appId, usersMap) {
    try {
        localStorage.setItem(getLocalUsersKey(appId), JSON.stringify(Array.from(usersMap.entries())));
        window.dispatchEvent(new CustomEvent('blist:usersChanged', { detail: { appId } }));
    } catch (e) {
        console.error('saveLocalUsers failed:', e);
    }
}

function getLocalUserFollowsKey(appId, userId) {
    return `blist-user-follows:${appId}:${userId}`;
}

function getLocalUserFollows(appId, userId) {
    try {
        const entries = JSON.parse(localStorage.getItem(getLocalUserFollowsKey(appId, userId)) || '[]');
        return new Map(entries);
    } catch (e) {
        return new Map();
    }
}

function saveLocalUserFollows(appId, userId, followsMap) {
    try {
        localStorage.setItem(getLocalUserFollowsKey(appId, userId), JSON.stringify(Array.from(followsMap.entries())));
        window.dispatchEvent(new CustomEvent('blist:userFollowsChanged', {
            detail: { appId, userId }
        }));
    } catch (e) {
        console.error('saveLocalUserFollows failed:', e);
    }
}

function mergeUserFollows(remoteFollows, localFollows) {
    const merged = new Map(remoteFollows);
    localFollows.forEach((entry, key) => merged.set(key, entry));
    return merged;
}

function getLocalForumPostsKey(appId) {
    return `blist-forum-posts:${appId}`;
}

function getLocalForumPosts(appId) {
    try {
        return JSON.parse(localStorage.getItem(getLocalForumPostsKey(appId)) || '[]');
    } catch (e) {
        return [];
    }
}

function saveLocalForumPosts(appId, posts) {
    try {
        localStorage.setItem(getLocalForumPostsKey(appId), JSON.stringify(posts));
        window.dispatchEvent(new CustomEvent('blist:forumPostsChanged', { detail: { appId } }));
    } catch (e) {
        console.error('saveLocalForumPosts failed:', e);
    }
}

function getLocalForumCommentsKey(appId, postId) {
    return `blist-forum-comments:${appId}:${postId}`;
}

function getLocalForumComments(appId, postId) {
    try {
        return JSON.parse(localStorage.getItem(getLocalForumCommentsKey(appId, postId)) || '[]');
    } catch (e) {
        return [];
    }
}

function saveLocalForumComments(appId, postId, comments) {
    try {
        localStorage.setItem(getLocalForumCommentsKey(appId, postId), JSON.stringify(comments));
        window.dispatchEvent(new CustomEvent('blist:forumCommentsChanged', {
            detail: { appId, postId }
        }));
    } catch (e) {
        console.error('saveLocalForumComments failed:', e);
    }
}

function getLocalMovieReviewsKey(appId, movieId) {
    return `blist-movie-reviews:${appId}:${movieId}`;
}

function getLocalMovieReviews(appId, movieId) {
    try {
        return JSON.parse(localStorage.getItem(getLocalMovieReviewsKey(appId, movieId)) || '[]');
    } catch (e) {
        return [];
    }
}

function saveLocalMovieReviews(appId, movieId, reviews) {
    try {
        localStorage.setItem(getLocalMovieReviewsKey(appId, movieId), JSON.stringify(reviews));
        window.dispatchEvent(new CustomEvent('blist:movieReviewsChanged', {
            detail: { appId, movieId }
        }));
    } catch (e) {
        console.error('saveLocalMovieReviews failed:', e);
    }
}

function mergeRecordsById(remoteRecords = [], localRecords = []) {
    const merged = new Map();
    [...localRecords, ...remoteRecords].forEach((record) => {
        if (record?.id) merged.set(String(record.id), record);
    });
    return Array.from(merged.values());
}

function sortNewestFirst(records = []) {
    return [...records].sort((a, b) => getStoredTime(b.createdAt || b.updatedAt) - getStoredTime(a.createdAt || a.updatedAt));
}

function getPublicUserPayload(user = {}) {
    const displayName = user.displayName || user.username || (user.email ? user.email.split('@')[0] : 'Blist User');
    return {
        authorId: user.uid,
        authorName: displayName,
        authorInitials: user.initials || getUserInitialsFromName(displayName || user.email),
        authorPhotoURL: user.photoURL || ''
    };
}

function getUserMoviesCollection(appId, userId) {
    return collection(db, `artifacts/${appId}/users/${userId}/movies`);
}

async function updateMovieStatus(appId, userId, movieId, movieEntry) {
    const docPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
    return setDoc(doc(db, docPath), movieEntry, { merge: true });
}

async function removeMovieFromList(appId, userId, movieId) {
    const docPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
    return deleteDoc(doc(db, docPath));
}

async function updateAggregateRating(appId, movieId, newRating, oldRating) {
    const ratingRef = doc(db, `artifacts/${appId}/public/data/movie-ratings/${movieId}`);
    const normalizedNewRating = normalizeStoredRating(newRating);
    const normalizedOldRating = normalizeStoredRating(oldRating);
    if (!normalizedNewRating) return;

    await runTransaction(db, async (transaction) => {
        const ratingDoc = await transaction.get(ratingRef);
        const newBucket = getRatingBucket(normalizedNewRating);
        const oldBucket = normalizedOldRating ? getRatingBucket(normalizedOldRating) : null;
        if (!ratingDoc.exists()) {
            transaction.set(ratingRef, {
                totalRating: normalizedNewRating,
                ratingCount: 1,
                averageRating: normalizedNewRating,
                distribution: { [newBucket]: 1 }
            });
        } else {
            const data = ratingDoc.data();
            let newTotalRating = getNormalizedAggregateTotal(data);
            let newRatingCount = Number(data.ratingCount) || 0;
            const distribution = { ...(data.distribution || {}) };

            if (!normalizedOldRating) {
                newTotalRating += normalizedNewRating;
                newRatingCount++;
            } else {
                newTotalRating = newTotalRating - normalizedOldRating + normalizedNewRating;
                if (oldBucket) distribution[oldBucket] = Math.max(0, Number(distribution[oldBucket] || 0) - 1);
            }
            distribution[newBucket] = Number(distribution[newBucket] || 0) + 1;
            const newAverage = newTotalRating / newRatingCount;
            transaction.update(ratingRef, {
                totalRating: newTotalRating,
                ratingCount: newRatingCount,
                averageRating: newAverage,
                distribution
            });
        }
    });
}

async function removeAggregateRating(appId, movieId, oldRating) {
    if (oldRating === undefined || oldRating === null) return;

    const ratingRef = doc(db, `artifacts/${appId}/public/data/movie-ratings/${movieId}`);
    const normalizedOldRating = normalizeStoredRating(oldRating);
    if (!normalizedOldRating) return;

    await runTransaction(db, async (transaction) => {
        const ratingDoc = await transaction.get(ratingRef);
        if (!ratingDoc.exists()) return;

        const data = ratingDoc.data();
        const currentCount = Number(data.ratingCount) || 0;
        const nextCount = Math.max(0, currentCount - 1);

        if (nextCount === 0) {
            transaction.delete(ratingRef);
            return;
        }

        const distribution = { ...(data.distribution || {}) };
        const oldBucket = getRatingBucket(normalizedOldRating);
        distribution[oldBucket] = Math.max(0, Number(distribution[oldBucket] || 0) - 1);

        const nextTotal = Math.max(0, getNormalizedAggregateTotal(data) - normalizedOldRating);
        transaction.update(ratingRef, {
            totalRating: nextTotal,
            ratingCount: nextCount,
            averageRating: nextTotal / nextCount,
            distribution
        });
    });
}

async function getMovieAggregateRating(appId, movieId) {
    if (!appId || !movieId) return null;
    const ratingRef = doc(db, `artifacts/${appId}/public/data/movie-ratings/${movieId}`);
    try {
        const ratingDoc = await getDoc(ratingRef);
        return ratingDoc.exists() ? ratingDoc.data() : null;
    } catch (error) {
        console.error('getMovieAggregateRating failed:', error);
        return null;
    }
}

function subscribeToMovieAggregateRating(appId, movieId, callback) {
    if (!appId || !movieId || typeof callback !== 'function') {
        return () => {};
    }

    const ratingRef = doc(db, `artifacts/${appId}/public/data/movie-ratings/${movieId}`);
    return onSnapshot(ratingRef, (snapshot) => {
        callback(snapshot.exists() ? snapshot.data() : null);
    }, (error) => {
        console.error('subscribeToMovieAggregateRating failed:', error);
        callback(null);
    });
}

// New: Subscribe to realtime updates for a user's movies collection.
// Returns an unsubscribe function. Callback receives a Map of movieId -> movieData.
function subscribeToUserMovies(appId, userId, callback) {
    if (!appId || !userId) {
        // return no-op unsubscribe
        return () => {};
    }
    const q = collection(db, `artifacts/${appId}/users/${userId}/movies`);
    const unsub = onSnapshot(q, (snapshot) => {
        const latest = new Map();
        snapshot.forEach(d => latest.set(d.id, d.data()));
        callback(latest);
    }, (err) => {
        console.error('subscribeToUserMovies snapshot error:', err);
        // in error case, notify with empty map
        callback(new Map());
    });
    return unsub;
}

// New: updateUserRating wrapper that updates the user's doc and updates aggregate rating
async function updateUserRating(appId, userId, movieId, movieEntry, newRating, oldRating) {
    if (!appId || !userId) throw new Error('Missing appId or userId in updateUserRating');
    const docPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
    // ensure movieEntry contains title/poster_path/addedAt
    const entry = { ...movieEntry, rating: newRating, updatedAt: new Date() };
    await setDoc(doc(db, docPath), entry, { merge: true });
    try {
        await updateAggregateRating(appId, movieId, newRating, oldRating);
    } catch (e) {
        console.error('updateAggregateRating failed:', e);
    }
}

// New: updateWatchTime wrapper to set watch progress on the user movie doc
async function updateWatchTime(appId, userId, movieId, movieEntry, minutes) {
    if (!appId || !userId) throw new Error('Missing appId or userId in updateWatchTime');
    const docPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
    const entry = { ...movieEntry, watchTime: minutes, updatedAt: new Date() };
    return setDoc(doc(db, docPath), entry, { merge: true });
}

// New: updateEpisodesWatched wrapper to set episode progress for TV series
async function updateEpisodesWatched(appId, userId, movieId, movieEntry, episodes) {
    if (!appId || !userId) throw new Error('Missing appId or userId in updateEpisodesWatched');
    const docPath = `artifacts/${appId}/users/${userId}/movies/${movieId}`;
    const entry = { ...movieEntry, episodesWatched: episodes, updatedAt: new Date() };
    return setDoc(doc(db, docPath), entry, { merge: true });
}

// --- Playlist Management ---

/**
 * Returns the Firestore collection reference for a user's playlists.
 *
 * @param {string} appId - Application identifier used to namespace Firestore artifacts.
 * @param {string} userId - The UID of the user whose playlists collection is being accessed.
 * @returns {import('firebase/firestore').CollectionReference} Firestore collection reference for the user's playlists.
 */
function getUserPlaylistsCollection(appId, userId) {
    return collection(db, `artifacts/${appId}/users/${userId}/playlists`);
}

function getUserFollowingCollection(appId, userId) {
    return collection(db, `artifacts/${appId}/users/${userId}/following`);
}

function getUserFollowedUsersCollection(appId, userId) {
    return collection(db, `artifacts/${appId}/users/${userId}/user-following`);
}

function getUsersCollection(appId) {
    return collection(db, `artifacts/${appId}/users`);
}

function getForumPostsCollection(appId) {
    return collection(db, `artifacts/${appId}/public/data/forum-posts`);
}

function getForumCommentsCollection(appId, postId) {
    return collection(db, `artifacts/${appId}/public/data/forum-posts/${postId}/comments`);
}

function getMovieReviewsCollection(appId, movieId) {
    return collection(db, `artifacts/${appId}/public/data/movie-reviews/${movieId}/reviews`);
}

function getActivityCollection(appId) {
    return collection(db, `artifacts/${appId}/public/data/activity-events`);
}

async function publishActivityEvent(appId, user, eventData = {}) {
    if (!appId || !user?.uid) return null;
    const id = eventData.id || `activity_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const author = getPublicUserPayload(user);
    const createdAt = new Date();
    const entry = {
        id,
        actorId: String(user.uid),
        actorName: author.authorName,
        actorInitials: author.authorInitials,
        actorPhotoURL: author.authorPhotoURL,
        type: String(eventData.type || 'updated'),
        visibility: ['public', 'followers'].includes(eventData.visibility) ? eventData.visibility : 'public',
        mediaId: String(eventData.mediaId || ''),
        mediaType: String(eventData.mediaType || 'movie'),
        mediaTitle: String(eventData.mediaTitle || 'Untitled'),
        mediaPosterPath: String(eventData.mediaPosterPath || ''),
        rating: eventData.rating || null,
        season: eventData.season || null,
        episode: eventData.episode || null,
        createdAt
    };

    const localEvents = getLocalActivity(appId).filter(event => String(event.id) !== id);
    localEvents.unshift({ ...entry, createdAt: createdAt.toISOString() });
    saveLocalActivity(appId, localEvents);

    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/activity-events/${id}`), entry);
    } catch (error) {
        console.warn('publishActivityEvent Firestore write failed; saved locally instead:', error);
    }
    return entry;
}

function subscribeToActivityEvents(appId, callback) {
    if (!appId || typeof callback !== 'function') return () => {};
    let remoteEvents = [];
    let remoteAvailable = true;
    let remoteError = null;
    const emit = () => {
        callback(mergeActivityEvents(remoteEvents, getLocalActivity(appId)), { remoteAvailable, error: remoteError });
    };
    const handleLocalChange = event => {
        if (event.detail?.appId === appId) emit();
    };
    window.addEventListener('blist:activityChanged', handleLocalChange);
    emit();

    const activityQuery = query(getActivityCollection(appId), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(activityQuery, snapshot => {
        remoteEvents = [];
        snapshot.forEach(item => remoteEvents.push({ id: item.id, ...item.data() }));
        remoteAvailable = true;
        remoteError = null;
        emit();
    }, error => {
        console.error('subscribeToActivityEvents error:', error);
        remoteAvailable = false;
        remoteError = error;
        emit();
    });

    return () => {
        window.removeEventListener('blist:activityChanged', handleLocalChange);
        unsubscribe();
    };
}

async function deleteUserActivityEvents(appId, userId) {
    if (!appId || !userId) return;
    saveLocalActivity(appId, getLocalActivity(appId).filter(event => String(event.actorId) !== String(userId)));
    try {
        const snapshot = await getDocs(query(getActivityCollection(appId), where('actorId', '==', String(userId))));
        await Promise.all(snapshot.docs.map(item => deleteDoc(item.ref)));
    } catch (error) {
        console.warn('deleteUserActivityEvents failed:', error);
        throw error;
    }
}

async function updateActivitySharingPreference(appId, userId, enabled) {
    if (!appId || !userId) throw new Error('Missing appId or userId');
    const shareActivity = Boolean(enabled);
    if (!shareActivity) await deleteUserActivityEvents(appId, userId);
    await setDoc(doc(db, `artifacts/${appId}/users/${userId}`), { shareActivity }, { merge: true });
    const localUsers = getLocalUsers(appId);
    localUsers.set(String(userId), { ...(localUsers.get(String(userId)) || {}), uid: String(userId), shareActivity });
    saveLocalUsers(appId, localUsers);
    return shareActivity;
}

async function patchUserMovieAnalytics(appId, userId, movieId, analytics = {}) {
    if (!appId || !userId || !movieId) throw new Error('Missing analytics patch identifiers');
    const patch = {
        analytics,
        genres: analytics.genres || [],
        cast: analytics.cast || [],
        directors: analytics.directors || [],
        runtime: analytics.runtime || null,
        averageRuntime: analytics.averageRuntime || null,
        numberOfEpisodes: analytics.numberOfEpisodes || null,
        type: analytics.mediaType || null,
        analyticsVersion: 1,
        analyticsUpdatedAt: new Date()
    };
    return setDoc(doc(db, `artifacts/${appId}/users/${userId}/movies/${movieId}`), patch, { merge: true });
}

/**
 * Creates a new playlist document for the specified user.
 *
 * The playlist is initialized with an empty list of movie IDs and timestamps
 * for creation and last update.
 *
 * @param {string} appId - Application identifier used to namespace Firestore artifacts.
 * @param {string} userId - The UID of the user who owns the playlist.
 * @param {{ name?: string, description?: string, isPublic?: boolean }} playlistData - Initial data for the playlist.
 * @returns {Promise<{ id: string, name: string, description: string, isPublic: boolean, movieIds: string[], createdAt: Date, updatedAt: Date }>} 
 * A promise that resolves to the newly created playlist object, including its generated ID.
 */
async function createPlaylist(appId, userId, playlistData) {
    if (!appId || !userId) throw new Error('Missing appId or userId in createPlaylist');
    
    const playlistsCol = getUserPlaylistsCollection(appId, userId);
    const newPlaylistRef = doc(playlistsCol); // Auto-generate ID
    
    const playlist = {
        name: playlistData.name || 'Untitled Playlist',
        description: playlistData.description || '',
        isPublic: playlistData.isPublic || false,
        movieIds: [],
        mediaItems: {},
        createdAt: new Date(),
        updatedAt: new Date()
    };

    try {
        await setDoc(newPlaylistRef, playlist);
        return { id: newPlaylistRef.id, ...playlist };
    } catch (error) {
        console.warn('createPlaylist Firestore write failed; saving locally instead:', error);
        const localPlaylist = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...playlist,
            createdAt: playlist.createdAt.toISOString(),
            updatedAt: playlist.updatedAt.toISOString(),
            storage: 'local'
        };
        const playlists = getLocalPlaylists(appId, userId);
        playlists.push(localPlaylist);
        saveLocalPlaylists(appId, userId, playlists);
        return localPlaylist;
    }
}

// Subscribe to user's playlists
function subscribeToUserPlaylists(appId, userId, callback) {
    if (!appId || !userId) {
        return () => {};
    }
    
    const q = getUserPlaylistsCollection(appId, userId);
    const emit = (remotePlaylists = []) => {
        callback(mergePlaylists(remotePlaylists, getLocalPlaylists(appId, userId)));
    };
    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId && event.detail?.userId === userId) {
            emit();
        }
    };
    window.addEventListener('blist:playlistsChanged', handleLocalChange);
    emit();
    const unsub = onSnapshot(q, (snapshot) => {
        const playlists = [];
        snapshot.forEach(d => playlists.push({ id: d.id, ...d.data() }));
        emit(playlists);
    }, (err) => {
        console.error('subscribeToUserPlaylists error:', err);
        emit();
    });
    
    return () => {
        window.removeEventListener('blist:playlistsChanged', handleLocalChange);
        unsub();
    };
}

// Delete a playlist
async function deletePlaylist(appId, userId, playlistId) {
    if (!appId || !userId || !playlistId) throw new Error('Missing required parameters in deletePlaylist');
    if (String(playlistId).startsWith('local_')) {
        const playlists = getLocalPlaylists(appId, userId)
            .filter(playlist => String(playlist.id) !== String(playlistId));
        saveLocalPlaylists(appId, userId, playlists);
        return;
    }

    const docPath = `artifacts/${appId}/users/${userId}/playlists/${playlistId}`;
    try {
        return await deleteDoc(doc(db, docPath));
    } catch (error) {
        const playlists = getLocalPlaylists(appId, userId)
            .filter(playlist => String(playlist.id) !== String(playlistId));
        saveLocalPlaylists(appId, userId, playlists);
        throw error;
    }
}

// Add a movie to a playlist
async function addMovieToPlaylist(appId, userId, playlistId, movieId, mediaData = {}) {
    if (!appId || !userId || !playlistId || !movieId) {
        throw new Error('Missing required parameters in addMovieToPlaylist');
    }

    const updateLocal = () => updateLocalPlaylist(appId, userId, playlistId, playlist => {
        const movieIds = Array.isArray(playlist.movieIds) ? [...playlist.movieIds] : [];
        if (!movieIds.includes(movieId)) movieIds.push(movieId);
        const mediaItems = { ...(playlist.mediaItems || {}) };
        mediaItems[movieId] = normalizePlaylistMediaData(movieId, mediaData);
        return { ...playlist, movieIds, mediaItems, updatedAt: new Date().toISOString() };
    });

    if (String(playlistId).startsWith('local_')) {
        if (updateLocal()) return;
        throw new Error('Playlist not found');
    }
    
    const playlistRef = doc(db, `artifacts/${appId}/users/${userId}/playlists/${playlistId}`);
    try {
        await runTransaction(db, async (transaction) => {
            const playlistDoc = await transaction.get(playlistRef);
            if (!playlistDoc.exists()) {
                throw new Error('Playlist not found');
            }
            
            const data = playlistDoc.data();
            const movieIds = data.movieIds || [];
            const mediaItems = { ...(data.mediaItems || {}) };
            mediaItems[movieId] = normalizePlaylistMediaData(movieId, mediaData);
            
            if (!movieIds.includes(movieId)) {
                movieIds.push(movieId);
            }
            transaction.update(playlistRef, {
                movieIds,
                mediaItems,
                updatedAt: new Date()
            });
        });
    } catch (error) {
        if (!updateLocal()) throw error;
    }
}

// Remove a movie from a playlist
async function removeMovieFromPlaylist(appId, userId, playlistId, movieId) {
    if (!appId || !userId || !playlistId || !movieId) {
        throw new Error('Missing required parameters in removeMovieFromPlaylist');
    }

    const updateLocal = () => updateLocalPlaylist(appId, userId, playlistId, playlist => ({
        ...playlist,
        movieIds: (playlist.movieIds || []).filter(id => String(id) !== String(movieId)),
        mediaItems: Object.fromEntries(
            Object.entries(playlist.mediaItems || {}).filter(([id]) => String(id) !== String(movieId))
        ),
        updatedAt: new Date().toISOString()
    }));

    if (String(playlistId).startsWith('local_')) {
        if (updateLocal()) return;
        throw new Error('Playlist not found');
    }
    
    const playlistRef = doc(db, `artifacts/${appId}/users/${userId}/playlists/${playlistId}`);
    try {
        await runTransaction(db, async (transaction) => {
            const playlistDoc = await transaction.get(playlistRef);
            if (!playlistDoc.exists()) {
                throw new Error('Playlist not found');
            }
            
            const data = playlistDoc.data();
            const movieIds = (data.movieIds || []).filter(id => id !== movieId);
            const mediaItems = Object.fromEntries(
                Object.entries(data.mediaItems || {}).filter(([id]) => String(id) !== String(movieId))
            );
            
            transaction.update(playlistRef, {
                movieIds,
                mediaItems,
                updatedAt: new Date()
            });
        });
    } catch (error) {
        if (!updateLocal()) throw error;
    }
}

async function upsertFollowedPerson(appId, userId, followId, followEntry) {
    if (!appId || !userId || !followId) throw new Error('Missing required parameters in upsertFollowedPerson');
    const localFollowing = getLocalFollowing(appId, userId);
    localFollowing.set(followId, {
        ...followEntry,
        updatedAt: new Date().toISOString()
    });
    saveLocalFollowing(appId, userId, localFollowing);

    const docPath = `artifacts/${appId}/users/${userId}/following/${followId}`;
    const entry = { ...followEntry, updatedAt: new Date() };
    try {
        return await setDoc(doc(db, docPath), entry, { merge: true });
    } catch (error) {
        console.warn('upsertFollowedPerson Firestore write failed; saved locally instead:', error);
        return null;
    }
}

async function removeFollowedPerson(appId, userId, followId) {
    if (!appId || !userId || !followId) throw new Error('Missing required parameters in removeFollowedPerson');
    const localFollowing = getLocalFollowing(appId, userId);
    localFollowing.delete(followId);
    saveLocalFollowing(appId, userId, localFollowing);

    const docPath = `artifacts/${appId}/users/${userId}/following/${followId}`;
    try {
        return await deleteDoc(doc(db, docPath));
    } catch (error) {
        console.warn('removeFollowedPerson Firestore delete failed; removed locally instead:', error);
        return null;
    }
}

function subscribeToUserFollowing(appId, userId, callback) {
    if (!appId || !userId) {
        return () => {};
    }

    const q = getUserFollowingCollection(appId, userId);
    const emit = (remoteFollowing = new Map()) => {
        callback(mergeFollowing(remoteFollowing, getLocalFollowing(appId, userId)));
    };
    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId && event.detail?.userId === userId) {
            emit();
        }
    };
    window.addEventListener('blist:followingChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(q, (snapshot) => {
        const followed = new Map();
        snapshot.forEach(d => followed.set(d.id, d.data()));
        emit(followed);
    }, (err) => {
        console.error('subscribeToUserFollowing error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:followingChanged', handleLocalChange);
        unsub();
    };
}

async function upsertPublicUserProfile(appId, user) {
    if (!appId || !user?.uid) return null;

    const localUsers = getLocalUsers(appId);
    let existingProfile = localUsers.get(user.uid) || {};
    let reservedUsername = '';

    try {
        const existingDoc = await getDoc(doc(db, `artifacts/${appId}/users/${user.uid}`));
        if (existingDoc.exists()) existingProfile = { ...existingProfile, ...existingDoc.data() };

        const reservationSnapshot = await getDocs(query(
            collection(db, `artifacts/${appId}/usernames`),
            where('userId', '==', user.uid)
        ));
        reservedUsername = reservationSnapshot.empty ? '' : String(reservationSnapshot.docs[0].data()?.username || '');
    } catch (error) {
        console.warn('Could not resolve the stored username; using available profile data:', error);
    }

    const emailPrefix = user.email ? user.email.split('@')[0] : '';
    const isPlaceholder = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return !normalized || normalized === 'user' || normalized === 'blist user' || normalized === emailPrefix.toLowerCase();
    };
    const authName = String(user.displayName || '').trim();
    const storedUsername = String(existingProfile.username || existingProfile.displayName || '').trim();
    const username = !isPlaceholder(authName)
        ? authName
        : (reservedUsername || (!isPlaceholder(storedUsername) ? storedUsername : '') || 'Blist Member');
    const profile = {
        ...buildPublicUserProfile({ ...user, displayName: username }),
        username,
        usernameLower: username.toLowerCase(),
        displayName: username,
        photoURL: user.preserveExistingPrivacy && !user.preferLocalProfile && existingProfile.photoURL
            ? String(existingProfile.photoURL)
            : String(user.photoURL || ''),
        email: user.preserveExistingPrivacy && Object.prototype.hasOwnProperty.call(existingProfile, 'email')
            ? String(existingProfile.email || '')
            : String(user.email || ''),
        bio: user.preserveExistingPrivacy && !user.preferLocalProfile
            ? String(existingProfile.bio || '')
            : (user.bio !== undefined ? String(user.bio || '') : String(existingProfile.bio || '')),
        publicProfile: user.preserveExistingPrivacy
            ? existingProfile.publicProfile !== false
            : (user.publicProfile !== undefined ? user.publicProfile !== false : existingProfile.publicProfile !== false),
        shareActivity: user.preserveExistingPrivacy
            ? existingProfile.shareActivity !== false
            : (user.shareActivity !== undefined ? user.shareActivity !== false : existingProfile.shareActivity !== false),
        activityVisibility: user.preserveExistingPrivacy
            ? (existingProfile.activityVisibility || 'public')
            : (user.activityVisibility || existingProfile.activityVisibility || 'public')
    };

    localUsers.set(user.uid, {
        ...existingProfile,
        ...profile,
        lastActiveAt: new Date().toISOString()
    });
    saveLocalUsers(appId, localUsers);

    try {
        await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), profile, { merge: true });
    } catch (error) {
        console.warn('upsertPublicUserProfile Firestore write failed; saved locally instead:', error);
    }

    return profile;
}

function subscribeToSuggestedUsers(appId, currentUserId, callback) {
    if (!appId || typeof callback !== 'function') {
        return () => {};
    }

    const emit = (remoteUsers = []) => {
        const merged = new Map(getLocalUsers(appId));
        remoteUsers.forEach((profile) => {
            const uid = profile.uid || profile.id;
            if (uid) merged.set(String(uid), { ...profile, uid: String(uid) });
        });

        const users = Array.from(merged.values())
            .filter(profile => profile?.uid && String(profile.uid) !== String(currentUserId || ''))
            .filter(profile => profile.publicProfile !== false)
            .sort((a, b) => getStoredTime(b.lastActiveAt || b.updatedAt || b.createdAt) - getStoredTime(a.lastActiveAt || a.updatedAt || a.createdAt));

        callback(users);
    };

    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId) emit();
    };
    window.addEventListener('blist:usersChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(getUsersCollection(appId), (snapshot) => {
        const users = [];
        snapshot.forEach(d => users.push({ id: d.id, uid: d.id, ...d.data() }));
        emit(users);
    }, (err) => {
        console.error('subscribeToSuggestedUsers error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:usersChanged', handleLocalChange);
        unsub();
    };
}

async function upsertFollowedUser(appId, userId, targetUserId, targetUser = {}) {
    if (!appId || !userId || !targetUserId) throw new Error('Missing required parameters in upsertFollowedUser');

    const displayName = targetUser.displayName || targetUser.username || 'Blist User';
    const entry = {
        uid: String(targetUserId),
        displayName,
        username: targetUser.username || displayName,
        email: targetUser.email || '',
        photoURL: targetUser.photoURL || '',
        initials: targetUser.initials || getUserInitialsFromName(displayName || targetUser.email),
        followedAt: new Date(),
        updatedAt: new Date()
    };

    const localFollows = getLocalUserFollows(appId, userId);
    localFollows.set(String(targetUserId), {
        ...entry,
        followedAt: entry.followedAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
    });
    saveLocalUserFollows(appId, userId, localFollows);

    try {
        await setDoc(doc(db, `artifacts/${appId}/users/${userId}/user-following/${targetUserId}`), entry, { merge: true });
    } catch (error) {
        console.warn('upsertFollowedUser Firestore write failed; saved locally instead:', error);
    }

    return entry;
}

async function removeFollowedUser(appId, userId, targetUserId) {
    if (!appId || !userId || !targetUserId) throw new Error('Missing required parameters in removeFollowedUser');

    const localFollows = getLocalUserFollows(appId, userId);
    localFollows.delete(String(targetUserId));
    saveLocalUserFollows(appId, userId, localFollows);

    try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/user-following/${targetUserId}`));
    } catch (error) {
        console.warn('removeFollowedUser Firestore delete failed; removed locally instead:', error);
    }
}

function subscribeToUserFollows(appId, userId, callback) {
    if (!appId || !userId || typeof callback !== 'function') {
        return () => {};
    }

    const emit = (remoteFollows = new Map()) => {
        callback(mergeUserFollows(remoteFollows, getLocalUserFollows(appId, userId)));
    };

    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId && event.detail?.userId === userId) emit();
    };
    window.addEventListener('blist:userFollowsChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(getUserFollowedUsersCollection(appId, userId), (snapshot) => {
        const follows = new Map();
        snapshot.forEach(d => follows.set(d.id, { uid: d.id, ...d.data() }));
        emit(follows);
    }, (err) => {
        console.error('subscribeToUserFollows error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:userFollowsChanged', handleLocalChange);
        unsub();
    };
}

async function createForumPost(appId, user, postData = {}) {
    if (!appId || !user?.uid) throw new Error('Please log in to post.');

    const postId = postData.id || `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const author = getPublicUserPayload(user);
    const entry = {
        id: postId,
        type: postData.type || 'post',
        body: String(postData.body || '').trim(),
        title: String(postData.title || '').trim(),
        mediaId: postData.mediaId || '',
        mediaTitle: postData.mediaTitle || '',
        mediaPosterPath: postData.mediaPosterPath || '',
        commentCount: 0,
        scoreHint: 0,
        ...author,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    if (!entry.body) throw new Error('Post text is required.');

    const localPosts = getLocalForumPosts(appId).filter(post => String(post.id) !== postId);
    localPosts.unshift({ ...entry, createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() });
    saveLocalForumPosts(appId, localPosts);

    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/forum-posts/${postId}`), entry, { merge: true });
    } catch (error) {
        console.warn('createForumPost Firestore write failed; saved locally instead:', error);
    }

    return entry;
}

function subscribeToForumPosts(appId, callback) {
    if (!appId || typeof callback !== 'function') {
        return () => {};
    }

    const emit = (remotePosts = []) => {
        callback(sortNewestFirst(mergeRecordsById(remotePosts, getLocalForumPosts(appId))));
    };

    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId) emit();
    };
    window.addEventListener('blist:forumPostsChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(getForumPostsCollection(appId), (snapshot) => {
        const posts = [];
        snapshot.forEach(d => posts.push({ id: d.id, ...d.data() }));
        emit(posts);
    }, (err) => {
        console.error('subscribeToForumPosts error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:forumPostsChanged', handleLocalChange);
        unsub();
    };
}

async function createForumComment(appId, user, postId, commentData = {}) {
    if (!appId || !user?.uid) throw new Error('Please log in to comment.');
    if (!postId) throw new Error('Missing post id.');

    const commentId = commentData.id || `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const author = getPublicUserPayload(user);
    const entry = {
        id: commentId,
        postId: String(postId),
        body: String(commentData.body || '').trim(),
        ...author,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    if (!entry.body) throw new Error('Comment text is required.');

    const localComments = getLocalForumComments(appId, postId).filter(comment => String(comment.id) !== commentId);
    localComments.push({ ...entry, createdAt: entry.createdAt.toISOString(), updatedAt: entry.updatedAt.toISOString() });
    saveLocalForumComments(appId, postId, localComments);

    const localPosts = getLocalForumPosts(appId).map(post => (
        String(post.id) === String(postId)
            ? { ...post, commentCount: Number(post.commentCount || 0) + 1, updatedAt: new Date().toISOString() }
            : post
    ));
    saveLocalForumPosts(appId, localPosts);

    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/forum-posts/${postId}/comments/${commentId}`), entry, { merge: true });
        const postRef = doc(db, `artifacts/${appId}/public/data/forum-posts/${postId}`);
        await runTransaction(db, async (transaction) => {
            const postDoc = await transaction.get(postRef);
            const currentCount = postDoc.exists() ? Number(postDoc.data()?.commentCount || 0) : 0;
            transaction.set(postRef, {
                commentCount: currentCount + 1,
                updatedAt: new Date()
            }, { merge: true });
        });
    } catch (error) {
        console.warn('createForumComment Firestore write failed; saved locally instead:', error);
    }

    return entry;
}

function subscribeToForumComments(appId, postId, callback) {
    if (!appId || !postId || typeof callback !== 'function') {
        return () => {};
    }

    const emit = (remoteComments = []) => {
        callback(sortNewestFirst(mergeRecordsById(remoteComments, getLocalForumComments(appId, postId))).reverse());
    };

    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId && String(event.detail?.postId) === String(postId)) emit();
    };
    window.addEventListener('blist:forumCommentsChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(getForumCommentsCollection(appId, postId), (snapshot) => {
        const comments = [];
        snapshot.forEach(d => comments.push({ id: d.id, ...d.data() }));
        emit(comments);
    }, (err) => {
        console.error('subscribeToForumComments error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:forumCommentsChanged', handleLocalChange);
        unsub();
    };
}

async function upsertMovieReview(appId, user, movieId, mediaData = {}, reviewData = {}) {
    if (!appId || !user?.uid) throw new Error('Please log in to write a review.');
    if (!movieId) throw new Error('Missing movie id.');

    const author = getPublicUserPayload(user);
    const reviewId = String(user.uid);
    const entry = {
        id: reviewId,
        mediaId: String(movieId),
        mediaTitle: mediaData.title || mediaData.name || reviewData.mediaTitle || 'Untitled',
        mediaPosterPath: mediaData.poster_path || mediaData.image || reviewData.mediaPosterPath || '',
        text: String(reviewData.text || '').trim(),
        rating: reviewData.rating || null,
        ...author,
        createdAt: reviewData.createdAt || new Date(),
        updatedAt: new Date()
    };

    if (!entry.text) throw new Error('Review text is required.');

    const localReviews = getLocalMovieReviews(appId, movieId).filter(review => String(review.id) !== reviewId);
    localReviews.unshift({
        ...entry,
        createdAt: entry.createdAt?.toISOString ? entry.createdAt.toISOString() : entry.createdAt,
        updatedAt: entry.updatedAt.toISOString()
    });
    saveLocalMovieReviews(appId, movieId, localReviews);

    try {
        await setDoc(doc(db, `artifacts/${appId}/public/data/movie-reviews/${movieId}/reviews/${reviewId}`), entry, { merge: true });
    } catch (error) {
        console.warn('upsertMovieReview Firestore write failed; saved locally instead:', error);
    }

    return entry;
}

function subscribeToMovieReviews(appId, movieId, callback) {
    if (!appId || !movieId || typeof callback !== 'function') {
        return () => {};
    }

    const emit = (remoteReviews = []) => {
        callback(sortNewestFirst(mergeRecordsById(remoteReviews, getLocalMovieReviews(appId, movieId))));
    };

    const handleLocalChange = (event) => {
        if (event.detail?.appId === appId && String(event.detail?.movieId) === String(movieId)) emit();
    };
    window.addEventListener('blist:movieReviewsChanged', handleLocalChange);
    emit();

    const unsub = onSnapshot(getMovieReviewsCollection(appId, movieId), (snapshot) => {
        const reviews = [];
        snapshot.forEach(d => reviews.push({ id: d.id, ...d.data() }));
        emit(reviews);
    }, (err) => {
        console.error('subscribeToMovieReviews error:', err);
        emit();
    });

    return () => {
        window.removeEventListener('blist:movieReviewsChanged', handleLocalChange);
        unsub();
    };
}

export {
    getUserMoviesCollection,
    updateMovieStatus,
    removeMovieFromList,
    updateAggregateRating,
    removeAggregateRating,
    getMovieAggregateRating,
    subscribeToMovieAggregateRating,
    subscribeToUserMovies,
    updateUserRating,
    updateWatchTime,
    updateEpisodesWatched,
    createPlaylist,
    subscribeToUserPlaylists,
    deletePlaylist,
    addMovieToPlaylist,
    removeMovieFromPlaylist,
    upsertFollowedPerson,
    removeFollowedPerson,
    subscribeToUserFollowing,
    upsertPublicUserProfile,
    subscribeToSuggestedUsers,
    upsertFollowedUser,
    removeFollowedUser,
    subscribeToUserFollows,
    createForumPost,
    subscribeToForumPosts,
    createForumComment,
    subscribeToForumComments,
    upsertMovieReview,
    subscribeToMovieReviews,
    publishActivityEvent,
    subscribeToActivityEvents,
    deleteUserActivityEvents,
    updateActivitySharingPreference,
    patchUserMovieAnalytics
};
