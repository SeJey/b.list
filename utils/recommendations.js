/**
 * Recommendations Engine
 * Implements recommendation algorithm based on watched movies and genres
 */

export function getGenreScores(watchedMovies) {
  // Extract all genres from watched movies and score them
  const genreMap = new Map();
  watchedMovies.forEach(movie => {
    const genres = Array.isArray(movie.genres) ? movie.genres : [];
    genres.forEach(genre => {
      const key = genre.id || genre;
      genreMap.set(key, (genreMap.get(key) || 0) + 1);
    });
  });
  return genreMap;
}

export function scoreMovie(movie, genreScores, watchedIds) {
  // Don't recommend movies already in the list
  if (watchedIds.has(movie.dbId || movie.id)) return 0;
  
  // Calculate genre match score
  const movieGenres = Array.isArray(movie.genres) ? movie.genres : [];
  let genreScore = 0;
  movieGenres.forEach(genre => {
    const key = genre.id || genre;
    genreScore += genreScores.get(key) || 0;
  });
  
  // Normalize genre score (0-100)
  const maxGenreScore = Math.max(...genreScores.values()) * movieGenres.length;
  const normalizedGenreScore = maxGenreScore > 0 ? (genreScore / maxGenreScore) * 100 : 0;
  
  // Rating score (higher is better)
  const rating = (movie.vote_average || 0) / 10;
  const ratingScore = rating * 100;
  
  // Popularity score (higher is better)
  const popularity = Math.min((movie.popularity || 0) / 50 * 100, 100);
  
  // Combine scores (40% genre, 35% rating, 25% popularity)
  const finalScore = (normalizedGenreScore * 0.4) + (ratingScore * 0.35) + (popularity * 0.25);
  
  return finalScore;
}
