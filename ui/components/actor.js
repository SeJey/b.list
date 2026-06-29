import { IMAGE_BASE_URL } from '../../api/tmdb.js';
import { escapeAttribute, escapeHtml } from '../../utils/helpers.js';

export function renderActorPage(person, credits) {
    const name = person?.name || 'Unknown';
    const profile = person?.profile_path
        ? `${IMAGE_BASE_URL}${person.profile_path}`
        : 'https://placehold.co/300x450/1f2937/4b5563?text=No+Image';
    const knownFor = (credits && credits.cast)
        ? credits.cast.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 12)
        : [];

    return `
        <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-4">
                <img src="${escapeAttribute(profile)}" alt="${escapeAttribute(name)}" class="w-28 rounded-md object-cover">
                <div>
                    <h2 class="text-2xl font-bold text-white">${escapeHtml(name)}</h2>
                    <div class="text-sm text-gray-300">${escapeHtml(person?.known_for_department || '')} &bull; Born: ${escapeHtml(person?.birthday || 'N/A')}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                ${person?.id ? `<button type="button" class="follow-person-btn bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-md text-sm" data-person-id="${escapeAttribute(person.id)}" data-person-type="actor" data-person-name="${escapeAttribute(name)}" data-profile-path="${escapeAttribute(person.profile_path || '')}">Follow</button>` : ''}
                <button type="button" id="actor-back-btn" class="bg-gray-700 text-white px-3 py-1 rounded-md">Back</button>
            </div>
        </div>
        <div class="text-sm text-gray-300 mb-4">${escapeHtml(person?.biography || 'No biography available.')}</div>
        <h3 class="text-lg font-semibold text-white mb-2">Credits</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            ${knownFor.map(m => `<div class="cursor-pointer bg-gray-800 rounded-md p-2" data-movie-id="${escapeAttribute(m.id)}">
                <div class="font-semibold text-white text-sm truncate">${escapeHtml(m.title || m.name || 'Untitled')}</div>
                <div class="text-xs text-gray-300">${escapeHtml((m.release_date || m.first_air_date || '').slice(0, 4))}</div>
            </div>`).join('')}
        </div>
    `;
}

export function renderActorModal(person, credits) {
    const name = person?.name || 'Unknown';
    const profile = person?.profile_path
        ? `${IMAGE_BASE_URL}${person.profile_path}`
        : 'https://placehold.co/300x450/1f2937/4b5563?text=No+Image';
    const knownFor = (credits && credits.cast) ? credits.cast.slice(0, 8) : [];
    const bio = person?.biography
        ? `${person.biography.substring(0, 200)}${person.biography.length > 200 ? '...' : ''}`
        : 'No biography available.';

    return `
        <button type="button" id="close-actor-modal" aria-label="Close actor details" class="absolute top-4 right-6 text-gray-300 hover:text-white text-2xl">&times;</button>
        <div class="flex flex-col md:flex-row gap-4">
            <div class="w-full md:w-40 flex-shrink-0">
                <img src="${escapeAttribute(profile)}" alt="${escapeAttribute(name)}" class="w-full rounded-md object-cover">
            </div>
            <div class="flex-1">
                <div class="flex items-center justify-between gap-3 mb-2">
                    <h2 class="text-xl font-bold text-white">${escapeHtml(name)}</h2>
                    ${person?.id ? `<button type="button" class="follow-person-btn bg-sky-600 hover:bg-sky-500 text-white px-3 py-1 rounded-md text-sm" data-person-id="${escapeAttribute(person.id)}" data-person-type="actor" data-person-name="${escapeAttribute(name)}" data-profile-path="${escapeAttribute(person.profile_path || '')}">Follow</button>` : ''}
                </div>
                <p class="text-sm text-gray-300 mb-3">${escapeHtml(person?.known_for_department || '')} &bull; Born: ${escapeHtml(person?.birthday || 'N/A')}</p>
                <p class="text-sm text-gray-300 mb-4">${escapeHtml(bio)}</p>
                <h3 class="text-sm font-semibold text-white mb-2">Known For</h3>
                <div class="flex flex-wrap gap-2 mt-1">
                    ${knownFor.map(m => `<div class="bg-gray-700 rounded-md px-2 py-1 text-xs text-gray-200 cursor-pointer movie-ref" data-movie-id="${escapeAttribute(m.id)}">${escapeHtml(m.title || m.name || 'Untitled')}</div>`).join('')}
                </div>
            </div>
        </div>
    `;
}
