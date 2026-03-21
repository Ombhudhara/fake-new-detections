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
    var btn = document.getElementById('submit-btn');
    if (btn) {
      btn.textContent = 'Verifying...';
      btn.disabled = true
    }
  });
}

/* ════════════════════════════════════════
   Trending Misinformation State Machine
   ════════════════════════════════════════ */
var TS = (function() {
  var state = {
    allCards: [],
    activeCategory: 'All',
    searchTerm: '',
    customCategories: []
  };

  var els = {};

  function init() {
    els.grid = document.getElementById('trending-grid');
    els.empty = document.getElementById('ts-empty');
    els.emptyText = document.getElementById('ts-empty-text');
    els.searchInput = document.getElementById('ts-search');
    els.locationInput = document.getElementById('ts-location');
    els.searchTag = document.getElementById('ts-search-tag');
    els.searchTagText = document.getElementById('ts-search-tag-text');
    els.filterRow = document.getElementById('ts-filter-row');
    els.customInput = document.getElementById('ts-custom-input');
    els.customError = document.getElementById('ts-custom-error');

    if (els.searchInput) {
      els.searchInput.addEventListener('input', function() {
        liveFilter();
      });
      els.searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          searchSubmit();
        }
      });
    }

    if (els.customInput) {
      els.customInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          addCustom();
        }
      });
    }

    if (els.grid) {
      fetchData('', '');
    }
  }

  function showSkeleton() {
    if (!els.grid) return;
    var s = '';
    for (var i = 0; i < 4; i++) {
      s += '<div class="trending-card ts-skeleton">' +
        '<div class="ts-shimmer" style="height:16px;width:' + (60 + Math.random() * 30) + '%;border-radius:4px"></div>' +
        '<div style="height:8px"></div>' +
        '<div class="ts-shimmer" style="height:12px;width:90%;border-radius:4px"></div>' +
        '<div style="height:12px"></div>' +
        '<div style="display:flex;gap:6px">' +
        '<div class="ts-shimmer" style="height:22px;width:70px;border-radius:12px"></div>' +
        '<div class="ts-shimmer" style="height:22px;width:60px;border-radius:12px"></div>' +
        '<div class="ts-shimmer" style="height:22px;width:80px;border-radius:12px"></div>' +
        '</div>' +
        '<div style="height:12px"></div>' +
        '<div class="ts-shimmer" style="height:30px;width:120px;border-radius:6px"></div>' +
        '</div>';
    }
    els.grid.innerHTML = s;
    if (els.empty) els.empty.style.display = 'none';
  }

  function fetchData(category, location) {
    showSkeleton();
    var url = '/api/trending';
    var params = [];
    if (category) params.push('category=' + encodeURIComponent(category));
    if (location) params.push('location=' + encodeURIComponent(location));
    if (params.length > 0) url += '?' + params.join('&');
    
    fetch(url).then(function(r) {
      return r.json();
    }).then(function(items) {
      state.allCards = items || [];
      renderCards();
    }).catch(function() {
      state.allCards = [];
      renderCards();
    });
  }

  function getFiltered() {
    var items = state.allCards;
    var cat = state.activeCategory;
    var term = state.searchTerm.toLowerCase().trim();
    return items.filter(function(c) {
      var catMatch = (cat === 'All') || (c.category === cat);
      var termMatch = !term || c.headline.toLowerCase().indexOf(term) !== -1;
      return catMatch && termMatch;
    });
  }

  function renderCards() {
    if (!els.grid) return;
    var filtered = getFiltered();
    if (filtered.length === 0) {
      els.grid.innerHTML = '';
      if (els.empty) {
        els.empty.style.display = 'flex';
        var msg;
        if (state.activeCategory !== 'All' && !state.searchTerm) {
          msg = '\u26A0\uFE0F No fake news available for "' + state.activeCategory + '" right now. Try another category or click Refresh.';
        } else if (state.searchTerm) {
          msg = '\u26A0\uFE0F No fake news found for "' + state.searchTerm + '". Try a different keyword.';
        } else {
          msg = '\u26A0\uFE0F No fake news available right now — click Refresh to try again.';
        }
        if (els.emptyText) els.emptyText.textContent = msg;
      }
      return;
    }
    if (els.empty) els.empty.style.display = 'none';
    var html = '';
    filtered.forEach(function(item, i) {
      var escaped = item.headline.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      html += '<div class="trending-card animate-in delay-' + (Math.min(i + 1, 4)) + '">' +
        '<div class="t-headline">"' + item.headline + '"</div>' +
        '<div class="t-meta">' +
        '<span class="pill pill-muted">' + item.platform + '</span>' +
        '<span class="pill pill-muted">' + item.category + '</span>' +
        '<span class="pill pill-red">Fake — ' + item.fake_pct + '%</span>' +
        '</div>' +
        '<button class="check-claim-btn" onclick="checkClaim(\'' + escaped + '\')">Check This Claim</button>' +
        '</div>';
    });
    els.grid.innerHTML = html;
  }

  function liveFilter() {
    if (els.searchInput) {
      state.searchTerm = els.searchInput.value;
      renderCards();
    }
  }

  function searchSubmit() {
    if (!els.searchInput && !els.locationInput) return;
    var term = els.searchInput ? els.searchInput.value.trim() : '';
    var loc = els.locationInput ? els.locationInput.value.trim() : '';
    
    if (!term && !loc) return;
    
    state.searchTerm = term;
    state.activeCategory = 'All';
    activateFilterBtn('All');
    
    if (els.searchTag) {
      els.searchTag.style.display = 'inline-flex';
      var tagText = [];
      if (term) tagText.push('"' + term + '"');
      if (loc) tagText.push('in "' + loc + '"');
      if (els.searchTagText) els.searchTagText.textContent = 'Showing results for ' + tagText.join(' ');
    }
    fetchData(term, loc);
  }

  function clearSearch() {
    state.searchTerm = '';
    state.activeCategory = 'All';
    if (els.searchInput) els.searchInput.value = '';
    if (els.locationInput) els.locationInput.value = '';
    if (els.searchTag) els.searchTag.style.display = 'none';
    activateFilterBtn('All');
    fetchData();
  }

  function setCategory(cat, btn) {
    state.activeCategory = cat;
    state.searchTerm = ''; // clear local search when switching category
    if (els.searchInput) els.searchInput.value = '';
    if (els.locationInput) els.locationInput.value = ''; // Clear location input when switching categories
    if (els.searchTag) els.searchTag.style.display = 'none'; // Hide search tag
    activateFilterBtn(cat);
    var loc = els.locationInput ? els.locationInput.value.trim() : ''; // Get current location value
    fetchData(cat === 'All' ? '' : cat, loc); // Pass category and location to fetchData
  }

  function activateFilterBtn(cat) {
    if (els.filterRow) {
      els.filterRow.querySelectorAll('.ts-filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
    }
  }

  function addCustom() {
    if (!els.customInput || !els.customError || !els.filterRow) return;
    var val = els.customInput.value.trim();
    els.customError.style.display = 'none';
    if (val.length < 2) {
      els.customError.textContent = 'Category must be at least 2 characters.';
      els.customError.style.display = 'block';
      return;
    }
    if (val.length > 20) {
      els.customError.textContent = 'Category must be 20 characters or less.';
      els.customError.style.display = 'block';
      return;
    }
    var exists = els.filterRow.querySelector('[data-cat="' + val + '"]');
    if (exists) {
      state.activeCategory = val;
      activateFilterBtn(val);
      els.customInput.value = '';
      renderCards();
      return;
    }
    var btn = document.createElement('button');
    btn.className = 'ts-filter-btn ts-filter-custom';
    btn.setAttribute('data-cat', val);
    btn.textContent = val;
    btn.onclick = function() {
      setCategory(val, btn);
    };
    els.filterRow.appendChild(btn);
    state.customCategories.push(val);
    state.activeCategory = val;
    activateFilterBtn(val);
    els.customInput.value = '';
    fetchData(val);
  }

  function refresh() {
    state.searchTerm = '';
    state.activeCategory = 'All';
    if (els.searchInput) els.searchInput.value = '';
    if (els.searchTag) els.searchTag.style.display = 'none';
    if (els.customError) els.customError.style.display = 'none';
    activateFilterBtn('All');
    fetchData();
  }

  return {
    init: init,
    refresh: refresh,
    searchSubmit: searchSubmit,
    clearSearch: clearSearch,
    setCategory: setCategory,
    addCustom: addCustom
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