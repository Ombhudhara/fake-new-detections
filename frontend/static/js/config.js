// ══════════════════════════════════════════════════════════
//  API CONFIGURATION
//  Supports configurable API URLs via window, meta tags, localStorage,
//  and auto-detects local development vs production environments.
// ══════════════════════════════════════════════════════════

(function() {
  const metaApi = document.querySelector('meta[name="api-base-url"]')?.getAttribute('content');
  const metaChatbot = document.querySelector('meta[name="chatbot-api-url"]')?.getAttribute('content');

  const storedApi = (function() {
    try {
      return localStorage.getItem('VITE_API_BASE_URL') || localStorage.getItem('API_BASE_URL');
    } catch (_) {
      return null;
    }
  })();

  const storedChatbot = (function() {
    try {
      return localStorage.getItem('VITE_CHATBOT_API_URL') || localStorage.getItem('CHATBOT_API_URL');
    } catch (_) {
      return null;
    }
  })();

  const hostname = window.location.hostname;
  const isLocalhost = Boolean(
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );

  const defaultApi = isLocalhost
    ? 'http://127.0.0.1:5000'
    : 'https://fake-news-detection-api.onrender.com';

  const defaultChatbot = isLocalhost
    ? 'http://127.0.0.1:8000'
    : 'https://fake-news-detection-api.onrender.com';

  const API_BASE_URL = (
    window.API_BASE_URL ||
    window.__API_BASE_URL__ ||
    metaApi ||
    storedApi ||
    defaultApi
  ).replace(/\/+$/, '');

  const CHATBOT_API_URL = (
    window.CHATBOT_API_URL ||
    window.__CHATBOT_API_URL__ ||
    metaChatbot ||
    storedChatbot ||
    defaultChatbot
  ).replace(/\/+$/, '');

  window.API_BASE_URL = API_BASE_URL;
  window.CHATBOT_API_URL = CHATBOT_API_URL;

  // Lightweight status probe
  window.checkBackendHealth = async function(timeoutMs = 3000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${window.API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(timeout);
      return res.ok;
    } catch (_) {
      clearTimeout(timeout);
      return false;
    }
  };
})();
