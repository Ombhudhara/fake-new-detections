/**
 * Live Misinformation Feed Manager
 * Handles fetching, updating, and rendering real misinformation data
 */

const LiveFeedManager = {
  // State
  currentFilter: {
    country: 'Worldwide',
    category: 'all',
    platform: 'all'
  },
  feedData: [],
  autoRefreshEnabled: true,
  autoRefreshInterval: 8000, // 8 seconds
  pollTimer: null,
  lastSyncTime: null,
  failureCount: 0,
  maxFailures: 3,

  /**
   * Initialize feed manager
   */
  init: function() {
    console.log('[LiveFeed] Initializing...');

    this.setupEventListeners();
    this.startSyncTimer();
    this.fetchFeed();
  },

  /**
   * Setup filter event listeners
   */
  setupEventListeners: function() {
    const countrySelect = document.getElementById('feed-country-select');
    const platformSelect = document.getElementById('feed-source-select');
    const categorySelect = document.getElementById('feed-category-select');
    const autoToggle = document.getElementById('feed-auto-toggle');
    const refreshBtn = document.getElementById('feed-refresh-btn');

    if (countrySelect) {
      countrySelect.addEventListener('change', (e) => this.onFilterChange('country', e.target.value));
    }
    if (platformSelect) {
      platformSelect.addEventListener('change', (e) => this.onFilterChange('platform', e.target.value));
    }
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => this.onFilterChange('category', e.target.value));
    }
    if (autoToggle) {
      autoToggle.addEventListener('change', (e) => this.onAutoToggle(e.target.checked));
    }
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.fetchFeed());
    }
  },

  /**
   * Handle filter changes
   */
  onFilterChange: function(filterType, value) {
    this.currentFilter[filterType] = value;
    console.log(`[LiveFeed] Filter changed: ${filterType} = ${value}`);
    this.updateFilterSummary();
    this.fetchFeed();
  },

  /**
   * Handle auto-refresh toggle
   */
  onAutoToggle: function(enabled) {
    this.autoRefreshEnabled = enabled;
    console.log(`[LiveFeed] Auto-refresh ${enabled ? 'ON' : 'OFF'}`);

    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  },

  /**
   * Update filter summary text
   */
  updateFilterSummary: function() {
    const summary = document.getElementById('feed-filter-summary');
    if (!summary) return;

    const countryText = this.currentFilter.country === 'worldwide' ? 'Worldwide' : this.currentFilter.country;
    const platformText = this.currentFilter.platform === 'all' ? 'All Platforms' : this.currentFilter.platform;
    const categoryText = this.currentFilter.category === 'all' ? 'All Categories' : this.currentFilter.category;

    summary.textContent = `Showing: ${countryText} · ${platformText} · ${categoryText}`;
  },

  /**
   * Fetch live misinformation data
   */
  fetchFeed: async function() {
    try {
      const params = new URLSearchParams({
        country: this.currentFilter.country === 'worldwide' ? 'Worldwide' : this.currentFilter.country,
        category: this.currentFilter.category
      });

      const url = `/api/live-misinformation?${params.toString()}`;
      console.log(`[LiveFeed] Fetching from: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      console.log('[LiveFeed] Data received:', data);

      // Validate and filter response
      if (data.feed && Array.isArray(data.feed)) {
        let filtered = data.feed;

        // Filter by platform if needed
        if (this.currentFilter.platform !== 'all') {
          filtered = filtered.filter(item => item.source?.toLowerCase() === this.currentFilter.platform.toLowerCase());
        }

        this.feedData = filtered;
        this.lastSyncTime = new Date();
        this.failureCount = 0;

        this.renderFeed();
        this.showError(false);
      } else {
        throw new Error('Invalid response structure');
      }

    } catch (err) {
      console.error('[LiveFeed] Fetch failed:', err.message);
      this.failureCount++;

      if (this.failureCount >= this.maxFailures) {
        this.showError(true);
      } else {
        console.log(`[LiveFeed] Retry ${this.failureCount}/${this.maxFailures}`);
      }
    }
  },

  /**
   * Render feed grid
   */
  renderFeed: function() {
    const grid = document.getElementById('feed-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!this.feedData || this.feedData.length === 0) {
      grid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No misinformation cases found</div>';
      return;
    }

    // Render first 12 items
    this.feedData.slice(0, 12).forEach(item => {
      const card = this.createFeedCard(item);
      grid.appendChild(card);
    });

    // Show "Load more" if more items exist
    const loadMoreBtn = document.getElementById('feed-load-more');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = this.feedData.length > 12 ? 'block' : 'none';
    }
  },

  /**
   * Create a feed card DOM element
   */
  createFeedCard: function(item) {
    const card = document.createElement('div');
    card.className = 'feed-card';
    card.style.cssText = `
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      background: var(--surface);
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    const verdictColor = item.verdict === 'FALSE' ? '#E24B4A' : item.verdict === 'MISLEADING' ? '#EF9F27' : '#00D084';
    const verdictIcon = item.verdict === 'FALSE' ? '❌' : item.verdict === 'MISLEADING' ? '⚠️' : '✅';

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start; gap: 8px;">
        <h3 style="font-size: 14px; font-weight: 600; margin: 0; flex: 1; color: var(--text);">${item.headline}</h3>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <span style="
          display: inline-block;
          padding: 4px 8px;
          background: ${verdictColor}20;
          color: ${verdictColor};
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
        ">${verdictIcon} ${item.verdict}</span>

        <span style="
          display: inline-block;
          padding: 4px 8px;
          background: #3B82F620;
          color: #3B82F6;
          border-radius: 4px;
          font-size: 12px;
        ">📊 ${item.confidence}%</span>

        <span style="
          display: inline-block;
          padding: 4px 8px;
          background: var(--border);
          color: var(--text-secondary);
          border-radius: 4px;
          font-size: 12px;
        ">${item.category}</span>
      </div>

      <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 12px; color: var(--text-secondary);">
        <span>📍 ${item.country}</span>
        <span>📱 ${item.source}</span>
        <span>🕐 Just now</span>
      </div>
    `;

    return card;
  },

  /**
   * Show/hide error state
   */
  showError: function(show) {
    const errorEl = document.getElementById('feed-error');
    if (errorEl) {
      errorEl.style.display = show ? 'block' : 'none';
    }
  },

  /**
   * Start auto-refresh polling
   */
  startAutoRefresh: function() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    console.log('[LiveFeed] Auto-refresh started');
    this.pollTimer = setInterval(() => {
      this.fetchFeed();
    }, this.autoRefreshInterval);
  },

  /**
   * Stop auto-refresh polling
   */
  stopAutoRefresh: function() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[LiveFeed] Auto-refresh stopped');
  },

  /**
   * Start sync timer display
   */
  startSyncTimer: function() {
    setInterval(() => {
      this.updateSyncDisplay();
    }, 1000);
  },

  /**
   * Update sync time display
   */
  updateSyncDisplay: function() {
    const el = document.getElementById('last-synced-time');
    if (!el || !this.lastSyncTime) return;

    const elapsed = Math.floor((Date.now() - this.lastSyncTime.getTime()) / 1000);
    if (elapsed < 60) {
      el.textContent = `Last synced: ${elapsed}s ago`;
    } else {
      el.textContent = `Last synced: ${Math.floor(elapsed / 60)}m ago`;
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  LiveFeedManager.init();
});
