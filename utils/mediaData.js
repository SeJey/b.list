/**
 * Media Data Utilities
 * Handles normalization, translation enrichment, and credit building for movies and TV series
 */

import { fetchTMDb } from '../api/tmdb.js';
// TVDB support is intentionally parked for legacy season/episode helpers,
// but active TV browse/search/details now use TMDb.
// import { getSeriesTranslation, getSeriesDetails, getSeriesSeasonEpisodeCount } from '../api/tvdb.js';

export const seasonEpisodeCountCache = new Map();
export const seasonCastCache = new Map();

/**
 * Normalize a series/movie item to a consistent format for rendering
 */
export function normalizeMediaItem(item, type) {
  if (type === 'movie') {
    return {
      ...item,
      type: 'movie',
      id: item.id,
      media_type: 'movie',
      dbId: `tmdb_${item.id}`,
      tmdbRating: item.vote_average || item.tmdbRating || null,
      release_date: item.release_date || item.year || null
    };
  } else if (type === 'series') {
    let seriesId = item.id || item.tvdb_id || item.objectID;
    if (seriesId && typeof seriesId === 'string' && seriesId.includes('-')) {
      const match = seriesId.match(/(\d+)$/);
      if (match) seriesId = match[1];
    }
    
    if (!seriesId) {
      console.error('No valid ID found in series item:', item);
    }

    const isTvdbItem = Boolean(item.tvdb_id || item.objectID || String(item.dbId || '').startsWith('tvdb_'));
    const dbId = item.dbId || (isTvdbItem ? `tvdb_${seriesId}` : `tmdb_tv_${seriesId}`);
    
    let titleEnglish = item.name || item.title || item.seriesName;
    const hasNonLatinTitle = /[^\u0000-\u007F\u0080-\u00FF]/.test(titleEnglish);
    item._needsTitleTranslation = hasNonLatinTitle;
    item._originalTitle = titleEnglish;
    
    let overview = item.overview || item.description || item.summary || 'No description available.';
    let overviewOriginal = overview;
    let overviewEnglish = overview;
    
    // Parse translations
    if (item.translations) {
      if (Array.isArray(item.translations)) {
        const engTranslation = item.translations.find(t => 
          t.language === 'eng' || t.language === 'en' || t.language === 'english' || 
          t.languageCode === 'eng' || t.languageCode === 'en'
        );
        if (engTranslation) {
          if (engTranslation.name) {
            titleEnglish = engTranslation.name;
          }
          if (engTranslation.overview) {
            overviewEnglish = engTranslation.overview;
          }
        }
      } else if (typeof item.translations === 'object') {
        if (item.translations.eng || item.translations.en) {
          overviewEnglish = item.translations.eng || item.translations.en;
        }
      }
    }
    
    // Check nameTranslations and overviewTranslations
    if (item.nameTranslations && Array.isArray(item.nameTranslations)) {
      const eng = item.nameTranslations.find(t => t.language === 'eng' || t.languageCode === 'eng');
      if (eng && eng.name) {
        titleEnglish = eng.name;
      }
    }
    
    if (item.overviewTranslations) {
      if (typeof item.overviewTranslations === 'object' && !Array.isArray(item.overviewTranslations)) {
        if (item.overviewTranslations.eng || item.overviewTranslations.en) {
          overviewEnglish = item.overviewTranslations.eng || item.overviewTranslations.en;
        }
      } else if (Array.isArray(item.overviewTranslations)) {
        const eng = item.overviewTranslations.find(t => t.language === 'eng' || t.languageCode === 'eng');
        if (eng && eng.overview) {
          overviewEnglish = eng.overview;
        }
      }
    }
    
    const hasNonLatinChars = /[^\u0000-\u007F\u0080-\u00FF]/.test(overview);
    
    const seasonsArray = Array.isArray(item.seasons) ? item.seasons : [];
    const seasonNumbers = Array.from(new Set(
      seasonsArray
        .map(s => Number(s.number ?? s.season_number))
        .filter(n => Number.isInteger(n) && n > 0)
    ));
    const derivedSeasonCount = seasonNumbers.length ? Math.max(...seasonNumbers) : null;

    const normalized = {
      ...item,
      type: 'series',
      id: seriesId,
      media_type: 'tv',
      dbId,
      title: titleEnglish,
      poster_path: item.image || item.poster_path || item.image_url || item.thumbnail,
      first_air_date: item.first_air_date || item.year || item.firstAired,
      overview: overviewEnglish,
      overviewOriginal: overviewOriginal,
      overviewEnglish: overviewEnglish,
      hasMultipleLanguages: overviewOriginal !== overviewEnglish,
      needsTranslation: hasNonLatinChars && overviewOriginal === overviewEnglish,
      release_date: item.first_air_date || item.year || item.firstAired,
      numberOfSeasons: item.numberOfSeasons || item.number_of_seasons || derivedSeasonCount || (seasonsArray.length || null),
      tmdbRating: item.vote_average || item.tmdbRating || null,
      tvdbRating: item.tvdbRating || null,
      averageRuntime: Array.isArray(item.episode_run_time) ? item.episode_run_time[0] : item.averageRuntime,
      seasons: seasonsArray,
      defaultSeasonType: item.defaultSeasonType || null
    };
    
    return normalized;
  }
  return item;
}

