/**
 * Dashboard State Management - Advanced Polling & Validation System
 * Implements: Initial Load, Polling Loop, Validation Gate, Safe Updates, Retry Logic
 * State Machine: LOADING → LIVE → PAUSED → ERROR → RECOVERING
 */

const DashboardState = {

  // ── STATE MACHINE ──
  state: 'LOADING', // LOADING | LIVE | PAUSED | ERROR | RECOVERING
  selectedCountry: 'Worldwide',
  autoRefreshEnabled: false,

  // ── CURRENT DATA STATE (source of truth)
  currentState: {
    fakeDetectedToday: 0,
    avgConfidence: 0,
    countriesAffected: 0,
    totalFactChecked: 0,
    recentAlerts: [] // max 50 items, append-only, no duplicates
  },

  // ── COUNTRY-SPECIFIC MAXIMUMS (prevent decreases across sessions)
  countryMaxValues: {}, // { "Worldwide": { fakeDetectedToday: 72, ... }, ... }

  // ── POLLING & TIMING ──
  pollingInterval: 8000, // 8 seconds as per spec
  pollingTimer: null,
  lastSuccessTimestamp: null,

  // ── ERROR TRACKING ──
  failureCount: 0,
  maxConsecutiveFailures: 3,
  exponentialBackoffWait: 8000, // starts at 8s, doubles up to 60s max

  // ── UI STATE ──
  syncTimerInterval: null,

  /**
   * 1. INITIAL LOAD LOGIC
   * ON dashboard mount: Call API once → Store response → Render metrics → Start polling IF enabled
   */
  init: function() {
    console.log('[DashboardState] Initializing...');

    // setupCountryDropdown disabled - country selector removed from UI
    this.setupAutoRefreshToggle();
    this.startSyncTimerDisplay();

    // Initial fetch with retry logic
    this.initialLoad();
  },

  /**
   * INITIAL LOAD WITH RETRY (max 3 retries, 5s between attempts)
   */
  initialLoad: async function() {
    this.setState('LOADING');
    const maxRetries = 3;
    let retryCount = 0;

    const attemptFetch = async () => {
      try {
        console.log(`[DashboardState] Initial fetch (attempt ${retryCount + 1}/${maxRetries})`);

        const response = await this.fetchSnapshot();

        if (!response) {
          throw new Error('Empty snapshot response');
        }

        // Validate the response
        if (!this.validate(response)) {
          throw new Error('Snapshot validation failed');
        }

        // Commit to currentState
        this.safeUpdate(response);

        // Mark success
        this.failureCount = 0;
        this.lastSuccessTimestamp = new Date();
        this.setState('LIVE');

        console.log('[DashboardState] Initial load successful');

        // Start polling if toggle is ON
        if (this.autoRefreshEnabled) {
          this.startPolling();
        }

        return true;
      } catch (err) {
        console.error(`[DashboardState] Initial fetch failed:`, err.message);
        retryCount++;

        if (retryCount < maxRetries) {
          console.log(`[DashboardState] Retrying in 5s... (${retryCount}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          return attemptFetch();
        } else {
          // All retries exhausted
          this.showError('⚠️ Unable to load data. Please try again later.');
          this.setState('ERROR');
          return false;
        }
      }
    };

    return attemptFetch();
  },

  /**
   * FETCH SNAPSHOT - Single API call for initial data
   */
  fetchSnapshot: async function() {
    try {
      const url = `/api/live-stats?country=${encodeURIComponent(this.selectedCountry)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[DashboardState] fetchSnapshot failed:', err.message);
      throw err;
    }
  },

  /**
   * FETCH LATEST METRICS - Periodic polling endpoint
   */
  fetchLatestMetrics: async function() {
    try {
      const url = `/api/live-stats?country=${encodeURIComponent(this.selectedCountry)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[DashboardState] fetchLatestMetrics failed:', err.message);
      throw err;
    }
  },

  /**
   * 3. VALIDATION GATE (runs BEFORE safeUpdate)
   * Checks: null/undefined, required fields, timestamp staleness, NaN/negative values
   */
  validate: function(newData) {
    if (!newData) {
      console.warn('[DashboardState] Validation failed: null/undefined data');
      return false;
    }

    // Check required fields
    const requiredFields = ['fake_detected_today', 'avg_confidence', 'countries_affected', 'total_checked'];
    for (const field of requiredFields) {
      if (newData[field] === undefined || newData[field] === null) {
        console.warn(`[DashboardState] Validation failed: missing required field "${field}"`);
        return false;
      }
    }

    // Check timestamp staleness
    if (newData.timestamp) {
      const newTimestamp = new Date(newData.timestamp).getTime();
      const lastAccepted = this.lastSuccessTimestamp?.getTime() || 0;

      if (newTimestamp <= lastAccepted) {
        console.warn('[DashboardState] Validation failed: stale data (timestamp not newer)');
        return false;
      }
    }

    // Check for NaN/negative values (skip field but continue)
    for (const field of requiredFields) {
      const val = newData[field];
      if (isNaN(val) || (typeof val === 'number' && val < 0)) {
        console.warn(`[DashboardState] Skipping invalid field "${field}": ${val}`);
        newData[field] = this.currentState[this.mapFieldName(field)] || 0;
      }
    }

    return true;
  },

  /**
   * Map API field names to internal state field names
   */
  mapFieldName: function(apiField) {
    const map = {
      'fake_detected_today': 'fakeDetectedToday',
      'avg_confidence': 'avgConfidence',
      'countries_affected': 'countriesAffected',
      'total_checked': 'totalFactChecked'
    };
    return map[apiField] || apiField;
  },

  /**
   * 4. SAFE UPDATE - Core state mutation with monotonic field enforcement
   * Uses country-specific maximums to prevent ANY decreases
   */
  safeUpdate: function(newData) {
    if (!newData) return;

    console.log('[DashboardState] safeUpdate start', newData);

    // Initialize country max storage if needed
    if (!this.countryMaxValues[this.selectedCountry]) {
      this.countryMaxValues[this.selectedCountry] = {
        fakeDetectedToday: 0,
        avgConfidence: 0,
        countriesAffected: 0,
        totalFactChecked: 0
      };
    }
    const countryMax = this.countryMaxValues[this.selectedCountry];

    // MONOTONIC FIELDS (never decrease - enforce with global maximums)
    const monotonicFields = {
      'fake_detected_today': 'fakeDetectedToday',
      'total_checked': 'totalFactChecked'
    };

    for (const [apiField, stateField] of Object.entries(monotonicFields)) {
      const newVal = newData[apiField];
      const globalMax = Math.max(this.currentState[stateField], countryMax[stateField] || 0);

      if (typeof newVal === 'number' && newVal >= globalMax) {
        console.log(`[DashboardState] UPDATE monotonic "${stateField}": ${globalMax} → ${newVal}`);
        this.currentState[stateField] = newVal;
        countryMax[stateField] = newVal; // Store maximum
      } else if (typeof newVal === 'number') {
        // Reject decrease, keep the global maximum
        console.warn(`[DashboardState] REJECT monotonic "${stateField}": ${newVal} < ${globalMax} (keeping ${globalMax})`);
        this.currentState[stateField] = globalMax;
      }
    }

    // FLEXIBLE FIELDS (can go up or down)
    const flexibleFields = {
      'avg_confidence': 'avgConfidence',
      'countries_affected': 'countriesAffected'
    };

    for (const [apiField, stateField] of Object.entries(flexibleFields)) {
      const newVal = newData[apiField];

      if (typeof newVal === 'number' && !isNaN(newVal)) {
        console.log(`[DashboardState] UPDATE flexible "${stateField}": ${this.currentState[stateField]} → ${newVal}`);
        this.currentState[stateField] = newVal;
      } else {
        console.warn(`[DashboardState] SKIP invalid flexible field "${stateField}": ${newVal}`);
      }
    }

    // Record success timestamp
    this.lastSuccessTimestamp = new Date();
    this.failureCount = 0;

    // Render UI from currentState
    this.renderUI();

    console.log('[DashboardState] safeUpdate complete', this.currentState);
  },

  /**
   * RENDER UI - Update all metrics from currentState
   */
  renderUI: function() {
    this.animateStatUpdate('s1', this.currentState.fakeDetectedToday, '');
    this.animateStatUpdate('s2', this.currentState.avgConfidence, '%');
    this.animateStatUpdate('s3', this.currentState.countriesAffected, '');
    this.animateStatUpdate('s4', this.currentState.totalFactChecked, '');
    this.updateSyncTimerDisplay();
  },

  /**
   * 2. POLLING LOOP - Every 8 seconds IF toggle = ON
   * Call fetchLatestMetrics → validate → safeUpdate OR keep currentState unchanged
   */
  startPolling: function() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    console.log('[DashboardState] Polling started (8s interval)');
    this.setState('LIVE');

    this.pollingTimer = setInterval(() => {
      this.pollOnce();
    }, this.pollingInterval);
  },

  /**
   * Single poll cycle
   */
  pollOnce: async function() {
    try {
      const newData = await this.fetchLatestMetrics();

      if (!this.validate(newData)) {
        throw new Error('Validation failed');
      }

      this.safeUpdate(newData);

      // Reset error state on success
      if (this.state === 'RECOVERING' || this.state === 'ERROR') {
        this.setState('LIVE');
      }

    } catch (err) {
      console.error('[DashboardState] Poll failed:', err.message);
      this.failureCount++;

      if (this.failureCount >= this.maxConsecutiveFailures) {
        console.warn('[DashboardState] Hit max consecutive failures, entering ERROR state');
        this.setState('ERROR');
        this.startExponentialBackoff();
      } else {
        this.showWarning(`⚠️ Last synced: ${this.formatLastSyncTime()}`);
      }
    }
  },

  /**
   * 6. EXPONENTIAL BACKOFF - After 3 consecutive failures
   */
  startExponentialBackoff: function() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);

    let backoffWait = 8000; // start at 8s
    let attemptNum = 0;

    const attemptWithBackoff = async () => {
      attemptNum++;
      this.setState('RECOVERING');

      console.log(`[DashboardState] Backoff attempt ${attemptNum}, waiting ${backoffWait}ms`);
      this.showWarning(`Connection lost. Retrying in ${Math.floor(backoffWait / 1000)}s...`);

      setTimeout(async () => {
        try {
          const newData = await this.fetchLatestMetrics();

          if (this.validate(newData)) {
            this.safeUpdate(newData);
            this.setState('LIVE');
            this.failureCount = 0;
            console.log('[DashboardState] Backoff recovery successful, resuming normal polling');

            // Resume normal polling
            this.startPolling();
          } else {
            throw new Error('Validation failed during backoff recovery');
          }
        } catch (err) {
          console.error('[DashboardState] Backoff recovery failed:', err.message);

          // Increase wait, cap at 60s
          backoffWait = Math.min(backoffWait * 2, 60000);
          attemptWithBackoff();
        }
      }, backoffWait);
    };

    attemptWithBackoff();
  },

  stopPolling: function() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    console.log('[DashboardState] Polling stopped');
  },

  /**
   * 5. TOGGLE CONTROL
   * ON: Resume polling (with immediate fetch) | OFF: Freeze UI, keep "Last synced" visible
   */
  setupAutoRefreshToggle: function() {
    const toggle = document.getElementById('auto-refresh-toggle');
    if (!toggle) {
      console.warn('Auto-refresh toggle not found');
      return;
    }

    toggle.addEventListener('change', (e) => {
      this.handleAutoRefreshToggle(e.target.checked);
    });
  },

  handleAutoRefreshToggle: function(enabled) {
    this.autoRefreshEnabled = enabled;
    console.log(`[DashboardState] Toggle: auto-refresh ${enabled ? 'ON' : 'OFF'}`);

    if (enabled) {
      // Immediate fetch, then start polling
      this.pollOnce().then(() => this.startPolling());
    } else {
      this.stopPolling();
      this.setState('PAUSED');
    }
  },

  /**
   * COUNTRY CHANGE
   */
  setupCountryDropdown: function() {
    const dropdown = document.getElementById('country-select');
    if (!dropdown) {
      console.warn('Country dropdown not found');
      return;
    }

    dropdown.addEventListener('change', (e) => {
      this.handleCountryChange(e.target.value);
    });
  },

  handleCountryChange: function(country) {
    if (this.selectedCountry === country) return;

    this.selectedCountry = country;
    console.log(`[DashboardState] Country changed to: ${country}`);

    API.clearCache(country);

    // Stop current polling
    this.stopPolling();

    // Restore from previous session or start fresh
    if (this.countryMaxValues[country]) {
      // Restore from previous country session (values never reset)
      this.currentState = { ...this.countryMaxValues[country], recentAlerts: [] };
      console.log(`[DashboardState] Restored previous values for ${country}`);
    } else {
      // First time viewing this country
      this.currentState = {
        fakeDetectedToday: 0,
        avgConfidence: 0,
        countriesAffected: 0,
        totalFactChecked: 0,
        recentAlerts: []
      };
    }

    this.failureCount = 0;
    this.lastSuccessTimestamp = null;

    // Re-fetch fresh data
    this.initialLoad();
  },

  /**
   * STATE MACHINE
   */
  setState: function(newState) {
    if (this.state !== newState) {
      console.log(`[DashboardState] State: ${this.state} → ${newState}`);
      this.state = newState;

      // Update visual indicator if exists
      const badge = document.querySelector('.live-badge');
      if (badge) {
        if (newState === 'LIVE') {
          badge.textContent = '●LIVE DATA';
          badge.style.color = '#00D084';
        } else if (newState === 'PAUSED') {
          badge.textContent = '⏸ PAUSED';
          badge.style.color = '#999';
        } else if (newState === 'ERROR' || newState === 'RECOVERING') {
          badge.textContent = '⚠️ DISCONNECTED';
          badge.style.color = '#E24B4A';
        }
      }
    }
  },

  /**
   * UI HELPERS
   */
  animateStatUpdate: function(id, value, suffix) {
    const el = document.getElementById(id);
    if (!el) return;

    const oldValue = parseInt(el.textContent) || 0;
    const isIncrease = value > oldValue;

    el.classList.remove('stat-up', 'stat-down');
    void el.offsetWidth; // trigger reflow
    el.classList.add(isIncrease ? 'stat-up' : 'stat-down');

    animateCounter(id, value, suffix, 500);

    setTimeout(() => {
      el.classList.remove('stat-up', 'stat-down');
    }, 800);
  },

  startSyncTimerDisplay: function() {
    this.syncTimerInterval = setInterval(() => {
      this.updateSyncTimerDisplay();
    }, 1000);
  },

  updateSyncTimerDisplay: function() {
    const timerEl = document.getElementById('last-sync-timer');
    if (!timerEl) return;

    timerEl.textContent = this.formatLastSyncTime();
  },

  formatLastSyncTime: function() {
    if (!this.lastSuccessTimestamp) return 'Never synced';

    const elapsed = Math.floor((Date.now() - this.lastSuccessTimestamp.getTime()) / 1000);

    if (elapsed < 60) {
      return `Last synced ${elapsed}s ago`;
    } else if (elapsed < 3600) {
      return `Last synced ${Math.floor(elapsed / 60)}m ago`;
    } else {
      return `Last synced ${Math.floor(elapsed / 3600)}h ago`;
    }
  },

  showWarning: function(message) {
    const timerEl = document.getElementById('last-sync-timer');
    if (timerEl) {
      timerEl.textContent = message;
      timerEl.style.color = '#E24B4A';
    }
  },

  showError: function(message) {
    console.error('[DashboardState] ERROR:', message);
    const timerEl = document.getElementById('last-sync-timer');
    if (timerEl) {
      timerEl.textContent = message;
      timerEl.style.color = '#E24B4A';
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  DashboardState.init();
});
