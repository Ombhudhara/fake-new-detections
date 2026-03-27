function switchTab(tab, el) {
  document.querySelectorAll('.tab').forEach(function(t) {
    t.classList.remove('active')
  });
  document.querySelectorAll('.panel').forEach(function(p) {
    p.classList.remove('active')
  });
  el.classList.add('active');
  document.getElementById('panel-' + tab).classList.add('active')
}

function selectMode(mode, el) {
  document.querySelectorAll('.how-box[data-mode]').forEach(function(box) {
    box.classList.toggle('active', box === el)
  });
  clearClientError()
}

function setClientError(msg) {
  var err = document.getElementById('client-error');
  if (err) {
    err.textContent = msg;
    err.style.display = 'block'
  }
}

function clearClientError() {
  var err = document.getElementById('client-error');
  if (err) {
    err.style.display = 'none';
    err.textContent = ''
  }
}

function selectLanguage(el) {
  document.querySelectorAll('.lang-tag').forEach(function(tag) {
    tag.classList.toggle('active', tag === el)
  });
  var hiddenInput = document.getElementById('selected_language');
  if (hiddenInput) {
    hiddenInput.value = el.getAttribute('data-lang')
  }
}

function checkClaim(text) {
  var i = document.getElementById('news-input');
  if (i) {
    i.value = text;
    var shortModeBtn = document.querySelector('.how-box[data-mode="short"]');
    if (shortModeBtn) shortModeBtn.click();
    var tabTextBtn = document.getElementById('tab-text');
    if (tabTextBtn) tabTextBtn.click();
    window.scrollTo({
      top: i.offsetTop - 80,
      behavior: 'smooth'
    })
  }
}

var mainForm = document.getElementById('main-form');
if (mainForm) {
  mainForm.addEventListener('submit', function(evt) {
    var activeMode = document.querySelector('.how-box[data-mode].active');
    var mode = activeMode ? activeMode.getAttribute('data-mode') : 'short';
    var textInput = document.getElementById('news-input');
    var text = textInput ? textInput.value.trim() : '';
    var ap = document.querySelector('.panel.active');

    if (ap && ap.id === 'panel-text') {
      var wc = text ? text.split(/\s+/).filter(Boolean).length : 0;
      if (mode === 'short' && wc > 60) {
        evt.preventDefault();
        setClientError('This is longer than 60 words. Switch to "Full Articles".');
        return
      }
      if (mode === 'full' && wc > 0 && wc <= 60) {
        evt.preventDefault();
        setClientError('This is shorter than 60 words. Switch to "Short Claims".');
        return
      }
    }
    clearClientError();
    // Update button text to show loading state
    var btn = document.getElementById('verifyBtn');
    if (btn) {
      btn.textContent = 'Verifying…';
      btn.disabled = true;
    }
  });
}