/**
 * Enrich series with English title if needed
 */
export async function enrichSeriesWithEnglishTitle(series) {
  if (series._needsTitleTranslation) {
    try {
      const { getSeriesTranslation } = await import('../api/tvdb.js');
      const translation = await getSeriesTranslation(series.id, 'eng');
      
      if (translation && translation.name) {
        series.title = translation.name;
        return series;
      }
    } catch (err) {
      console.error('Failed to fetch English translation from TVDB API:', err);
    }
    
    // Fallback: check extended series details
    try {
      const { getSeriesDetails } = await import('../api/tvdb.js');
      const details = await getSeriesDetails(series.id);
      
      if (details) {
        let englishTitle = null;
        
        // Check aliases
        if (details.aliases && Array.isArray(details.aliases)) {
          const engAlias = details.aliases.find(a => 
            (a.language === 'eng' || a.language === 'en') && a.name
          );
          if (engAlias) {
            englishTitle = engAlias.name;
          }
        }
        
        // Check nameTranslations
        if (!englishTitle && details.nameTranslations && Array.isArray(details.nameTranslations)) {
          const engTrans = details.nameTranslations.find(t => 
            t.language === 'eng' || t.language === 'en'
          );
          if (engTrans && engTrans.name) {
            englishTitle = engTrans.name;
          }
        }
        
        if (englishTitle) {
          series.title = englishTitle;
          return series;
        }
      }
    } catch (err) {
      console.error('Failed to fetch series details:', err);
    }
  }
  
  return series;
}

/**
 * Check if TVDB series has English overview
 */
export function tvdbHasEnglishOverview(item) {
  const translations = item?.translations;
  if (Array.isArray(translations)) {
    return translations.some(t => (t.language || t.languageCode) === 'eng' && t.overview);
  }
  if (translations && typeof translations === 'object') {
    return Boolean(translations.eng || translations.en);
  }
  
  const overviewTranslations = item?.overviewTranslations;
  if (Array.isArray(overviewTranslations)) {
    return overviewTranslations.some(t => (t.language || t.languageCode) === 'eng' && t.overview);
  }
  if (overviewTranslations && typeof overviewTranslations === 'object') {
    return Boolean(overviewTranslations.eng || overviewTranslations.en);
  }
  
  return false;
}

/**
 * Build credits object from TVDB series data
 */
export function buildTvdbCredits(series) {
  const credits = { cast: [], crew: [] };
  const characters = Array.isArray(series?.characters) ? series.characters : [];
  
  const cast = characters
    .map((ch) => {
      const name = ch.personName || ch.name || ch.person?.name || ch.characterName || ch.character?.name;
      const id = ch.peopleId || ch.personId || ch.person?.id || ch.id;
      return name ? { id, name } : null;
    })
    .filter(Boolean);
  
  const uniqueCast = Array.from(new Map(cast.map(c => [c.name, c])).values());
  credits.cast = uniqueCast;

  const peopleBuckets = [series?.people, series?.seriesPeople, series?.peopleBase];
  const people = peopleBuckets.flatMap(bucket => Array.isArray(bucket) ? bucket : []);
  
  const possibleDirector = people.find(p => {
    const role = (p.peopleType || p.role || p.job || p.type || '').toString().toLowerCase();
    return role.includes('director');
  });
  
  if (possibleDirector) {
    const name = possibleDirector.personName || possibleDirector.name || possibleDirector.person?.name;
    if (name) credits.crew.push({ job: 'Director', name });
  }
  
  if (!credits.crew.length) {
    const possibleCreator = people.find(p => {
      const role = (p.peopleType || p.role || p.job || p.type || '').toString().toLowerCase();
      return role.includes('creator') || role.includes('created');
    });
    const name = possibleCreator?.personName || possibleCreator?.name || possibleCreator?.person?.name;
    if (name) credits.crew.push({ job: 'Creator', name });
  }

  return credits;
}

