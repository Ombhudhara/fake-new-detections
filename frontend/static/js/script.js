// script.js - Integrated Live News Engine with State-wise Filtering
const LiveNewsEngine = {
    // Current filter state
    currentState: 'All',
    allNews: [],
    visibleCount: 0,

    init: function() {
        console.log("LiveNewsEngine: News Engine Initialized");
        this.fetchNews();
        
        // Ensure state selector visibility on load if India is selected
        const stateSelect = document.getElementById("ts-state");
        const countrySelect = document.getElementById("ts-country");
        if (countrySelect && countrySelect.value === "India") {
            stateSelect.style.display = "block";
        }
    },

    onLocationChange: function() {
        const countrySelect = document.getElementById("ts-country");
        const stateSelect = document.getElementById("ts-state");

        this.currentCountry = countrySelect.value;
        this.currentState = stateSelect.value;

        // Visual Logic: Only show state dropdown for India
        if (this.currentCountry === "India") {
            stateSelect.style.display = "block";
        } else {
            stateSelect.style.display = "none";
            this.currentState = "All"; // Reset state when switching countries
        }

        console.log(`LiveNewsEngine: Location Changed to ${this.currentCountry} / ${this.currentState}`);
        this.fetchNews();
    },

    fetchNews: function(query = "") {
        const newsContainer = document.getElementById("news-container");
        const loadMoreContainer = document.getElementById("news-load-more-container");
        if (!newsContainer) return;

        // Loading State
        newsContainer.innerHTML = `
            <div class="news-loading" style="grid-column: 1/-1; text-align:center; padding: 40px;">
                <div class="spinner"></div>
                <p style="margin-top:15px; color:#64748b;">📡 Fetching live updates from ${this.currentState !== 'All' ? this.currentState : this.currentCountry} sources...</p>
            </div>
        `;
        if (loadMoreContainer) loadMoreContainer.style.display = "none";

        let url = `/get_news?country=${encodeURIComponent(this.currentCountry)}&state=${encodeURIComponent(this.currentState)}`;
        if (query) url += `&q=${encodeURIComponent(query)}`;
        
        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.status === "error") {
                    newsContainer.innerHTML = `<div class="news-error" style="grid-column: 1/-1;">⚠️ Could not load news: ${data.error}</div>`;
                    return;
                }
                this.allNews = data.news || [];
                this.visibleCount = 0; // Reset count
                
                if (this.allNews.length === 0) {
                    newsContainer.innerHTML = `<div class="news-error" style="grid-column: 1/-1;">📭 No live news found for ${this.currentState !== 'All' ? this.currentState : this.currentCountry} at the moment.</div>`;
                    return;
                }

                // Update last updated text
                const timeText = document.getElementById("ts-last-updated");
                if (timeText) timeText.innerText = "Updated 10 sec ago";

                this.renderBatch(0, 6);
            })
            .catch(err => {
                console.error("News Fetch Error:", err);
                newsContainer.innerHTML = `<div class="news-error" style="grid-column: 1/-1;">⚠️ Connection error. Please check your internet.</div>`;
            });
    },

    renderBatch: function(start, end) {
        const newsContainer = document.getElementById("news-container");
        const loadMoreContainer = document.getElementById("news-load-more-container");
        if (!newsContainer) return;

        if (start === 0) newsContainer.innerHTML = '';
        
        const batch = this.allNews.slice(start, end);
        batch.forEach(item => {
            const card = this.createNewsCard(item);
            newsContainer.appendChild(card);
        });

        this.visibleCount = end;

        // Show/hide load more container
        if (loadMoreContainer) {
            loadMoreContainer.style.display = (this.visibleCount < this.allNews.length) ? "block" : "none";
        }
    },

    loadMore: function() {
        const container = document.getElementById('news-load-more-container');
        const btn = container ? container.querySelector('.ts-load-more-btn') : null;
        
        if (btn) btn.classList.add('is-loading');

        setTimeout(() => {
            const start = this.visibleCount;
            const end = start + 6;
            this.renderBatch(start, end);

            if (btn) btn.classList.remove('is-loading');
        }, 500);
    },

    createNewsCard: function(item) {
        const card = document.createElement('div');
        const isFake = (item.verdict === "FAKE" || item.type === "fact-check");
        card.className = `news-card ${isFake ? 'news-card-fake' : 'news-card-real'}`;

        const safeTitle = this.escapeHTML(item.title);
        const safeSource = this.escapeHTML(item.source);
        const safeSnippet = this.escapeHTML(item.description);
        const safeUrl = (item.url && item.url !== '#') ? item.url : '#';
        
        // Escape title for JS string in onclick
        const titleForJS = (item.title || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');

        // Format relative time if possible
        const timestamp = item.timestamp || "Just now";

        card.innerHTML = `
            <div class="news-card-header">
                <div class="news-source">🌐 ${safeSource}</div>
                <div class="news-badge ${isFake ? 'badge-fake' : 'badge-live'}">${isFake ? 'FAKE' : 'VERIFIED'}</div>
            </div>
            <h3 class="news-title">${safeTitle}</h3>
            <p class="news-snippet">${safeSnippet}</p>
            <div class="news-card-footer">
                <span class="news-time">🕒 ${timestamp}</span>
                <span class="news-location">📍 ${item.state || 'National'}</span>
                <a href="${safeUrl}" target="_blank" class="news-link">READ MORE &rarr;</a>
                <button class="verify-btn-news" onclick="MisinfoTracker.verifyNow('${titleForJS}')">CHECK THIS</button>
            </div>
        `;
        return card;
    },

    searchSubmit: function() {
        const query = document.getElementById("ts-search").value.trim();
        if (!query) return;

        console.log(`LiveNewsEngine: Searching for ${query}`);
        const tag = document.getElementById("ts-search-tag");
        const tagText = document.getElementById("ts-search-tag-text");
        
        if (tag && tagText) {
            tag.style.display = "flex";
            tagText.innerText = `Search: "${query}"`;
        }
        
        this.fetchNews(query);
    },

    clearSearch: function() {
        const searchInput = document.getElementById("ts-search");
        if (searchInput) searchInput.value = "";
        
        const tag = document.getElementById("ts-search-tag");
        if (tag) tag.style.display = "none";
        
        this.fetchNews();
    },

    escapeHTML: function(str) {
        if (!str) return '';
        return str.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    refresh: function() {
        this.fetchNews();
    }
};

// Start the engine
document.addEventListener("DOMContentLoaded", () => LiveNewsEngine.init());
