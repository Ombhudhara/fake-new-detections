// script.js - Specific script for live news fetching dynamically
document.addEventListener("DOMContentLoaded", function() {
    const newsContainer = document.getElementById("news-container");

    if (!newsContainer) return;

    fetch('/get_news')
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            newsContainer.innerHTML = ''; // clear loading state
            
            if (data.status === "error" || (data.error && (!data.news || data.news.length === 0))) {
                newsContainer.innerHTML = `<div class="news-error" style="grid-column: 1/-1;">⚠️ Could not load news: ${data.error || 'Unknown Error'}</div>`;
                return;
            }

            let newsItems = data.news || [];
            
            if (newsItems.length === 0 || data.status === "no_data") {
                newsContainer.innerHTML = `<div class="news-error" style="grid-column: 1/-1;">📭 No live news found from Indian networks at the moment.</div>`;
                return;
            }

            // Show fallback message if required
            if (data.type === "fallback") {
                showFallbackMessage();
            }

            // Sort news items by newest timestamp first
            newsItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Loop through the news items and dynamically create elements
            newsItems.forEach(item => {
                const card = createNewsCard(item, data.type);
                newsContainer.appendChild(card);
            });
        })
        .catch(error => {
            console.error("Error fetching live news:", error);
            newsContainer.innerHTML = `
                <div class="news-error">⚠️ Error fetching live news. Please try again later.</div>
            `;
        });
});

function showFallbackMessage() {
    const msg = document.createElement("div");
    msg.innerText = "Showing recent data (last 30 days) due to no latest updates.";
    msg.className = "fallback-message";
    // We want the message to span across the whole grid
    msg.style.gridColumn = "1 / -1";
    document.getElementById("news-container").appendChild(msg);
}

function createNewsCard(item, feedType) {
    const card = document.createElement('div');
    card.className = 'news-card';

    const safeTitle = escapeHTML(item.title);
    const safeSource = escapeHTML(item.source);
    const safeSnippet = escapeHTML(item.description || item.snippet);
    const safeUrl = (item.url && item.url !== '#') ? encodeURI(item.url) : '#';
    
    // Format timestamp nicely
    let formattedTime = "Just now";
    if (item.timestamp) {
        const dateObj = new Date(item.timestamp);
        formattedTime = dateObj.toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    const badgeText = feedType === "latest" ? "LIVE" : "RECENT";
    const badgeClass = feedType === "latest" ? "badge-live" : "badge-recent";

    card.innerHTML = `
        <div class="news-card-header">
            <div class="news-source">🌐 ${safeSource || 'Web News'}</div>
            <div class="news-badge ${badgeClass}">${badgeText}</div>
        </div>
        <h3 class="news-title">${safeTitle}</h3>
        <p class="news-snippet">${safeSnippet}</p>
        <div class="news-card-footer">
            <span class="news-time">🕒 ${formattedTime}</span>
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="news-link">READ ARTICLE &rarr;</a>
        </div>
    `;

    return card;
}

/**
 * Escapes unsafe characters for HTML rendering
 * prevents XSS issues with scraped data
 */
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