/**
 * Get season type slug for TVDB series
 */
export function getSeriesSeasonTypeSlug(series) {
  const seasons = Array.isArray(series.seasons) ? series.seasons : [];
  if (series.defaultSeasonType && seasons.length) {
    const match = seasons.find(s => s.type && Number(s.type.id) === Number(series.defaultSeasonType));
    if (match && match.type && match.type.type) return String(match.type.type);
  }
  const firstType = seasons.find(s => s.type && s.type.type);
  return firstType ? String(firstType.type.type) : 'default';
}

/**
 * Get total episode count for a season with caching
 */
export async function getSeasonEpisodeTotal(series, seasonNumber) {
  const seasons = Array.isArray(series?.seasons) ? series.seasons : [];
  const tmdbSeason = seasons.find(s => Number(s.number ?? s.season_number) === Number(seasonNumber));
  if (Number.isFinite(Number(tmdbSeason?.episode_count))) {
    return Number(tmdbSeason.episode_count);
  }

  const seriesId = String(series.id || '').replace('tvdb_', '');
  const seasonType = getSeriesSeasonTypeSlug(series);
  const cacheKey = `${seriesId}:${seasonType}:${seasonNumber}`;
  
  if (seasonEpisodeCountCache.has(cacheKey)) {
    return seasonEpisodeCountCache.get(cacheKey);
  }
  
  const { getSeriesSeasonEpisodeCount } = await import('../api/tvdb.js');
  const total = await getSeriesSeasonEpisodeCount(seriesId, seasonType, seasonNumber);
  if (typeof total === 'number') seasonEpisodeCountCache.set(cacheKey, total);
  return total;
}

/**
 * Get season ID for a given season number
 */
export function getSeasonIdForNumber(series, seasonNumber) {
  const seasons = Array.isArray(series?.seasons) ? series.seasons : [];
  const preferred = series?.defaultSeasonType
    ? seasons.filter(s => s.type && Number(s.type.id) === Number(series.defaultSeasonType))
    : seasons;
  const match = preferred.find(s => Number(s.number ?? s.season_number) === Number(seasonNumber));
  if (match?.id) return match.id;
  const fallback = seasons.find(s => Number(s.number ?? s.season_number) === Number(seasonNumber));
  return fallback?.id || null;
}

/**
 * Build cast list from TVDB series data
 */
export function buildTvdbCastFromData(data) {
  const characters = Array.isArray(data?.characters) ? data.characters : [];
  const castFromCharacters = characters
    .map((ch) => {
      const name = ch.personName || ch.name || ch.person?.name || ch.characterName || ch.character?.name;
      const id = ch.peopleId || ch.personId || ch.person?.id || ch.id;
      return name ? { id, name } : null;
    })
    .filter(Boolean);

  const peopleBuckets = [data?.people, data?.seriesPeople, data?.peopleBase];
  const people = peopleBuckets.flatMap(bucket => Array.isArray(bucket) ? bucket : []);
  
  const castFromPeople = people
    .map((p) => {
      const role = (p.peopleType || p.role || p.job || p.type || '').toString().toLowerCase();
      const isCastRole = role.includes('actor') || role.includes('actress') || role.includes('cast') || 
                         role.includes('guest') || role.includes('host') || role.includes('character');
      if (role && !isCastRole) return null;
      const name = p.personName || p.name || p.person?.name;
      const id = p.peopleId || p.personId || p.person?.id || p.id;
      return name ? { id, name } : null;
    })
    .filter(Boolean);

  const merged = [...castFromCharacters, ...castFromPeople];
  return Array.from(new Map(merged.map(c => [c.name, c])).values());
}

/**
 * Get series network names from various fields
 */
export function getSeriesNetworkNames(series) {
  const names = new Set();
  const addName = (value) => {
    if (!value) return;
    if (typeof value === 'string') {
      names.add(value.trim());
      return;
    }
    if (value.name) names.add(String(value.name).trim());
  };

  addName(series.network);
  addName(series.studio);
  addName(series.company);

  const networks = Array.isArray(series.networks) ? series.networks : [];
  networks.forEach(addName);

  const companies = Array.isArray(series.companies) ? series.companies : [];
  companies.forEach(addName);

  return Array.from(names).filter(Boolean);
}
