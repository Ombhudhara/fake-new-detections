/**
 * Analytics Page State Management
 * Handles country filtering and auto-refresh for analytics page
 * Uses API.js for all backend calls
 */

const AnalyticsState = {

  // Global state
  selectedCountry: 'Worldwide',
  selectedCategory: 'overall',
  selectedPlatform: 'all',
  autoRefreshEnabled: true,
  autoRefreshInterval: 30000, // 30 seconds for analytics (heavier)
  autoRefreshTimer: null,
  lastSyncTime: null,
  isLoading: false,

  /**
   * Initialize analytics state
   */
  init: function() {
    this.setupCountryDropdown();
    this.setupAutoRefreshToggle();
    this.setupCategoryPills();
    this.startSyncTimer();
    
    // Load initial data
    this.refreshAnalytics();
  },

  /**
   * Setup country dropdown handler
   */
  setupCountryDropdown: function() {
    const dropdown = document.getElementById('feed-country-select');
    if (!dropdown) {
      console.warn('[AnalyticsState] Country dropdown not found');
      return;
    }

    // Get initial value
    const initial = dropdown.value || 'Worldwide';
    if (initial.toLowerCase() === 'worldwide') {
      this.selectedCountry = 'Worldwide';
    } else {
      this.selectedCountry = initial;
    }

    dropdown.addEventListener('change', (e) => {
      const country = e.target.value;
      if (country.toLowerCase() === 'worldwide') {
        this.handleCountryChange('Worldwide');
      } else {
        this.handleCountryChange(country);
      }
    });
  },

  /**
   * Handle country change - refresh all analytics with new country
   */
  handleCountryChange: function(country) {
    if (this.selectedCountry === country) return;

    this.selectedCountry = country;
    console.log(`[AnalyticsState] Country changed to: ${country}`);

    // Clear cache for this country
    API.clearCache(country);

    // Refresh all analytics
    this.refreshAnalytics();
  },

  /**
   * Setup category pill buttons
   */
  setupCategoryPills: function() {
    const pills = document.querySelectorAll('.filter-pills .pill');
    pills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        const category = e.target.getAttribute('data-filter');
        this.handleCategoryChange(category);
      });
    });
  },

  /**
   * Handle category filter change
   */
  handleCategoryChange: function(category) {
    if (this.selectedCategory === category) return;

    this.selectedCategory = category;
    console.log(`[AnalyticsState] Category changed to: ${category}`);

    // Update pill active states
    document.querySelectorAll('.filter-pills .pill').forEach(pill => {
      pill.classList.remove('active');
      if (pill.getAttribute('data-filter') === category) {
        pill.classList.add('active');
      }
    });

    // Refresh analytics
    this.refreshAnalytics();
  },

  /**
   * Setup auto-refresh toggle
   */
  setupAutoRefreshToggle: function() {
    const toggle = document.getElementById('feed-auto-toggle');
    if (!toggle) {
      console.warn('[AnalyticsState] Auto-refresh toggle not found');
      return;
    }

    toggle.addEventListener('change', (e) => {
      this.handleAutoRefreshToggle(e.target.checked);
    });

    // Start auto-refresh if toggle is checked (default true)
    if (toggle.checked) {
      this.startAutoRefresh();
    }
  },

  /**
   * Handle auto-refresh toggle
   */
  handleAutoRefreshToggle: function(enabled) {
    this.autoRefreshEnabled = enabled;
    console.log(`[AnalyticsState] Auto-refresh ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  },

  /**
   * Start auto-refresh timer
   */
  startAutoRefresh: function() {
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);

    // Refresh immediately
    this.refreshAnalytics();

    // Then refresh every interval
    this.autoRefreshTimer = setInterval(() => {
      this.refreshAnalytics();
    }, this.autoRefreshInterval);

    console.log(`[AnalyticsState] Auto-refresh started (every ${this.autoRefreshInterval}ms)`);
    this.updateCountdownTimer();
  },

  /**
   * Stop auto-refresh timer
   */
  stopAutoRefresh: function() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
    console.log('[AnalyticsState] Auto-refresh stopped');
  },

  /**
   * Main refresh function - fetches all analytics data
   */
  refreshAnalytics: async function() {
    if (this.isLoading) {
      console.log('[AnalyticsState] Already loading, skipping');
      return;
    }

    this.isLoading = true;
    console.log(`[AnalyticsState] Refreshing analytics for: ${this.selectedCountry}`);

    try {
      // Fetch live stats and analytics in parallel
      const [liveStats, analytics] = await Promise.all([
        API.fetchLiveStats(this.selectedCountry),
        API.fetchAnalytics(this.selectedCountry)
      ]);

      // Update all components
      this.updateFeedSummary();
      this.updateAnalyticsCharts(analytics);

      // Record sync time
      this.lastSyncTime = new Date();
      this.updateSyncTimestamps();

      console.log('[AnalyticsState] Analytics refreshed successfully');
    } catch (err) {
      console.error('[AnalyticsState] Error refreshing analytics:', err);
      this.showError('Failed to load analytics. Please try again.');
    } finally {
      this.isLoading = false;
    }
  },

  /**
   * Update the filter summary line
   */
  updateFeedSummary: function() {
    const summary = document.getElementById('feed-filter-summary');
    if (!summary) return;

    const platformText = this.getPlatformDisplayName(
      document.getElementById('feed-source-select')?.value || 'all'
    );
    const categoryText = this.getCategoryDisplayName(
      document.getElementById('feed-category-select')?.value || 'all'
    );

    summary.textContent = `Showing: ${this.selectedCountry} · ${platformText} · ${categoryText}`;
  },

  /**
   * Update analytics charts (velocity, bubble, heatmap, etc.)
   */
  updateAnalyticsCharts: function(data) {
    if (!data) return;

    // Update timeline/heatmap data
    if (data.heatmap_data) {
      this.updateActivityHeatmap(data.heatmap_data);
    }

    // Update timeline labels
    if (data.timeline_labels) {
      this.updateTimelineLabels(data.timeline_labels);
      this.updateTimelineValues(data.timeline_values);
    }

    // Update platform data if available
    if (data.platform_data) {
      this.updateVelocityChart(data.platform_data);
    }

    console.log('[AnalyticsState] Charts updated');
  },

  /**
   * Update activity heatmap (hour vs day)
   */
  updateActivityHeatmap: function(heatmapData) {
    const grid = document.getElementById('heatmap-act-grid');
    if (!grid || !heatmapData) return;

    grid.innerHTML = '';

    heatmapData.forEach((row, hourIdx) => {
      const hourLabel = document.createElement('div');
      hourLabel.className = 'hm-row-label';
      hourLabel.textContent = `${String(hourIdx).padStart(2, '0')}:00`;
      grid.appendChild(hourLabel);

      row.forEach(intensity => {
        const cell = document.createElement('div');
        cell.className = 'hm-cell';

        // Color intensity based on value
        const pct = Math.min(100, Math.max(0, intensity));
        const colors = [
          '#fef9f9', '#fcd9d8', '#f8a8a6', '#f26b68', '#E8453C'
        ];
        const colorIdx = Math.floor((pct / 100) * (colors.length - 1));
        cell.style.background = colors[colorIdx];
        cell.title = `${intensity} articles`;
        grid.appendChild(cell);
      });
    });
  },

  /**
   * Update timeline labels
   */
  updateTimelineLabels: function(labels) {
    // This would update D3 or Chart.js x-axis labels if needed
    console.log('[AnalyticsState] Timeline labels:', labels);
  },

  /**
   * Update timeline values
   */
  updateTimelineValues: function(values) {
    // This would update chart data if needed
    console.log('[AnalyticsState] Timeline values:', values);
  },

  /**
   * Update velocity chart (WhatsApp vs Social vs News)
   */
  updateVelocityChart: function(platformData) {
    // This would update the Chart.js velocity chart
    console.log('[AnalyticsState] Platform data:', platformData);
  },

  /**
   * Update sync timestamps
   */
  updateSyncTimestamps: function() {
    const lastSyncEl = document.getElementById('last-synced-time');
    if (lastSyncEl && this.lastSyncTime) {
      const elapsed = Math.floor((Date.now() - this.lastSyncTime.getTime()) / 1000);
      if (elapsed < 60) {
        lastSyncEl.textContent = `Last synced: ${elapsed}s ago`;
      } else {
        const minutes = Math.floor(elapsed / 60);
        lastSyncEl.textContent = `Last synced: ${minutes}m ago`;
      }
    }
  },

  /**
   * Update countdown timer display
   */
  updateCountdownTimer: function() {
    setInterval(() => {
      const countdownEl = document.getElementById('feed-countdown');
      if (!countdownEl || !this.autoRefreshEnabled) return;

      const timeLeft = Math.max(0, this.autoRefreshInterval - ((Date.now() - (this.lastSyncTime?.getTime() || Date.now())) % this.autoRefreshInterval));
      const seconds = Math.ceil(timeLeft / 1000);
      countdownEl.textContent = `Refreshes in ${seconds}s`;
    }, 1000);
  },

  /**
   * Start sync timer (updates "last synced X seconds ago")
   */
  startSyncTimer: function() {
    setInterval(() => {
      this.updateSyncTimestamps();
    }, 1000);
  },

  /**
   * Get display name for platform
   */
  getPlatformDisplayName: function(platform) {
    const names = {
      'all': 'All Platforms',
      'WhatsApp': '💬 WhatsApp',
      'Facebook': '📘 Facebook',
      'Twitter': '🐦 Twitter/X',
      'Telegram': '✈️ Telegram',
      'Instagram': '📸 Instagram',
      'YouTube': '▶️ YouTube'
    };
    return names[platform] || 'All Platforms';
  },

  /**
   * Get display name for category
   */
  getCategoryDisplayName: function(category) {
    const names = {
      'all': 'All Categories',
      'Health': '🏥 Health',
      'Politics': '🏛 Politics',
      'Finance': '💰 Finance',
      'Technology': '💻 Technology',
      'International': '🌐 International',
      'Local': '📍 Local'
    };
    return names[category] || 'All Categories';
  },

  /**
   * Show error notification
   */
  showError: function(message) {
    const errorEl = document.getElementById('feed-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';

      setTimeout(() => {
        errorEl.style.display = 'none';
      }, 5000);
    } else {
      console.error('[AnalyticsState]', message);
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  AnalyticsState.init();
});
