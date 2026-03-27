/**
 * API Service Layer - All API calls with country parameter
 * Responsible for fetch calls to backend
 * Backend filters data and returns only relevant results
 */

const API = {

  /**
   * Debounce helper to prevent rapid API calls
   */
  debounce: function(fn, delay) {
    let timer;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * Simple cache per country to reduce API calls
   */
  cache: {},

  /**
   * Get cached data if exists and fresh (< 30 sec old)
   */
  getFromCache: function(key) {
    const cached = this.cache[key];
    if (!cached) return null;
    const age = Date.now() - cached.timestamp;
    if (age > 30000) return null; // cache expires after 30s
    return cached.data;
  },

  /**
   * Store data in cache
   */
  setCache: function(key, data) {
    this.cache[key] = { data: data, timestamp: Date.now() };
  },

  /**
   * Dashboard main data endpoint
   * Returns all dashboard metrics filtered by country
   */
  fetchDashboard: async function(country = 'Worldwide') {
    const cacheKey = `dashboard_${country}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `/api/dashboard?country=${encodeURIComponent(country)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Error fetching dashboard:', err);
      throw err;
    }
  },

  /**
   * Live stats (top metric cards)
   */
  fetchLiveStats: async function(country = 'Worldwide') {
    const cacheKey = `live-stats_${country}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `/api/live-stats?country=${encodeURIComponent(country)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Error fetching live stats:', err);
      throw err;
    }
  },

  /**
   * Analytics data (charts, heatmap, etc.)
   */
  fetchAnalytics: async function(country = 'Worldwide') {
    const cacheKey = `analytics_${country}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `/api/get_live_analytics?region=${encodeURIComponent(country)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Error fetching analytics:', err);
      throw err;
    }
  },

  /**
   * Live misinformation feed
   */
  fetchLiveFeed: async function(country = 'Worldwide', category = 'all', platform = 'all') {
    const cacheKey = `live-feed_${country}_${category}_${platform}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `/api/live-feed`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: country,
          category: category,
          platform: platform,
          timeRange: '7days'
        })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Error fetching live feed:', err);
      throw err;
    }
  },

  /**
   * Trending data filtered by country
   */
  fetchTrending: async function(country = 'Worldwide', category = '') {
    const cacheKey = `trending_${country}_${category}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const url = `/api/trending?location=${encodeURIComponent(country)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      this.setCache(cacheKey, data);
      return data;
    } catch (err) {
      console.error('Error fetching trending:', err);
      throw err;
    }
  },

  /**
   * Clear cache for a country (when refresh triggered)
   */
  clearCache: function(country = null) {
    if (country === null) {
      this.cache = {};
    } else {
      Object.keys(this.cache).forEach(key => {
        if (key.includes(country)) {
          delete this.cache[key];
        }
      });
    }
  }
};
