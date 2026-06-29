// IMPORTANT: Do not commit API keys or Firebase credentials to version control.
// For local development, create config.local.js next to this file. It is gitignored.

// Example config.local.js:
//   window.__app_id = 'your-app-id';
//   window.__firebase_config = JSON.stringify({...});
//   window.__tmdb_api_key = 'your-tmdb-key';

if (typeof window.__app_id === 'undefined') {
  console.warn('[blist] No __app_id injected. Using fallback.');
  window.__app_id = 'blist-dev-app';
}

if (typeof window.__firebase_config === 'undefined') {
  console.warn('[blist] No __firebase_config injected. Firebase initialization will stop until config is provided.');
  window.__firebase_config = JSON.stringify({});
}

// AI features should call a server-side proxy. Do not expose AI provider keys
// in browser JavaScript.
// window.__gemini_proxy_url = 'https://your-server.com/api/gemini';