// Auto-scroll to result card if present after page load
document.addEventListener('DOMContentLoaded', function() {
  var rc = document.getElementById('result-card');
  if (rc) {
    setTimeout(function() {
      rc.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  }
});


/* ════════════════════════════════════════
   Trending Misinformation State Machine
   ════════════════════════════════════════ */
var TS = (function() {
  var state = {
    allCards: [],
    activeCategory: 'All',
    activePlatform: 'All',
    searchTerm: ''
  };

  var els = {};

  function init() {
    els.grid = document.getElementById('trending-grid');
    els.empty = document.getElementById('ts-empty');
    els.emptyText = document.getElementById('ts-empty-text');
    els.searchInput = document.getElementById('ts-search');
    els.searchTag = document.getElementById('ts-search-tag');
    els.searchTagText = document.getElementById('ts-search-tag-text');
    
    // Selects
    els.country = document.getElementById('ts-country');

    if (els.searchInput) {
      els.searchInput.addEventListener('input', liveFilter);
    }
    
    if (els.grid) fetchData(true);
  }

  function onCountryChange() {
    searchSubmit();
  }

  function showSkeleton() {
    if (!els.grid) return;
    var s = '';
    for (var i = 0; i < 4; i++) {
      s += '<div class="trending-card ts-skeleton"><div class="ts-shimmer ts-skeleton-title"></div><div class="ts-shimmer ts-skeleton-block"></div></div>';
    }
    els.grid.innerHTML = s;
    if (els.empty) els.empty.style.display = 'none';
  }

  function updateStats(items) {
    var st = document.getElementById('stat-total');
    if (st) st.textContent = items.length;
    
    var localCount = 0;
    var whatsappCount = 0;
    
    items.forEach(function(it) {
      if (it.platform && it.platform.toLowerCase() === 'whatsapp') whatsappCount++;
      if (it.state || it.district) localCount++;
    });
    
    var sr = document.getElementById('stat-region');
    if (sr) sr.textContent = localCount;

    var sw = document.getElementById('stat-whatsapp');
    if (sw) sw.textContent = items.length ? Math.round((whatsappCount / items.length) * 100) + '%' : '0%';
    
    var lu = document.getElementById('ts-last-updated');
    if (lu) lu.textContent = 'Updated just now';
  }

  function fetchData(refresh=false) {
    showSkeleton();
    var term = state.searchTerm;
    var cat = state.activeCategory !== 'All' ? state.activeCategory : '';
    
    var url = '/fake-trending?';
    var params = [];
    
    // Send either term or category as topic
    var finalTopic = term || cat;
    if (finalTopic) params.push('topic=' + encodeURIComponent(finalTopic));
    
    if (els.country && els.country.value) params.push('country=' + encodeURIComponent(els.country.value));
    
    if (refresh) params.push('refresh=true');
    url += params.join('&');
    
    fetch(url).then(function(r) { return r.json(); }).then(function(items) {
      startUpdateTimer();
      var finalItems = items || [];
      updateStats(finalItems);
      state.allCards = finalItems;
      renderCards();
    }).catch(function() {
      state.allCards = [];
      updateStats([]);
      renderCards();
    });
  }

  function getFiltered() {
    var items = state.allCards;
    
    // Perform local platform filter
    if (state.activePlatform !== 'All') {
      var target = state.activePlatform.toLowerCase();
      if (target === 'twitter/x') target = 'twitter';
      
      var platItems = items.filter(function(it) {
        var p = (it.platform || '').toLowerCase();
        if (target === 'twitter') return p.includes('twitter') || p.includes('x');
        return p.includes(target);
      });
      
      // If user selected a specific platform but we have ZERO matches,
      // it's better to show them everything than a dead screen, 
      // but we'll mark them as "Global/Web" if needed.
      if (platItems.length > 0) items = platItems;
    }
    
    // local search term filter 
    if (state.searchTerm) {
      var term = state.searchTerm.toLowerCase();
      items = items.filter(function(it) {
        return (it.title || '').toLowerCase().includes(term);
      });
    }
    
    return items;
  }

  let updateInterval;
  function startUpdateTimer() {
    if (updateInterval) clearInterval(updateInterval);
    const start = new Date();
    const el = document.getElementById('ts-last-updated');
    if (!el) return;
    updateInterval = setInterval(() => {
      const diff = Math.floor((new Date() - start) / 1000);
      if (diff < 60) el.textContent = diff + ' sec ago';
      else el.textContent = Math.floor(diff / 60) + ' min ago';
    }, 5000);
  }

  function renderCards() {
    if (!els.grid) return;
    var filtered = getFiltered();
    
    if (filtered.length === 0) {
      els.grid.innerHTML = '';
      if (els.empty) els.empty.style.display = 'block';
      return;
    }
    
    if (els.empty) els.empty.style.display = 'none';
    var html = '';
    
    filtered.forEach(function(item, i) {
      var sourceUrl = item.link || '#';
      var fake_score = parseInt(item.trend_score || item.fake_score) || 70;
      var verdict = item.verdict || 'Fake';
      var platform = item.platform || 'Web';
      var locationStr = (item.district ? item.district + ', ' : '') + (item.state || item.country || '');
      var titleEscaped = (item.title || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
      
      var verdictIcon = verdict === 'Fake' ? '🔴' : (verdict === 'Misleading' ? '🟡' : '🟢');
      var fakeColorClass = 'pill-red';
      if (verdict === 'Misleading') fakeColorClass = 'pill-yellow';
      else if (verdict === 'True') fakeColorClass = 'pill-green';
      
      // Platform Icon logic
      var pIcon = '🌐';
      if (platform.toLowerCase().includes('whatsapp')) pIcon = '💬';
      else if (platform.toLowerCase().includes('twitter') || platform.toLowerCase().includes('x')) pIcon = '𝕏';
      else if (platform.toLowerCase().includes('youtube')) pIcon = '📺';

      html += '<div class="trending-card animate-in delay-' + (Math.min(i + 1, 4)) + '">' +
        '<div class="card-badge-top"><span class="pill ' + fakeColorClass + '">' + verdictIcon + ' ' + verdict + ' ~ ' + fake_score + '%</span></div>' +
        '<div class="t-headline">"' + item.title + '"</div>' +
        
        '<div class="ts-list-meta">' +
        (locationStr && locationStr.toLowerCase() !== 'unknown' ? '📍 <b>Location:</b> ' + locationStr + '<br>' : '') +
        '✔️ <b>Source:</b> ' + (item.source || 'Fact Check') + '<br>' +
        '🕒 <b>Date:</b> ' + (item.date || 'Just now') + '<br>' +
        '📱 <b>Platform:</b> ' + pIcon + ' ' + platform +
        '</div>' +
        
        '<div class="ts-ai-insight">' +
        '🚨 This claim is spreading via ' + platform + '. AI suggests immediate verification.' +
        '</div>' +

        '<div class="ts-card-action-wrap">' +
          '<button class="verify-claim-btn" style="width:100%;" onclick="TS.verifyNow(\'' + titleEscaped + '\')">Check This Now →</button>' +
        '</div>' +
        '</div>';
    });
    els.grid.innerHTML = html;
  }

  function verifyNow(text) {
    const input = document.getElementById('news-input');
    const btn = document.getElementById('verifyBtn');
    const tabBtn = document.getElementById('tab-text');
    
    if (!input || !btn || !tabBtn) return;
    
    // Switch to text tab first
    if (typeof switchTab === 'function') {
      switchTab('text', tabBtn);
    }
    
    input.value = text;
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    
    // Highlight effect on the input
    input.style.boxShadow = '0 0 0 4px rgba(30, 27, 75, 0.2)';
    setTimeout(() => { input.style.boxShadow = ''; }, 2000);
    
    // Auto-trigger disabled per user note: "after user click on verify"
    // We let them click the main verify button manually for confirmation.
  }

  function liveFilter() {
    if (els.searchInput) {
      state.searchTerm = els.searchInput.value.trim();
      renderCards();
    }
  }

  function searchSubmit() {
    var term = els.searchInput ? els.searchInput.value.trim() : '';
    state.searchTerm = term;
    
    var tags = [];
    if (term) tags.push('"' + term + '"');
    
    var c = els.country ? els.country.value : '';
    if (c) tags.push('in ' + c);
    
    if (tags.length > 0 && els.searchTag) {
      els.searchTag.style.display = 'flex';
      els.searchTagText.textContent = 'Showing results for ' + tags.join(' ');
    } else if (els.searchTag) {
      els.searchTag.style.display = 'none';
    }
    
    fetchData();
  }

  function clearSearch() {
    state.searchTerm = '';
    state.activeCategory = 'All';
    state.activePlatform = 'All';
    if (els.searchInput) els.searchInput.value = '';
    if (els.country) els.country.value = '';
    onCountryChange(); // resets others
    if (els.searchTag) els.searchTag.style.display = 'none';
    
    document.querySelectorAll('.ts-filter-btn').forEach(function(b) { b.classList.remove('active'); });
    
    var tAll = document.querySelector('#ts-topic-row .ts-filter-btn[data-cat="All"]');
    if (tAll) tAll.classList.add('active');
    
    var pAll = document.querySelector('#ts-platform-row .ts-filter-btn[data-plat="All"]');
    if (pAll) pAll.classList.add('active');
    
    fetchData(true);
  }

  function setCategory(cat, btn) {
    state.activeCategory = cat;
    document.querySelectorAll('#ts-topic-row .ts-filter-btn').forEach(function(b) {
      b.classList.toggle('active', b === btn);
    });
    fetchData();
  }

  function setPlatform(plat, btn) {
    state.activePlatform = plat;
    document.querySelectorAll('#ts-platform-row .ts-filter-btn').forEach(function(b) {
      b.classList.toggle('active', b === btn);
    });
    renderCards();
  }

  function refresh() {
    fetchData(true);
  }

  return {
    init: init,
    refresh: refresh,
    searchSubmit: searchSubmit,
    clearSearch: clearSearch,
    setCategory: setCategory,
    setPlatform: setPlatform,
    onCountryChange: onCountryChange,
    verifyNow: verifyNow
  };
})();

TS.init();

// Apply data-width values to bar fills
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.bar-fill[data-width]').forEach(function(el) {
      el.style.width = el.getAttribute('data-width') + '%';
    });

    // ── FCM Deep Analysis Panel ────────────────────────────────────
    // (Triggered from index.html via server-side context if needed)
  });

  // ── FCM Analysis Runner ─────────────────────────────────────────
  async function runFCMAnalysis(text, is_ocr) {
    if (!text || !text.trim()) return;
    const panel = document.getElementById('fcm-panel');
    if (!panel) return;
    panel.style.display = 'block';
    panel.innerHTML = fcmSkeleton();

    try {
      const res = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), is_ocr: is_ocr || false })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      renderFCMPanel(panel, data);
    } catch (e) {
      panel.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:12px 0">⚠️ Deep analysis unavailable right now.</div>';
    }
  }

  function fcmSkeleton() {
    return `<div style="display:flex;flex-direction:column;gap:12px;padding:4px 0">
      <div class="ts-shimmer" style="height:40px;border-radius:10px;width:100%"></div>
      <div class="ts-shimmer" style="height:24px;border-radius:8px;width:70%"></div>
      <div class="ts-shimmer" style="height:60px;border-radius:8px;width:100%"></div>
    </div>`;
  }

  function renderFCMPanel(panel, data) {
    if (!data) return;

    // Handle plain_text mode gracefully
    if (data.output_mode === 'plain_text') {
      panel.style.display = 'none';
      return;
    }

    const jd = data.json_data;
    if (!jd) { panel.style.display = 'none'; return; }

    const vColors = { REAL:'#22c55e', FAKE:'#ef4444', MISLEADING:'#f59e0b' };
    const vIcons  = { REAL:'✅', FAKE:'❌', MISLEADING:'⚠️' };
    const sColors = { Critical:'#ef4444', High:'#f59e0b', Medium:'#3b82f6', Low:'#22c55e' };

    const vKey    = (jd.verdict || 'MISLEADING').toUpperCase();
    const vColor  = vColors[vKey] || '#a78bfa';
    const vIcon   = vIcons[vKey]  || '🔍';
    const sevColor = sColors[jd.severity] || '#9ca3af';

    let html = `<div style="border-top:1px solid var(--card-border,rgba(0,0,0,.1));padding-top:16px;margin-top:8px">`;
    html += `<div class="section-h" style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      🧠 FCM Deep Analysis
      <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;background:${vColor}22;color:${vColor};border:1px solid ${vColor}44">${vIcon} ${jd.verdict}</span>
      <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;background:${sevColor}22;color:${sevColor};border:1px solid ${sevColor}44">${jd.severity}</span>
      <span style="font-size:11px;font-weight:500;padding:2px 8px;border-radius:20px;background:rgba(100,100,100,.12);color:var(--text-muted);margin-left:auto">${jd.category}</span>
    </div>`;

    // Key Signals
    if (jd.key_signals && jd.key_signals.length) {
      html += `<div style="margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);letter-spacing:.5px;margin-bottom:6px">KEY SIGNALS DETECTED</div>`;
      jd.key_signals.forEach(s => {
        html += `<div style="display:flex;gap:7px;align-items:flex-start;margin-bottom:5px;font-size:13px;color:var(--text-secondary)">
          <span style="color:#ef4444;flex-shrink:0">🚩</span><span>${escFCM(s)}</span></div>`;
      });
      html += `</div>`;
    }

    // Correct Information
    if (jd.correct_information) {
      html += `<div style="background:rgba(34,197,94,.07);border-left:3px solid #22c55e;border-radius:0 8px 8px 0;padding:10px 13px;margin-bottom:12px">
        <div style="font-size:11px;font-weight:600;color:#22c55e;margin-bottom:4px">✅ CORRECT INFORMATION</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.5">${escFCM(jd.correct_information)}</div>
      </div>`;
    }

    // Sources Checked
    if (jd.sources_checked && jd.sources_checked.length) {
      html += `<div style="margin-bottom:4px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);letter-spacing:.5px;margin-bottom:7px">SOURCES CHECKED</div>`;
      jd.sources_checked.slice(0, 4).forEach(src => {
        const sc = src.credibility_score || 0;
        const barColor = sc >= 80 ? '#22c55e' : sc >= 55 ? '#f59e0b' : '#ef4444';
        html += `<div style="border:1px solid var(--card-border,rgba(0,0,0,.1));border-radius:8px;padding:9px 12px;margin-bottom:7px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <a href="${escFCM(src.url)}" target="_blank" rel="noopener" style="color:var(--text-primary);font-size:12.5px;font-weight:500;text-decoration:none;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escFCM(src.title || src.url)}</a>
            <span style="font-size:11px;font-weight:600;color:${barColor};flex-shrink:0">${sc}/100</span>
          </div>
          <div style="height:4px;background:rgba(0,0,0,.08);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${sc}%;background:${barColor};border-radius:2px;transition:width .5s ease"></div>
          </div>
        </div>`;
      });
      html += `</div>`;
    }

    // ML score if present
    if (jd.ml_model_score !== null && jd.ml_model_score !== undefined) {
      const mlPct = Math.round(jd.ml_model_score * 100);
      const mlLabel = mlPct >= 50 ? 'Real' : 'Fake';
      const mlColor = mlPct >= 50 ? '#22c55e' : '#ef4444';
      html += `<div style="display:flex;align-items:center;gap:10px;font-size:12px;color:var(--text-muted);margin-top:4px;margin-bottom:2px">
        <span>🤖 ML Model: <strong style="color:${mlColor}">${mlLabel} (${mlPct}% real)</strong></span>
        ${jd.domain_credibility_score !== null ? `<span style="margin-left:auto">🌐 Domain: <strong>${jd.domain_credibility_score}/100</strong></span>` : ''}
      </div>`;
    }

    html += `</div>`;
    panel.innerHTML = html;
  }

  function escFCM(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Updated switchTab to handle the third tab ────────────────
  function switchTab(tabId, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
    el.classList.add('active');
    document.getElementById('panel-' + tabId).style.display = 'block';
    
    // Clear other inputs so form submission uses correct one
    if (tabId === 'text') {
      document.getElementById('url-input').value = '';
      if(document.getElementById('extracted-textarea')) document.getElementById('extracted-textarea').name = 'extracted_news_ignore';
      document.getElementById('news-input').name = 'news';
    } else if (tabId === 'url') {
      document.getElementById('news-input').value = '';
      if(document.getElementById('extracted-textarea')) document.getElementById('extracted-textarea').name = 'extracted_news_ignore';
      document.getElementById('url-input').name = 'url';
    } else if (tabId === 'image') {
      document.getElementById('news-input').value = '';
      document.getElementById('url-input').value = '';
      document.getElementById('news-input').name = 'news_ignore';
      if(document.getElementById('extracted-textarea')) document.getElementById('extracted-textarea').name = 'news';
    }
  }

  // Image Upload Logic
  let selectedImageFile = null;

  function handleImageDrop(e) {
    e.preventDefault();
    document.getElementById('img-drop-zone').classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) showImagePreview(file);
  }

  function handleImageSelect(input) {
    const file = input.files[0];
    if (file) showImagePreview(file);
  }

  function showImagePreview(file) {
    selectedImageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('img-preview-thumb').src = e.target.result;
    };
    reader.readAsDataURL(file);
    document.getElementById('img-file-name').textContent = file.name;
    document.getElementById('img-file-size').textContent = (file.size/1024).toFixed(1) + ' KB';
    document.getElementById('img-preview-section').style.display = 'block';
    document.getElementById('extracted-section').style.display = 'none';
    document.getElementById('img-drop-zone').style.display = 'none';
  }

  function removeImage() {
    selectedImageFile = null;
    document.getElementById('img-file-input').value = '';
    document.getElementById('img-preview-section').style.display = 'none';
    document.getElementById('img-drop-zone').style.display = 'block';
    document.getElementById('extracted-section').style.display = 'none';
    if(document.getElementById('extracted-textarea')) document.getElementById('extracted-textarea').value = '';
  }

  async function extractImageText() {
    if (!selectedImageFile) return;
    const btn = document.getElementById('extract-btn');
    btn.textContent = '⏳ Reading image...';
    btn.disabled = true;

    const formData = new FormData();
    formData.append('image', selectedImageFile);

    try {
      const res = await fetch('/api/extract-image-text', { method: 'POST', body: formData });
      const d = await res.json();

      if (d.success) {
        const ta = document.getElementById('extracted-textarea');
        ta.value = d.extracted_text;

        document.getElementById('extracted-section').style.display = 'block';
        document.getElementById('extract-meta').textContent =
          `✓ ${d.word_count} words extracted · Language: ${d.language.toUpperCase()} · Confidence: ${d.confidence}`;

        if (d.red_flags && d.red_flags.length > 0) {
          const rfBox = document.getElementById('red-flags-box');
          rfBox.style.display = 'block';
          rfBox.innerHTML = '🚩 <strong>Red flags detected:</strong><br>' + d.red_flags.map(f=>`• ${f}`).join('<br>');
        } else {
          document.getElementById('red-flags-box').style.display = 'none';
        }

        // Also run FCM on the OCR-extracted text
        runFCMAnalysis(d.extracted_text, true);

        btn.textContent = '✓ Text Extracted!';
        btn.style.background = '#27AE60';
      } else {
        btn.textContent = '⚠ ' + (d.error || 'Could not extract text');
        btn.style.background = '#EF9F27';
      }
    } catch(e) {
      btn.textContent = '⚠ Error — try again';
      btn.style.background = '#E8453C';
    } finally {
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = '🔍 Extract Text from Image';
        btn.style.background = '#18181b';
      }, 3000);
    }
  }